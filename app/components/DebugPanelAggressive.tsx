'use client';

import React, { useState, useEffect, useRef } from 'react';

interface DebugRequest {
  id: string;
  timestamp: Date;
  url: string;
  method: string;
  status?: number;
  requestBody?: any;
  responseBody?: any;
  duration?: number;
  type: 'fetch' | 'xhr';
}

export default function DebugPanelAggressive() {
  const [requests, setRequests] = useState<DebugRequest[]>([]);
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const requestCount = useRef(0);
  const panelId = useRef(`panel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  // Ultra-aggressive request interception
  useEffect(() => {
    console.log(`🚨 DebugPanelAggressive [${panelId.current}]: Setting up ULTRA-AGGRESSIVE request interception`);
    console.log(`🚨 DebugPanelAggressive [${panelId.current}]: Current window.fetch:`, window.fetch);
    console.log(`🚨 DebugPanelAggressive [${panelId.current}]: Is window.fetch native?`, window.fetch.toString().includes('[native code]'));
    
    // Store original methods
    const originalFetch = window.fetch;
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    
    // Track XHR requests
    const xhrRequests = new WeakMap<XMLHttpRequest, DebugRequest>();
    
    // 1. Intercept fetch - MOST AGGRESSIVE
    window.fetch = async function(...args) {
      const [url, options = {}] = args;
      const requestId = `fetch_${Date.now()}_${requestCount.current++}`;
      const startTime = Date.now();
      const requestUrl = typeof url === 'string' ? url : url.toString();
      
      console.log('🚨🚨🚨 DebugPanelAggressive: INTERCEPTED FETCH to:', requestUrl);
      console.log('🚨 Method:', options.method || 'GET');
      console.log('🚨 Full URL:', requestUrl);
      
      // Capture request details
      const request: DebugRequest = {
        id: requestId,
        timestamp: new Date(),
        url: requestUrl,
        method: options.method || 'GET',
        type: 'fetch'
      };
      
      // Try to capture request body
      if (options.body) {
        try {
          if (typeof options.body === 'string') {
            request.requestBody = JSON.parse(options.body);
            console.log('🚨 Request body:', request.requestBody);
          } else {
            request.requestBody = String(options.body);
          }
        } catch (e) {
          request.requestBody = String(options.body);
        }
      }
      
      // Make the actual request
      try {
        const response = await originalFetch.apply(this, args);
        const endTime = Date.now();
        
        // Clone response to read body without consuming it
        const responseClone = response.clone();
        
        try {
          const responseBody = await responseClone.json();
          request.responseBody = responseBody;
        } catch (e) {
          try {
            const text = await responseClone.text();
            request.responseBody = text;
          } catch (e2) {
            request.responseBody = 'Unable to parse response';
          }
        }
        
        request.status = response.status;
        request.duration = endTime - startTime;
        
        console.log('✅ DebugPanelAggressive: Fetch completed', { 
          url: request.url, 
          status: request.status,
          duration: request.duration
        });
        
        // Add to requests list
        setRequests(prev => {
          const newRequests = [request, ...prev].slice(0, 10);
          console.log('📊 DebugPanelAggressive: Updated requests list, now has', newRequests.length, 'requests');
          return newRequests;
        });
        
        return response;
      } catch (error) {
        console.error('❌ DebugPanelAggressive: Fetch failed', error);
        throw error;
      }
    };
    
    // 2. Intercept XMLHttpRequest - ALSO AGGRESSIVE
    XMLHttpRequest.prototype.open = function(method: string, url: string | URL, async?: boolean, username?: string | null, password?: string | null) {
      (this as any)._debugMethod = method;
      (this as any)._debugUrl = url.toString();
      (this as any)._debugStartTime = Date.now();
      return originalXHROpen.call(this, method, url, async ?? true, username, password);
    };
    
    XMLHttpRequest.prototype.send = function(body?: any) {
      const requestId = `xhr_${Date.now()}_${requestCount.current++}`;
      const startTime = (this as any)._debugStartTime || Date.now();
      const method = (this as any)._debugMethod || 'GET';
      const url = (this as any)._debugUrl || '';
      
      console.log('🚨🚨🚨 DebugPanelAggressive: INTERCEPTED XHR to:', url);
      console.log('🚨 XHR Method:', method);
      
      // Capture request details
      const request: DebugRequest = {
        id: requestId,
        timestamp: new Date(),
        url: url,
        method: method,
        type: 'xhr'
      };
      
      // Try to capture request body
      if (body) {
        try {
          if (typeof body === 'string') {
            request.requestBody = JSON.parse(body);
            console.log('🚨 XHR Request body:', request.requestBody);
          } else {
            request.requestBody = String(body);
          }
        } catch (e) {
          request.requestBody = String(body);
        }
      }
      
      // Store request on XHR object
      xhrRequests.set(this, request);
      
      // Intercept response
      const originalOnReadyStateChange = this.onreadystatechange;
      const originalOnLoad = this.onload;
      
      this.onreadystatechange = function() {
        if (this.readyState === 4) { // DONE
          const endTime = Date.now();
          const request = xhrRequests.get(this);
          
          if (request) {
            request.status = this.status;
            request.duration = endTime - startTime;
            
            try {
              const responseText = this.responseText;
              if (responseText) {
                request.responseBody = JSON.parse(responseText);
              }
            } catch (e) {
              request.responseBody = this.responseText || 'Unable to parse response';
            }
            
            console.log('✅ DebugPanelAggressive: XHR completed', { 
              url: request.url, 
              status: request.status,
              duration: request.duration
            });
            
            // Add to requests list
            setRequests(prev => {
              const newRequests = [request, ...prev].slice(0, 10);
              console.log('📊 DebugPanelAggressive: Updated requests list, now has', newRequests.length, 'requests');
              return newRequests;
            });
          }
        }
        
        if (originalOnReadyStateChange) {
          return originalOnReadyStateChange.apply(this, arguments as any);
        }
      };
      
      this.onload = function(e: any) {
        if (this.readyState === 4) {
          const endTime = Date.now();
          const request = xhrRequests.get(this);
          
          if (request) {
            request.status = this.status;
            request.duration = endTime - startTime;
            
            try {
              const responseText = this.responseText;
              if (responseText) {
                request.responseBody = JSON.parse(responseText);
              }
            } catch (e) {
              request.responseBody = this.responseText || 'Unable to parse response';
            }
            
            console.log('✅ DebugPanelAggressive: XHR onload completed', { 
              url: request.url, 
              status: request.status 
            });
            
            setRequests(prev => {
              const newRequests = [request, ...prev].slice(0, 10);
              return newRequests;
            });
          }
        }
        
        if (originalOnLoad) {
          return originalOnLoad.apply(this, [e]);
        }
      };
      
      return originalXHRSend.apply(this, [body]);
    };
    
    // Test immediately
    console.log(`🧪 DebugPanelAggressive [${panelId.current}]: Testing interception with immediate test request`);
    console.log(`🧪 DebugPanelAggressive [${panelId.current}]: Current window.fetch after override:`, window.fetch);
    console.log(`🧪 DebugPanelAggressive [${panelId.current}]: Is it our function?`, window.fetch === originalFetch ? 'NO (still original)' : 'YES (overridden)');
    
    setTimeout(() => {
      console.log(`🧪 DebugPanelAggressive [${panelId.current}]: Making test fetch request`);
      fetch('/api/test-debug-panel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'debug panel test', timestamp: Date.now(), panelId: panelId.current })
      }).then(() => {
        console.log(`✅ DebugPanelAggressive [${panelId.current}]: Test fetch completed`);
      }).catch((err) => {
        console.error(`❌ DebugPanelAggressive [${panelId.current}]: Test fetch failed:`, err);
      });
    }, 1000);
    
    // Return cleanup function
    return () => {
      window.fetch = originalFetch;
      XMLHttpRequest.prototype.open = originalXHROpen;
      XMLHttpRequest.prototype.send = originalXHRSend;
    };
  }, []);

  const clearRequests = () => {
    setRequests([]);
  };

  const toggleExpand = (id: string) => {
    setExpandedRequestId(expandedRequestId === id ? null : id);
  };

  const formatJson = (obj: any) => {
    if (typeof obj === 'string') return obj;
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  const highlightKeyFields = (request: DebugRequest) => {
    const highlights = [];
    
    // Check request body for flow-related fields
    if (request.requestBody?.deleted_step_ids) {
      highlights.push(`🗑️ Deleted steps: ${JSON.stringify(request.requestBody.deleted_step_ids)}`);
    }
    
    if (request.requestBody?.steps) {
      highlights.push(`📋 Steps: ${request.requestBody.steps.length} items`);
    }
    
    if (request.requestBody?.edges) {
      highlights.push(`🔗 Edges: ${request.requestBody.edges.length} items`);
    }
    
    if (request.requestBody?.deleted_edge_ids) {
      highlights.push(`✂️ Deleted edges: ${JSON.stringify(request.requestBody.deleted_edge_ids)}`);
    }
    
    return highlights;
  };

  const getStatusColor = (status?: number) => {
    if (!status) return 'bg-gray-800';
    if (status >= 200 && status < 300) return 'bg-green-800';
    if (status >= 400) return 'bg-red-800';
    return 'bg-yellow-800';
  };

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET': return 'bg-green-800';
      case 'POST': return 'bg-blue-800';
      case 'PUT': return 'bg-yellow-800';
      case 'DELETE': return 'bg-red-800';
      default: return 'bg-gray-800';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-96 max-h-[80vh] bg-gray-900 text-white rounded-lg shadow-2xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsVisible(!isVisible)}
            className="text-sm px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded"
            title={isVisible ? 'Collapse' : 'Expand'}
          >
            {isVisible ? '▼' : '▲'}
          </button>
          <h3 className="font-bold text-sm">🚨 API Debug Panel</h3>
          <span className="text-xs bg-red-600 px-2 py-1 rounded-full">
            {requests.length} requests
          </span>
        </div>
        <button
          onClick={clearRequests}
          className="text-xs px-2 py-1 bg-red-700 hover:bg-red-600 rounded"
          title="Clear all requests"
        >
          Clear
        </button>
      </div>

      {/* Content */}
      {isVisible && (
        <div className="overflow-y-auto max-h-[calc(80vh-40px)]">
          {requests.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-sm">
              <div className="mb-2">No API requests captured yet.</div>
              <div className="text-xs text-gray-500 mb-2">
                Click "Save Flow" to see the auto-save payload.
              </div>
              <div className="text-xs text-gray-600">
                Monitoring: fetch(), XMLHttpRequest, ALL API calls
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {requests.map((request) => {
                const highlights = highlightKeyFields(request);
                const isExpanded = expandedRequestId === request.id;
                
                return (
                  <div key={request.id} className="p-3 hover:bg-gray-800">
                    <div 
                      className="cursor-pointer"
                      onClick={() => toggleExpand(request.id)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${getMethodColor(request.method)}`}>
                              {request.method}
                            </span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${getStatusColor(request.status)}`}>
                              {request.status || 'Pending'}
                            </span>
                            <span className="text-xs text-gray-400">
                              {request.duration}ms
                            </span>
                            <span className="text-xs text-gray-500">
                              {request.type}
                            </span>
                          </div>
                          <div className="text-xs font-mono truncate text-gray-300 mb-1">
                            {request.url.includes('/api/proxy/') 
                              ? request.url.replace(/^.*\/api\/proxy\//, '/api/.../')
                              : request.url}
                          </div>
                          <div className="text-xs text-gray-400">
                            {request.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </div>
                        </div>
                        <div className="text-gray-400">
                          {isExpanded ? '▼' : '▶'}
                        </div>
                      </div>
                      
                      {/* Highlights */}
                      {highlights.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {highlights.map((highlight, idx) => (
                            <div key={idx} className="text-xs bg-gray-800 px-2 py-1 rounded">
                              {highlight}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-gray-700 space-y-3">
                        {/* Request Body */}
                        {request.requestBody && (
                          <div>
                            <div className="text-xs font-bold text-gray-300 mb-1">Request Body:</div>
                            <pre className="text-xs bg-gray-800 p-2 rounded overflow-x-auto max-h-40">
                              {formatJson(request.requestBody)}
                            </pre>
                          </div>
                        )}
                        
                        {/* Response Body */}
                        {request.responseBody && (
                          <div>
                            <div className="text-xs font-bold text-gray-300 mb-1">Response:</div>
                            <pre className="text-xs bg-gray-800 p-2 rounded overflow-x-auto max-h-40">
                              {formatJson(request.responseBody)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}