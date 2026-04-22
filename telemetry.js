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
    // EXACT OTLP payload that matches curl format
    const logEntry = {
      resourceLogs: [
        {
          scopeLogs: [
            {
              logRecords: [
                {
                  timeUnixNano: String(Date.now() * 1000000),
                  severityText: "INFO",
                  body: { stringValue: "TEST_LOG" }
                }
              ]
            }
          ]
        }
      ]
    };

    console.log("OTLP URL:", OTEL_CONFIG.logsEndpoint);
    console.log("OTLP BODY:", JSON.stringify(logEntry));
    
    try {
      const response = await fetch(OTEL_CONFIG.logsEndpoint, {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
          "api-key": "k9DpiOXK6zPvRX48mhatUty9ipul+nrNf5mbu689kYM="
        },
        body: JSON.stringify(logEntry)
      });

      const contentType = response.headers.get('content-type') || '';
      
      if (!response.ok) {
        console.error(`Failed to send log to SigNoz: ${response.status} ${response.statusText}`);
      } else if (contentType.includes('text/html')) {
        // If we get HTML back, the endpoint is likely wrong (serving UI instead of OTLP)
        console.warn(`SigNoz endpoint returned HTML instead of JSON. This suggests the endpoint ${OTEL_CONFIG.logsEndpoint} may be incorrect.`);
      } else {
        // Log success for debugging
        console.log(`[SigNoz] Successfully sent log to ${OTEL_CONFIG.logsEndpoint}, response: ${response.status}`);
        // Log response body if it's JSON
        try {
          const responseBody = await response.text();
          console.log(`[SigNoz] Response body: ${responseBody.substring(0, 200)}`);
        } catch (e) {
          console.log(`[SigNoz] Could not read response body: ${e.message}`);
        }
      }
    } catch (error) {
      console.error(`Error sending log to SigNoz: ${error.message}`);
    }
  } catch (error) {
    console.error(`Error sending log to SigNoz: ${error.message}`);
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
  // Parse standard OpenTelemetry environment variables
  OTEL_CONFIG = {
    endpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT || 'https://otel.anyapp.cfd',
    tracesEndpoint: env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || `${env.OTEL_EXPORTER_OTLP_ENDPOINT || 'https://otel.anyapp.cfd'}/v1/traces`,
    logsEndpoint: env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT || `${env.OTEL_EXPORTER_OTLP_ENDPOINT || 'https://otel.anyapp.cfd'}/v1/logs`,
    headers: parseHeaders(env.OTEL_EXPORTER_OTLP_HEADERS || ''),
    serviceName: env.OTEL_SERVICE_NAME || 'deepseek-agent'
  };
  
  console.log(`SigNoz telemetry initialized for service: ${OTEL_CONFIG.serviceName}`);
  console.log(`Logs endpoint: ${OTEL_CONFIG.logsEndpoint}`);
  console.log(`Headers configured: ${Object.keys(OTEL_CONFIG.headers).length > 0 ? 'Yes' : 'No'}`);
  
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
module.exports = { initTelemetry, ConditionsLogger, sendLogToSigNoz };