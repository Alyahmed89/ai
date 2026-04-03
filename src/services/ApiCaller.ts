// Unified API Calling Service
// Handles all API calls: Input, Output, and Command endpoints
// Stores raw results in api_calls table, no variable wrapping

import { generateId, saveVariable } from './database';
import { extractVariablesFromResponse, generateVariableId, shouldStoreAsVariable } from '../utils/variableExtractor';

export interface ApiCallResult {
  success: boolean;
  data?: any;
  error?: string;
  status?: number;
  headers?: Record<string, string>;
}

export interface ApiCallParams {
  flow_id?: string;
  flow_run_id?: string;
  step_id?: string;
  step_run_id?: string;
  parameters?: Record<string, any>;
}

export class ApiCaller {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * Unified method to call any endpoint
   * @param endpointName - Name or ID of the endpoint
   * @param params - Execution context and parameters
   * @param type - Type of API call: 'input', 'output', or 'command'
   * @param httpMethod - Optional HTTP method override (GET/POST/PUT/DELETE)
   * @returns Raw API response data
   */
  async callEndpoint(
    endpointName: string,
    params: ApiCallParams = {},
    type: 'input' | 'output' | 'command' = 'input',
    httpMethod?: string
  ): Promise<ApiCallResult> {
    const startTime = Date.now();
    let durationMs = 0;
    let response: any;
    let request: any;
    let endpoint: any;
    
    try {
      // 1. Get endpoint config from endpoint_registry
      endpoint = await this.getEndpointConfig(endpointName);
      if (!endpoint) {
        return {
          success: false,
          error: `Endpoint not found: ${endpointName}`
        };
      }

      // 2. Build request (URL, headers, body)
      request = await this.buildRequest(endpoint, params.parameters || {});
      
      // Override HTTP method if provided
      if (httpMethod) {
        request.method = httpMethod;
      }

      // 3. Make fetch() call
      response = await this.executeRequest(request, endpoint);
      durationMs = Date.now() - startTime;

      // 4. Store in api_calls table
      await this.saveApiCall({
        id: generateId(),
        flow_id: params.flow_id,
        flow_run_id: params.flow_run_id,
        step_id: params.step_id,
        step_run_id: params.step_run_id,
        endpoint_id: endpoint.id,
        endpoint_name: endpoint.name,
        method: type,  // Type: input/output/command
        http_method: request.method,  // Actual HTTP method: GET/POST/PUT/DELETE
        status_code: response.status,
        duration_ms: durationMs,
        request: request,
        response: response,
        created_at: new Date().toISOString()
      });

      // 5. Return raw result
      return {
        success: true,
        data: response.data,
        status: response.status,
        headers: response.headers
      };

    } catch (error: any) {
      durationMs = Date.now() - startTime;
      console.error(`[ApiCaller] Error calling endpoint ${endpointName}:`, error);
      
      // Save failed API call with error
      if (endpoint && request) {
        await this.saveApiCall({
          id: generateId(),
          flow_id: params.flow_id,
          flow_run_id: params.flow_run_id,
          step_id: params.step_id,
          step_run_id: params.step_run_id,
          endpoint_id: endpoint?.id,
          endpoint_name: endpoint?.name || endpointName,
          method: type,
          http_method: request?.method || httpMethod || 'GET',
          status_code: 0,
          duration_ms: durationMs,
          error: error.message || 'Unknown error',
          request: request || {},
          response: null,
          created_at: new Date().toISOString()
        });
      }
      
      return {
        success: false,
        error: error.message || 'Unknown error',
        status: 0
      };
    }
  }

  /**
   * Get endpoint configuration from database
   */
  private async getEndpointConfig(endpointName: string): Promise<any> {
    const sql = `
      SELECT id, name, url, method, auth_type, auth_value,
             headers, body_template, query_params, response_path,
             timeout_ms, max_retries, retry_delay_ms,
             parameter_schema, sample_response, save_to_db
      FROM endpoint_registry
      WHERE id = ? OR name = ?
    `;
    
    const result = await this.db.prepare(sql)
      .bind(endpointName, endpointName)
      .first();
    
    return result;
  }

