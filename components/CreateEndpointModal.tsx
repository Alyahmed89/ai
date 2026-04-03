'use client';

import { useState, useEffect } from 'react';

interface CreateEndpointModalProps {
  isOpen: boolean;
  onClose: () => void;
  endpointName: string;
  onEndpointCreated: (endpointName: string) => void;
  mode?: 'create' | 'edit';
  endpointId?: string;
}

interface EndpointFormData {
  name: string;
  description: string;
  url: string;
  method: string;
  auth_type: string;
  auth_value: string;
  headers: Record<string, string>;
  sample_request: string;
  sample_response: string;
}

export default function CreateEndpointModal({ 
  isOpen, 
  onClose, 
  endpointName,
  onEndpointCreated,
  mode = 'create',
  endpointId
}: CreateEndpointModalProps) {
  const [formData, setFormData] = useState<EndpointFormData>({
    name: endpointName,
    description: '',
    url: '',
    method: 'GET',
    auth_type: 'none',
    auth_value: '',
    headers: {
      'Content-Type': 'application/json'
    },
    sample_request: '',
    sample_response: ''
  });
  const [showAuth, setShowAuth] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && endpointId) {
        // Fetch endpoint data for editing
        fetchEndpointData(endpointId);
      } else {
        // Reset form for create mode
        setFormData(prev => ({
          ...prev,
          name: endpointName
        }));
      }
      setError(null);
      setSuccess(false);
    }
  }, [isOpen, endpointName, mode, endpointId]);

  const fetchEndpointData = async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`https://deepseek-agent.alghamdimo89.workers.dev/api/endpoints/${id}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch endpoint: ${response.status}`);
      }
      const data = await response.json();
      
      // Map API response to form data
      setFormData({
        name: data.name || '',
        description: data.description || '',
        url: data.url || '',
        method: data.method || 'GET',
        auth_type: data.auth_type || 'none',
        auth_value: data.auth_value || '',
        headers: data.headers || { 'Content-Type': 'application/json' },
        sample_request: data.sample_request || '',
        sample_response: data.sample_response || ''
      });
      
      // Show auth section if auth is configured
      if (data.auth_type && data.auth_type !== 'none') {
        setShowAuth(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch endpoint data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleHeaderChange = (key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      headers: {
        ...prev.headers,
        [key]: value
      }
    }));
  };

  const addHeader = () => {
    setFormData(prev => ({
      ...prev,
      headers: {
        ...prev.headers,
        '': ''
      }
    }));
  };

  const removeHeader = (key: string) => {
    const newHeaders = { ...formData.headers };
    delete newHeaders[key];
    setFormData(prev => ({
      ...prev,
      headers: newHeaders
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Clean up headers - remove empty keys
      const cleanedHeaders = Object.fromEntries(
        Object.entries(formData.headers).filter(([key, value]) => key.trim() !== '' && value.trim() !== '')
      );

      const payload = {
        name: formData.name,
        description: formData.description,
        url: formData.url,
        method: formData.method,
        auth_type: formData.auth_type === 'none' ? undefined : formData.auth_type,
        auth_value: formData.auth_type === 'none' ? undefined : formData.auth_value,
        headers: cleanedHeaders,
        sample_request: formData.sample_request,
        sample_response: formData.sample_response
      };

      // Remove undefined fields
      const cleanedPayload = Object.fromEntries(
        Object.entries(payload).filter(([_, value]) => value !== undefined)
      );

      let url = 'https://deepseek-agent.alghamdimo89.workers.dev/api/endpoints';
      let method = 'POST';
      
      if (mode === 'edit' && endpointId) {
        url = `${url}/${endpointId}`;
        method = 'PUT';
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cleanedPayload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${mode === 'edit' ? 'update' : 'create'} endpoint: ${response.status}`);
      }

      setSuccess(true);
      setTimeout(() => {
        onEndpointCreated(formData.name);
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${mode === 'edit' ? 'update' : 'create'} endpoint`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">{mode === 'edit' ? 'Edit Endpoint' : 'Create New Endpoint'}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {success ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Endpoint {mode === 'edit' ? 'Updated' : 'Created'} Successfully!</h3>
              <p className="text-gray-400">The endpoint "{formData.name}" has been {mode === 'edit' ? 'updated' : 'created'}.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="space-y-6">
                {/* Basic Information */}
                <div>
                  <h3 className="text-lg font-medium text-white mb-4">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Endpoint Name *
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:border-gray-500 focus:outline-none"
                        placeholder="e.g., github_repo"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Method *
                      </label>
                      <select
                        name="method"
                        value={formData.method}
                        onChange={handleInputChange}
                        required
                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:border-gray-500 focus:outline-none"
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="DELETE">DELETE</option>
                        <option value="PATCH">PATCH</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Description
                    </label>
                    <input
                      type="text"
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:border-gray-500 focus:outline-none"
                      placeholder="e.g., Get GitHub repository information"
                    />
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      URL *
                    </label>
                    <input
                      type="text"
                      name="url"
                      value={formData.url}
                      onChange={handleInputChange}
                      required
                      className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:border-gray-500 focus:outline-none"
                      placeholder="e.g., https://api.github.com/repos/{owner}/{repo}"
                    />
                  </div>
                </div>

                {/* Headers */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-white">Request Headers</h3>
                    <button
                      type="button"
                      onClick={addHeader}
                      className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded"
                    >
                      + Add Header
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {Object.entries(formData.headers).map(([key, value], index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={key}
                          onChange={(e) => handleHeaderChange(e.target.value, value)}
                          placeholder="Header name"
                          className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:border-gray-500 focus:outline-none"
                        />
                        <span className="text-gray-400">:</span>
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => handleHeaderChange(key, e.target.value)}
                          placeholder="Header value"
                          className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:border-gray-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => removeHeader(key)}
                          className="px-2 py-1 text-red-400 hover:text-red-300"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Authentication */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-white">Authentication</h3>
                    <button
                      type="button"
                      onClick={() => setShowAuth(!showAuth)}
                      className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded"
                    >
                      {showAuth ? 'Hide' : 'Add Auth'}
                    </button>
                  </div>

                  {showAuth && (
                    <div className="bg-gray-800/50 rounded-lg p-4 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Auth Type
                        </label>
                        <select
                          name="auth_type"
                          value={formData.auth_type}
                          onChange={handleInputChange}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:border-gray-500 focus:outline-none"
                        >
                          <option value="none">No Authentication</option>
                          <option value="bearer">Bearer Token</option>
                          <option value="apikey">API Key</option>
                        </select>
                      </div>

                      {formData.auth_type !== 'none' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            {formData.auth_type === 'bearer' ? 'Bearer Token' : 'API Key'}
                          </label>
                          <input
                            type="text"
                            name="auth_value"
                            value={formData.auth_value}
                            onChange={handleInputChange}
                            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:border-gray-500 focus:outline-none"
                            placeholder={formData.auth_type === 'bearer' ? 'env:GITHUB_TOKEN' : 'X-API-Key'}
                          />
                          <p className="text-xs text-gray-400 mt-2">
                            Use "env:VARIABLE_NAME" to reference environment variables
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Sample Data */}
                <div>
                  <h3 className="text-lg font-medium text-white mb-4">Sample Data</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Sample Request Body (JSON)
                      </label>
                      <textarea
                        name="sample_request"
                        value={formData.sample_request}
                        onChange={handleInputChange}
                        rows={4}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm font-mono focus:border-gray-500 focus:outline-none"
                        placeholder='{"owner": "octocat", "repo": "Hello-World"}'
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Sample Response (JSON)
                      </label>
                      <textarea
                        name="sample_response"
                        value={formData.sample_response}
                        onChange={handleInputChange}
                        rows={4}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm font-mono focus:border-gray-500 focus:outline-none"
                        placeholder='{"id": 1296269, "name": "Hello-World", ...}'
                      />
                    </div>
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-red-300">{error}</span>
                    </div>
                  </div>
                )}

                {/* Form Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-700">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        {mode === 'edit' ? 'Updating...' : 'Creating...'}
                      </>
                    ) : (
                      mode === 'edit' ? 'Update Endpoint' : 'Create Endpoint'
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}