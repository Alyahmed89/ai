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
    console.log("HARDCODED REQUEST SENT");
    
    const response = await fetch("https://otel.anyapp.cfd/v1/logs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer k9DpiOXK6zPvRX48mhatUty9ipul+nrNf5mbu689kYM="
      },
      body: '{"resourceLogs":[{"scopeLogs":[{"logRecords":[{"timeUnixNano":"1710000000000000000","severityText":"INFO","body":{"stringValue":"HARDCODED_TEST"}}]}]}]}'
    });

    console.log("RESPONSE STATUS:", response.status);
    const responseText = await response.text();
    console.log("RESPONSE TEXT:", responseText);
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
    // Split only on first '=' to handle values containing '='
    if (pair.includes('=')) {
      const [key, value] = pair.split('=', 1);
      if (key && value) {
        headers[key.trim()] = value.trim();
      }
    }
  }
  return headers;
}

// Export initialization function and logger class
export { initTelemetry, ConditionsLogger, sendLogToSigNoz };