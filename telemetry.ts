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
 * Flatten a nested object into OTLP attributes array.
 * Primitive values become stringValue attributes.
 * Nested objects/arrays become JSON-stringified stringValue attributes.
 */
function objectToAttributes(obj, prefix = '') {
  const attrs = [];
  if (!obj || typeof obj !== 'object') return attrs;
  
  for (const [key, value] of Object.entries(obj)) {
    const attrKey = prefix ? `${prefix}.${key}` : key;
    if (value === null || value === undefined) {
      attrs.push({ key: attrKey, value: { stringValue: '' } });
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      attrs.push({ key: attrKey, value: { stringValue: String(value) } });
    } else if (typeof value === 'object') {
      // Nested objects/arrays: JSON-stringify into a single attribute
      attrs.push({ key: attrKey, value: { stringValue: JSON.stringify(value) } });
    }
  }
  return attrs;
}

/**
 * Send log to SigNoz via OTLP HTTP
 *
 * OTLP best practices:
 * - body.stringValue = simple human-readable event name (NOT JSON)
 * - All structured data goes into attributes array
 */
async function sendLogToSigNoz(logData) {
  try {
    console.log("[TRACE] sendLogToSigNoz CALLED");
    console.log("[SigNoz] Sending log to telemetry endpoint");
    console.log(`[SigNoz] Config: endpoint=${OTEL_CONFIG.logsEndpoint}, service=${OTEL_CONFIG.serviceName}`);
    console.log(`[SigNoz] Headers configured:`, OTEL_CONFIG.headers);
    console.log(`[SigNoz] logData type: ${typeof logData}, isArray: ${Array.isArray(logData)}, keys: ${logData ? Object.keys(logData).join(',') : 'N/A'}`);

    // Convert logData to OTLP format
    const timeUnixNano = (Date.now() * 1000000).toString(); // Convert to nanoseconds
    
    // body.stringValue MUST be a simple human-readable string (NOT JSON)
    // Use the step name as the event name, or a fallback
    const eventName = (logData && logData.step) 
      ? `conditions.${logData.step}` 
      : (typeof logData === 'string' ? logData : 'conditions_event');
    
    // Build attributes from logData
    const attributes = [];
    
    // Always include feature and step as top-level attributes
    if (logData && typeof logData === 'object') {
      attributes.push({ key: "feature", value: { stringValue: String(logData.feature || 'unknown') } });
      attributes.push({ key: "step", value: { stringValue: String(logData.step || 'unknown') } });
      
      // Flatten all keys from logData.data into attributes
      if (logData.data && typeof logData.data === 'object') {
        const dataAttrs = objectToAttributes(logData.data, 'data');
        attributes.push(...dataAttrs);
      }
      
      // Include error if present
      if (logData.error) {
        attributes.push({ key: "error", value: { stringValue: String(logData.error) } });
      }
      
      // Include timestamp
      if (logData.timestamp) {
        attributes.push({ key: "timestamp", value: { stringValue: String(logData.timestamp) } });
      }
    }
    
    const logRecord = {
      timeUnixNano,
      severityNumber: 9, // INFO level
      severityText: "INFO",
      body: { stringValue: eventName },
      attributes
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
    
    const finalPayload = JSON.stringify(otlpPayload);
    console.log("[FINAL_OTLP_PAYLOAD]", finalPayload);

    // Verify payload integrity before fetch
    const FINAL_OTLP_PAYLOAD = finalPayload;
    console.log("[COMPARE_OTLP]", JSON.stringify({
      finalPayloadLogged: FINAL_OTLP_PAYLOAD,
      actualFetchBody: finalPayload,
      match: FINAL_OTLP_PAYLOAD === finalPayload,
      finalPayloadType: typeof FINAL_OTLP_PAYLOAD,
      actualFetchBodyType: typeof finalPayload
    }));

    console.log("[TRACE] BEFORE_FETCH_OTLP");
    console.log("[TRACE] fetch args:", JSON.stringify({
      url: OTEL_CONFIG.logsEndpoint,
      method: "POST",
      hasHeaders: !!fetchHeaders,
      bodyLength: finalPayload.length
    }));

    const response = await fetch(OTEL_CONFIG.logsEndpoint, {
      method: "POST",
      headers: fetchHeaders,
      body: finalPayload
    });

    console.log("[TRACE] FETCH RESPONSE STATUS", response?.status);
    console.log(`[SigNoz] Log sent, status: ${response.status}`);
    console.log(`[SigNoz] Response status text: ${response.statusText}`);
    console.log(`[SigNoz] Response headers:`, JSON.stringify([...response.headers.entries()]));
    const responseText = await response.text();
    console.log(`[SigNoz] Response body length: ${responseText.length}`);
    if (responseText) {
      console.log(`[SigNoz] Response: ${responseText}`);
    }
  } catch (error) {
    console.error(`[SigNoz] Error in sendLogToSigNoz: ${error.message}`);
    console.error(`[SigNoz] Error stack: ${error.stack}`);
    console.error("[TRACE] FETCH CAUGHT ERROR:", error.message);
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
    sendLogToSigNoz(logEntry).catch(err => {
      console.error(`[SigNoz] Failed to send log: ${err.message}`);
    });
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