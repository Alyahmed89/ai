'use client';

import { useState, useEffect } from 'react';

interface ApiEndpoint {
  name: string;
  path: string;
  method: string;
  description?: string;
  parameters?: Array<{
    name: string;
    type: string;
    required: boolean;
    description?: string;
  }>;
  responses?: Array<{
    status: number;
    description: string;
  }>;
}

interface ApiEndpointsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ApiEndpointsModal({ isOpen, onClose }: ApiEndpointsModalProps) {
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchEndpoints();
    }
  }, [isOpen]);

  const fetchEndpoints = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/proxy/api/commands');
      if (!response.ok) {
        throw new Error(`Failed to fetch endpoints: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      
      // Transform the data if needed
      let endpointsArray = [];
      if (data.success && data.data && data.data.commands) {
        // Handle format: {success: true, data: {commands: [...]}}
        endpointsArray = data.data.commands;
      } else if (Array.isArray(data)) {
        endpointsArray = data;
      } else if (data.endpoints || data.commands) {
        // Handle different response formats
        endpointsArray = data.endpoints || data.commands || [];
      } else if (typeof data === 'object' && data !== null) {
        // Try to extract endpoints from object properties
        endpointsArray = Object.values(data).filter(item => {
          if (!item || typeof item !== 'object') return false;
          const endpointItem = item as Record<string, any>;
          return endpointItem.path || endpointItem.method || endpointItem.name;
        });
      }
      
      // Ensure all endpoints have required fields
      endpointsArray = endpointsArray.map((endpoint: any) => ({
        name: endpoint.name || '',
        path: endpoint.path || endpoint.endpoint || '',
        method: endpoint.method || 'GET',
        description: endpoint.description,
        parameters: Array.isArray(endpoint.parameters) ? endpoint.parameters : [],
        responses: Array.isArray(endpoint.responses) ? endpoint.responses : []
      }));
      
      setEndpoints(endpointsArray);
    } catch (err) {
      console.error('Error fetching API endpoints:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET': return 'bg-green-900/30 text-green-400 border-green-700';
      case 'POST': return 'bg-gray-900/30 text-gray-400 border-gray-700';
      case 'PUT': return 'bg-yellow-900/30 text-yellow-400 border-yellow-700';
      case 'DELETE': return 'bg-red-900/30 text-red-400 border-red-700';
      case 'PATCH': return 'bg-purple-900/30 text-purple-400 border-purple-700';
      default: return 'bg-gray-900/30 text-gray-400 border-gray-700';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col border border-gray-800">
        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-200">API Endpoints</h2>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-300 p-1"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500"></div>
              <span className="ml-3 text-gray-400">Loading endpoints...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-400 mb-3">Error loading endpoints</div>
              <div className="text-gray-400 text-sm mb-4">{error}</div>
              <button
                onClick={fetchEndpoints}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-sm"
              >
                Retry
              </button>
            </div>
          ) : endpoints.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              No endpoints found
            </div>
          ) : (
            <div className="space-y-4">
              {endpoints.map((endpoint, index) => (
                <div key={index} className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
                  <div className="p-4 border-b border-gray-700 flex items-start">
                    <div className={`px-3 py-1 rounded text-xs font-medium border ${getMethodColor(endpoint.method)}`}>
                      {endpoint.method}
                    </div>
                    <div className="ml-4 flex-1">
                      <div className="font-mono text-sm text-gray-200 break-all">
                        {endpoint.path}
                      </div>
                      {endpoint.name && (
                        <div className="mt-1">
                          <span className="text-gray-400 text-sm font-medium">
                            {endpoint.name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-4">
                    {endpoint.description && (
                      <div className="mb-3 text-gray-300">{endpoint.description}</div>
                    )}
                    
                    {endpoint.parameters && Array.isArray(endpoint.parameters) && endpoint.parameters.length > 0 && (
                      <div className="mb-4">
                        <div className="text-sm font-medium text-gray-400 mb-2">Parameters:</div>
                        <div className="space-y-2">
                          {endpoint.parameters.map((param, paramIndex) => (
                            <div key={paramIndex} className="flex items-start text-sm">
                              <div className="w-32 flex-shrink-0">
                                <span className="font-mono text-gray-300">{param.name}</span>
                                <span className="ml-2 text-xs text-gray-500">{param.type}</span>
                                {param.required && (
                                  <span className="ml-2 text-xs text-red-400">required</span>
                                )}
                              </div>
                              <div className="flex-1 text-gray-400">
                                {param.description}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {endpoint.responses && Array.isArray(endpoint.responses) && endpoint.responses.length > 0 && (
                      <div>
                        <div className="text-sm font-medium text-gray-400 mb-2">Responses:</div>
                        <div className="space-y-2">
                          {endpoint.responses.map((response, respIndex) => (
                            <div key={respIndex} className="flex items-center text-sm">
                              <div className={`w-16 px-2 py-1 rounded text-xs font-medium ${
                                response.status >= 200 && response.status < 300 
                                  ? 'bg-green-900/30 text-green-400' 
                                  : response.status >= 400 && response.status < 500
                                  ? 'bg-yellow-900/30 text-yellow-400'
                                  : 'bg-red-900/30 text-red-400'
                              }`}>
                                {response.status}
                              </div>
                              <div className="ml-3 text-gray-400">
                                {response.description}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}