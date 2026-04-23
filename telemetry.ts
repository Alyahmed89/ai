// SigNoz logging utility for Cloudflare Workers
// Since Cloudflare Workers don't support OpenTelemetry Node SDK,
// we'll send logs directly via HTTP to SigNoz OTLP endpoint

// OpenTelemetry environment variables
let OTEL_CONFIG = {
  endpoint: 'https://otel.anyapp.cfd',
  tracesEndpoint: 'https://otel.anyapp.cfd/v1/traces',
  logsEndpoint: 'https://otel.anyapp.cfd/v1/logs',
  headers: {},
  serviceName: 'deepseek-agent'
};

/**
 * Send log to SigNoz via OTLP HTTP
 */
async function sendLogToSigNoz(logData) {
  try {
    console.log("[SigNoz] Sending log to telemetry endpoint");
    console.log(`[SigNoz] Config: endpoint=${OTEL_CONFIG.logsEndpoint}, service=${OTEL_CONFIG.serviceName}`);
    console.log(`[SigNoz] Headers configured:`, OTEL_CONFIG.headers);

    // Convert logData to OTLP format
    const timeUnixNano = (Date.now() * 1000000).toString(); // Convert to nanoseconds
    const logRecord = {
      timeUnixNano,
      severityNumber: 9, // INFO level
      severityText: "INFO",
      body: { stringValue: JSON.stringify(logData) },
      attributes: [
        { key: "feature", value: { stringValue: logData.feature || "unknown" } },
        { key: "step", value: { stringValue: logData.step || "unknown" } },
        { key: "condition_id", value: { stringValue: logData.data?.condition_id || "none" } }
      ]
    };

    const otlpPayload = {
      resourceLogs: [{
        resource: {
          attributes: [{
            key: "service.name",
            value: { stringValue: OTEL_CONFIG.serviceName }
          }]
        },
        scopeLogs: [{
          scope: {},
          logRecords: [logRecord]
        }]
      }]
    };

    const fetchHeaders = {
      "Content-Type": "application/json",
      ...OTEL_CONFIG.headers
    };
    
    console.log(`[SigNoz] Fetch headers:`, fetchHeaders);
    console.log(`[SigNoz] Sending to: ${OTEL_CONFIG.logsEndpoint}`);

    const response = await fetch(OTEL_CONFIG.logsEndpoint, {
      method: "POST",
      headers: fetchHeaders,
      body: JSON.stringify(otlpPayload)
    });

    console.log(`[SigNoz] Log sent, status: ${response.status}`);
    const responseText = await response.text();
    if (responseText) {
      console.log(`[SigNoz] Response: ${responseText}`);
    }
  } catch (error) {
    console.error(`[SigNoz] Error in sendLogToSigNoz: ${error.message}`);
  }
}

/**
 * Structured logger for conditions feature
 */
class ConditionsLogger {
  constructor() {
    this.feature = 'conditions';
  }

  log(step, data = {}, error = null) {
    const logEntry = {
      feature: this.feature,
      step,
      timestamp: new Date().toISOString(),
      data,
      ...(error && { error: error.message || String(error) })
    };

    // Log to console (will be captured by Cloudflare Workers logs)
    console.log(JSON.stringify(logEntry));

    // Try to send to SigNoz (async, fire and forget)
    if (typeof fetch !== 'undefined') {
      sendLogToSigNoz(logEntry).catch(err => {
        console.error(`Failed to send log to SigNoz: ${err.message}`);
      });
    }
  }

  beforeEvaluation(conditionId, context) {
    this.log('before_condition_evaluation', {
      condition_id: conditionId,
      context_summary: this._summarizeContext(context)
    });
  }

  afterEvaluation(conditionId, result, context) {
    this.log('after_condition_evaluation', {
      condition_id: conditionId,
      result,
      context_summary: this._summarizeContext(context)
    });
  }

  error(conditionId, error, context) {
    this.log('condition_error', {
      condition_id: conditionId,
      context_summary: this._summarizeContext(context)
    }, error);
  }

  logConditionEvaluation(logData) {
    // Extract step from logData or default to 'condition_evaluation'
    const step = logData.step || 'condition_evaluation';
    const data = logData.data || {};
    const error = logData.error ? new Error(logData.error) : null;
    
    this.log(step, data, error);
  }

  _summarizeContext(context) {
    if (!context) return {};
    
    return {
      flow_id: context.flow_id,
      step_id: context.step_id,
      has_ai_output: !!context.ai_output,
      has_command_results: context.command_results?.length || 0,
      variables_count: Object.keys(context.variables || {}).length,
      data_entries_count: context.data?.size || 0
    };
  }
}

// Initialize with environment variables
function initTelemetry(env = {}) {
  console.log(`[SigNoz] Initializing telemetry with env keys: ${Object.keys(env).filter(k => k.includes('OTEL')).join(', ')}`);
  
  // Parse standard OpenTelemetry environment variables
  OTEL_CONFIG = {
    endpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT || 'https://otel.anyapp.cfd',
    tracesEndpoint: env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || `${env.OTEL_EXPORTER_OTLP_ENDPOINT || 'https://otel.anyapp.cfd'}/v1/traces`,
    logsEndpoint: env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT || `${env.OTEL_EXPORTER_OTLP_ENDPOINT || 'https://otel.anyapp.cfd'}/v1/logs`,
    headers: parseHeaders(env.OTEL_EXPORTER_OTLP_HEADERS || ''),
    serviceName: env.OTEL_SERVICE_NAME || 'deepseek-agent'
  };
  
  console.log(`[SigNoz] Telemetry initialized for service: ${OTEL_CONFIG.serviceName}`);
  console.log(`[SigNoz] Logs endpoint: ${OTEL_CONFIG.logsEndpoint}`);
  console.log(`[SigNoz] Headers configured: ${Object.keys(OTEL_CONFIG.headers).length > 0 ? 'Yes' : 'No'}`);
  if (Object.keys(OTEL_CONFIG.headers).length > 0) {
    console.log(`[SigNoz] Header keys: ${Object.keys(OTEL_CONFIG.headers).join(', ')}`);
  }
  
  return new ConditionsLogger();
}

// Parse headers string like "api-key=your-key,header2=value2"
function parseHeaders(headersString) {
  const headers = {};
  if (!headersString) return headers;
  
  const pairs = headersString.split(',');
  for (const pair of pairs) {
    const trimmedPair = pair.trim();
    if (!trimmedPair) continue;
    
    // Find first '=' and split there to handle values containing '='
    const eqIndex = trimmedPair.indexOf('=');
    if (eqIndex !== -1) {
      const key = trimmedPair.substring(0, eqIndex).trim();
      const value = trimmedPair.substring(eqIndex + 1).trim();
      if (key && value) {
        headers[key] = value;
      }
    }
  }
  return headers;
}

// Export initialization function and logger class
export { initTelemetry, ConditionsLogger, sendLogToSigNoz };