  /**
   * Build request from endpoint config and parameters
   */
  private async buildRequest(endpoint: any, parameters: Record<string, any>): Promise<any> {
    // Start with endpoint URL
    let url = endpoint.url;
    
    // Substitute parameters in URL
    if (parameters) {
      for (const [key, value] of Object.entries(parameters)) {
        if (typeof value === 'string' || typeof value === 'number') {
          url = url.replace(`{${key}}`, encodeURIComponent(String(value)));
        }
      }
    }
    
    // Build headers
    const headers: Record<string, string> = {};
    if (endpoint.headers) {
      try {
        const headerObj = typeof endpoint.headers === 'string' 
          ? JSON.parse(endpoint.headers) 
          : endpoint.headers;
        
        for (const [key, value] of Object.entries(headerObj)) {
          headers[key] = String(value);
        }
      } catch (e) {
        console.warn(`[ApiCaller] Failed to parse headers for endpoint ${endpoint.name}:`, e);
      }
    }
    
    // Add authentication if configured
    if (endpoint.auth_type && endpoint.auth_value) {
      if (endpoint.auth_type === 'bearer') {
        headers['Authorization'] = `Bearer ${endpoint.auth_value}`;
      } else if (endpoint.auth_type === 'basic') {
        headers['Authorization'] = `Basic ${btoa(endpoint.auth_value)}`;
      } else if (endpoint.auth_type === 'api_key') {
        headers['X-API-Key'] = endpoint.auth_value;
      }
    }
    
    // Build body
    let body: any = null;
    if (endpoint.body_template) {
      try {
        let bodyTemplate = endpoint.body_template;
        
        // Substitute parameters in body template
        if (parameters) {
          for (const [key, value] of Object.entries(parameters)) {
            if (typeof value === 'string' || typeof value === 'number') {
              const stringValue = String(value);
              bodyTemplate = bodyTemplate.replace(
                new RegExp(`\\{${key}\\}`, 'g'),
                stringValue
              );
            } else if (typeof value === 'object') {
              // For objects, replace with JSON string
              bodyTemplate = bodyTemplate.replace(
                new RegExp(`\\{${key}\\}`, 'g'),
                JSON.stringify(value)
              );
            }
          }
        }
        
        // Parse the body
        body = JSON.parse(bodyTemplate);
      } catch (e) {
        console.warn(`[ApiCaller] Failed to parse body template for endpoint ${endpoint.name}:`, e);
        body = endpoint.body_template;
      }
    }
    
    // Build query parameters
    const queryParams: Record<string, string> = {};
    if (endpoint.query_params) {
      try {
        const qpObj = typeof endpoint.query_params === 'string'
          ? JSON.parse(endpoint.query_params)
          : endpoint.query_params;
        
        for (const [key, value] of Object.entries(qpObj)) {
          let paramValue = String(value);
          
          // Substitute parameters in query params
          if (parameters) {
            for (const [paramKey, paramVal] of Object.entries(parameters)) {
              if (typeof paramVal === 'string' || typeof paramVal === 'number') {
                paramValue = paramValue.replace(
                  `{${paramKey}}`,
                  encodeURIComponent(String(paramVal))
                );
              }
            }
          }
          
          queryParams[key] = paramValue;
        }
      } catch (e) {
        console.warn(`[ApiCaller] Failed to parse query params for endpoint ${endpoint.name}:`, e);
      }
    }
    
    return {
      url,
      method: endpoint.method || 'GET',
      headers,
      body,
      queryParams,
      timeout: endpoint.timeout_ms || 30000,
      maxRetries: endpoint.max_retries || 0,
      retryDelay: endpoint.retry_delay_ms || 1000
    };
  }

  /**
   * Execute HTTP request with retry logic
   */
  private async executeRequest(request: any, endpoint: any): Promise<any> {
    const { url, method, headers, body, queryParams, timeout, maxRetries, retryDelay } = request;
    
    // Add query parameters to URL
    let fullUrl = url;
    if (queryParams && Object.keys(queryParams).length > 0) {
      const urlObj = new URL(fullUrl);
      for (const [key, value] of Object.entries(queryParams)) {
        urlObj.searchParams.append(key, value as string);
      }
      fullUrl = urlObj.toString();
    }
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const fetchOptions: RequestInit = {
          method,
          headers,
          signal: controller.signal
        };
        
        if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
          fetchOptions.body = JSON.stringify(body);
          if (!headers['Content-Type']) {
            fetchOptions.headers = {
              ...headers,
              'Content-Type': 'application/json'
            };
          }
        }
        
        const response = await fetch(fullUrl, fetchOptions);
        clearTimeout(timeoutId);
        
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });
        
        let responseData: any;
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          responseData = await response.json();
        } else {
          responseData = await response.text();
        }
        
        // Extract data using response_path if specified
        let extractedData = responseData;
        if (endpoint.response_path && responseData && typeof responseData === 'object') {
          const path = endpoint.response_path;
          const parts = path.split('.');
          let current: any = responseData;
          
          for (const part of parts) {
            if (current && typeof current === 'object' && part in current) {
              current = current[part];
            } else {
              current = null;
              break;
            }
          }
          
          if (current !== null) {
            extractedData = current;
          }
        }
        
        return {
          status: response.status,
          headers: responseHeaders,
          data: extractedData,
          raw: responseData
        };
        
      } catch (error: any) {
        lastError = error;
        
        if (attempt < maxRetries) {
          console.warn(`[ApiCaller] Request failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${retryDelay}ms:`, error.message);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
    
    throw lastError || new Error('Request failed after all retries');
  }

  /**
   * Save API call to api_calls table and extract variables from response
   */
  private async saveApiCall(apiCall: {
    id: string;
    flow_id?: string;
    flow_run_id?: string;
    step_id?: string;
    step_run_id?: string;
    endpoint_id?: string;
    endpoint_name?: string;
    method?: string;
    http_method?: string;
    status_code?: number;
    duration_ms?: number;
    error?: string;
    request?: any;
    response?: any;
    created_at?: string;
  }): Promise<void> {
    try {
      // First save the API call
      await this.db.prepare(`
        INSERT INTO api_calls (
          id, flow_id, flow_run_id, step_id, step_run_id,
          endpoint_id, endpoint_name, method, http_method, status_code, 
          duration_ms, error, request, response, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        apiCall.id,
        apiCall.flow_id || null,
        apiCall.flow_run_id || null,
        apiCall.step_id || null,
        apiCall.step_run_id || null,
        apiCall.endpoint_id || null,
        apiCall.endpoint_name || null,
        apiCall.method || 'input',
        apiCall.http_method || null,
        apiCall.status_code || null,
        apiCall.duration_ms || null,
        apiCall.error || null,
        JSON.stringify(apiCall.request || {}),
        JSON.stringify(apiCall.response || {}),
        apiCall.created_at || new Date().toISOString()
      ).run();
      
      console.log(`[ApiCaller] Saved API call for ${apiCall.endpoint_name} to api_calls table`);
      
      // Extract and save variables from successful API responses
      if (apiCall.response && apiCall.response.status >= 200 && apiCall.response.status < 300) {
        await this.extractAndSaveVariables(apiCall);
      }
      
    } catch (error) {
      console.error(`[ApiCaller] Failed to save API call to api_calls table:`, error);
      // Don't throw - we still want to return the API result even if saving fails
    }
  }
  
  /**
   * Extract variables from API response and save to variables table
   */
  private async extractAndSaveVariables(apiCall: {
    flow_id?: string;
    flow_run_id?: string;
    step_id?: string;
    step_run_id?: string;
    endpoint_id?: string;
    endpoint_name?: string;
    response?: any;
  }): Promise<void> {
    try {
      // Get endpoint config to check for response_path
      const endpoint = await this.getEndpointConfig(apiCall.endpoint_id || apiCall.endpoint_name || '');
      
      // Extract response data
      const responseData = apiCall.response?.data || apiCall.response?.raw || apiCall.response;
      
      if (!responseData) {
        console.log(`[ApiCaller] No response data to extract variables from`);
        return;
      }
      
      // Extract variables based on response_path or flatten response
      const responsePath = endpoint?.response_path;
      const extractedVars = extractVariablesFromResponse(responseData, responsePath);
      
      console.log(`[ApiCaller] Extracted ${Object.keys(extractedVars).length} variables from API response:`, 
        Object.keys(extractedVars));
      
      // Save each extracted variable
      for (const [key, value] of Object.entries(extractedVars)) {
        if (shouldStoreAsVariable(value)) {
          await saveVariable(this.db, {
            id: generateVariableId(apiCall.flow_run_id || 'unknown', key),
            flow_id: apiCall.flow_id,
            flow_run_id: apiCall.flow_run_id,
            step_id: apiCall.step_id,
            step_run_id: apiCall.step_run_id,
            key,
            value,
            source: 'api',
            variable_type: 'system'
          });
          
          console.log(`[ApiCaller] Saved variable: ${key} = ${typeof value === 'object' ? JSON.stringify(value).substring(0, 100) + '...' : value}`);
        }
      }
      
    } catch (error) {
      console.error(`[ApiCaller] Error extracting variables:`, error);
      // Don't throw - variable extraction failure shouldn't break API call
    }
  }

  /**
   * Query API calls from the database
   */
  async queryApiCalls(params: {
    flow_run_id?: string;
    step_id?: string;
    endpoint_id?: string;
    endpoint_name?: string;
    method?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    try {
      const conditions: string[] = [];
      const bindings: any[] = [];
      
      if (params.flow_run_id) {
        conditions.push('flow_run_id = ?');
        bindings.push(params.flow_run_id);
      }
      
      if (params.step_id) {
        conditions.push('step_id = ?');
        bindings.push(params.step_id);
      }
      
      if (params.endpoint_id) {
        conditions.push('endpoint_id = ?');
        bindings.push(params.endpoint_id);
      }
      
      if (params.endpoint_name) {
        conditions.push('endpoint_name = ?');
        bindings.push(params.endpoint_name);
      }
      
      if (params.method) {
        conditions.push('method = ?');
        bindings.push(params.method);
      }
      
      let sql = 'SELECT * FROM api_calls';
      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }
      
      sql += ' ORDER BY created_at DESC';
      
      if (params.limit) {
        sql += ' LIMIT ?';
        bindings.push(params.limit);
      }
      
      if (params.offset) {
        sql += ' OFFSET ?';
        bindings.push(params.offset);
      }
      
      const result = await this.db.prepare(sql).bind(...bindings).all();
      return result.results || [];
    } catch (error) {
      console.error(`[ApiCaller] Failed to query API calls:`, error);
      return [];
    }
  }
}