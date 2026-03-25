'use client';

import { useState, useEffect } from 'react';
import Modal from './ui/Modal';

interface Endpoint {
  id: string;
  name: string;
  url: string;
  method: string;
}

interface FlowStep {
  id: string;
  flow_id: string;
  step_key: string;
  title: string;
  instructions: string;
  step_type: string;
  order_index: number;
  page_key: string | null;
  blocking: number;
  auto_fail_on_error: number;
  retryable: number;
  created_at: string;
  updated_at: string;
  task_id: string | null;
  output_keys: string;
  output_url: string | null;
  output_payload_template: string | null;
  default_next_step: string | null;
  output_auth_token: string | null;
  input_keys: string;
  use_endpoints: string; // New field for endpoint configuration
  output: number;
  default_next_step_id: string | null;
  step_number: number | null;
  requires_task: number;
}

interface FlowDefinition {
  id: string;
  name: string;
  description: string;
  max_iterations: number;
  repository: string;
  branch: string;
  created_at: string;
  updated_at: string;
  next_flow_id: string | null;
  priority: number;
  agent: string;
  system_message?: string;
}

interface EditStepModalProps {
  step: FlowStep;
  onClose: () => void;
  onStepUpdated: (stepId: string) => void;
}

export default function EditStepModal({ step, onClose, onStepUpdated }: EditStepModalProps) {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [flows, setFlows] = useState<FlowDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showFlowList, setShowFlowList] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    instructions: '',
    use_endpoints: '[]', // New field for endpoint configuration
    blocking: 0,
    retryable: 0,
    auto_fail_on_error: 0,
    requires_task: 0
  });

  // State for endpoint configuration UI
  const [endpointConfigs, setEndpointConfigs] = useState<Array<{
    endpoint_id: string;
    phase: 'input' | 'command' | 'output';
    map: Record<string, string>;
  }>>([]);

  const [showAddEndpoint, setShowAddEndpoint] = useState(false);
  const [newEndpoint, setNewEndpoint] = useState({
    endpoint_id: '',
    phase: 'input' as 'input' | 'command' | 'output',
    map: {} as Record<string, string>
  });

  const [showingKeysFor, setShowingKeysFor] = useState<string | null>(null);
  const [endpointKeys, setEndpointKeys] = useState<Record<string, string[]>>({});
  const [showCreateEndpoint, setShowCreateEndpoint] = useState(false);
  const [newEndpointData, setNewEndpointData] = useState({
    name: '',
    description: '',
    url: '',
    method: 'GET' as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    auth_type: 'none' as 'none' | 'bearer' | 'api_key' | 'basic',
    auth_value: '',
    headers: '{}',
    body_template: '',
    query_params: '',
    response_path: '',
    response_validator: '',
    timeout_ms: 10000,
    max_retries: 3,
    retry_delay_ms: 1000
  });

  // Initialize form data from step prop and fetch endpoints
  useEffect(() => {
    if (step) {
      setFormData({
        title: step.title || '',
        instructions: step.instructions || '',
        use_endpoints: step.use_endpoints || '[]',
        blocking: step.blocking || 0,
        retryable: step.retryable || 0,
        auto_fail_on_error: step.auto_fail_on_error || 0,
        requires_task: step.requires_task || 0
      });

      // Parse existing use_endpoints JSON
      try {
        const parsed = JSON.parse(step.use_endpoints || '[]');
        setEndpointConfigs(parsed);
      } catch (e) {
        console.error('Failed to parse use_endpoints:', e);
        setEndpointConfigs([]);
      }
    }
    
    fetchEndpoints();
    fetchFlows();
  }, [step]);



  const fetchEndpoints = async () => {
    try {
      const response = await fetch('/api/proxy/api/endpoints');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data && data.data.endpoints) {
          setEndpoints(data.data.endpoints);
        }
      }
    } catch (err) {
      console.error('Failed to fetch endpoints:', err);
    }
  };

  const fetchFlows = async () => {
    try {
      const response = await fetch('/api/proxy/api/flow-definitions');
      if (response.ok) {
        const data = await response.json();
        setFlows(data);
      }
    } catch (error) {
      console.error('Error fetching flows:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({
        ...prev,
        [name]: checked ? 1 : 0
      }));
    } else if (name === 'blocking' || name === 'retryable' || name === 'auto_fail_on_error' || name === 'requires_task') {
      setFormData(prev => ({
        ...prev,
        [name]: parseInt(value) || 0
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleAddEndpoint = () => {
    if (!newEndpoint.endpoint_id) {
      setError('Please select an endpoint');
      return;
    }
    
    // Check if endpoint already added
    if (endpointConfigs.some(ep => ep.endpoint_id === newEndpoint.endpoint_id && ep.phase === newEndpoint.phase)) {
      setError('This endpoint with the same phase is already configured');
      return;
    }
    
    setEndpointConfigs(prev => [...prev, { ...newEndpoint }]);
    setNewEndpoint({
      endpoint_id: '',
      phase: 'input',
      map: {}
    });
    setShowAddEndpoint(false);
    setError(null);
  };

  const handleRemoveEndpoint = (index: number) => {
    setEndpointConfigs(prev => prev.filter((_, i) => i !== index));
  };

  const handleNewEndpointChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewEndpoint(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleShowKeys = async (endpointId: string, endpointName: string) => {
    if (showingKeysFor === endpointId) {
      setShowingKeysFor(null);
      return;
    }

    setShowingKeysFor(endpointId);
    
    try {
      // Try to fetch endpoint details from API
      const response = await fetch(`/api/proxy/api/endpoints/${endpointId}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Endpoint details:', data);
        
        // Check if endpoint has response schema or example
        if (data.data?.response_schema) {
          // Parse response schema to extract keys
          const schema = JSON.parse(data.data.response_schema);
          const keys = extractKeysFromSchema(schema);
          setEndpointKeys(prev => ({
            ...prev,
            [endpointId]: keys
          }));
          return;
        }
      }
    } catch (error) {
      console.log('Could not fetch endpoint details:', error);
    }
    
    // Fallback: simulate keys based on endpoint name
    const simulatedKeys: Record<string, string[]> = {
      'github_user': ['id', 'login', 'name', 'email', 'avatar_url', 'html_url', 'bio', 'public_repos', 'followers', 'following'],
      'internal_task': ['id', 'title', 'description', 'file', 'endpoint_path', 'http_method', 'ai_context', 'status', 'created_at', 'updated_at'],
      'test_jsonplaceholder': ['id', 'name', 'username', 'email', 'address', 'phone', 'website', 'company'],
      'weather_api': ['location', 'current', 'current.temp_c', 'current.temp_f', 'current.condition', 'current.wind_kph', 'current.humidity']
    };

    // Get keys based on endpoint name
    const endpoint = endpoints.find(ep => ep.id === endpointId);
    const name = endpoint?.name || '';
    
    if (name && simulatedKeys[name]) {
      setEndpointKeys(prev => ({
        ...prev,
        [endpointId]: simulatedKeys[name]
      }));
    } else {
      // Default keys if we don't have specific ones
      setEndpointKeys(prev => ({
        ...prev,
        [endpointId]: ['id', 'name', 'title', 'description', 'status', 'created_at']
      }));
    }
  };

  // Helper function to extract keys from schema
  const extractKeysFromSchema = (schema: any): string[] => {
    const keys: string[] = [];
    
    if (schema.properties) {
      Object.keys(schema.properties).forEach(key => {
        keys.push(key);
        // Handle nested properties
        if (schema.properties[key].properties) {
          const nestedKeys = extractKeysFromSchema(schema.properties[key]);
          nestedKeys.forEach(nestedKey => keys.push(`${key}.${nestedKey}`));
        }
      });
    }
    
    return keys.length > 0 ? keys : ['id', 'name', 'title', 'description', 'status'];
  };

  const handleCreateEndpoint = async () => {
    try {
      // Create the endpoint via API
      const response = await fetch('/api/proxy/api/endpoints', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newEndpointData),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Endpoint created:', result);
        
        // Refresh endpoints list
        fetchEndpoints();
        
        // Close the create endpoint modal
        setShowCreateEndpoint(false);
        
        // Reset form
        setNewEndpointData({
          name: '',
          description: '',
          url: '',
          method: 'GET',
          auth_type: 'none',
          auth_value: '',
          headers: '{}',
          body_template: '',
          query_params: '',
          response_path: '',
          response_validator: '',
          timeout_ms: 10000,
          max_retries: 3,
          retry_delay_ms: 1000
        });
        
        alert('Endpoint created successfully! It will appear in the dropdown after a moment.');
      } else {
        const error = await response.json();
        alert(`Failed to create endpoint: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating endpoint:', error);
      alert('Failed to create endpoint. Please check the console for details.');
    }
  };

  const handleNewEndpointDataChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewEndpointData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    
    try {
      // Validate that instructions exist
      if (!formData.instructions.trim()) {
        throw new Error('Instructions are required');
      }
      
      // Generate use_endpoints JSON from endpointConfigs
      const use_endpoints = JSON.stringify(endpointConfigs);
      
      // Create payload with all required fields from the step
      const payload: any = {
        id: step.id,
        flow_id: step.flow_id,
        step_key: step.step_key || '',
        title: formData.title,
        instructions: formData.instructions,
        step_type: 'action', // Always set to 'action' as default
        order_index: step.order_index || 1,
        page_key: step.page_key || null,
        blocking: formData.blocking === 1,
        auto_fail_on_error: formData.auto_fail_on_error === 1,
        retryable: formData.retryable === 1,
        task_id: step.task_id || null,
        output_keys: step.output_keys || '[]',
        output_url: step.output_url || null,
        output_payload_template: step.output_payload_template || null,
        default_next_step: step.default_next_step || null,
        output_auth_token: step.output_auth_token || null,
        input_keys: '[]', // Empty array for old field
        use_endpoints: use_endpoints,
        output: step.output === 1,
        default_next_step_id: step.default_next_step_id || null,
        step_number: step.step_number || null,
        requires_task: formData.requires_task === 1
      };
      
      // Update step
      const response = await fetch(`/api/proxy/api/flow-steps/${step.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) throw new Error('Failed to update step');
      
      const data = await response.json();
      
      // Check response format
      if (data.success !== undefined) {
        if (!data.success) throw new Error(data.error || 'Failed to update step');
      }
      
      onStepUpdated(step.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
      console.error('Error saving step:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStep = async () => {
    if (!confirm('Are you sure you want to delete this step? This action cannot be undone.')) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/proxy/api/flow-steps/${step.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        onStepUpdated(step.id);
        onClose();
      } else {
        throw new Error(data.error || 'Failed to delete step');
      }
    } catch (err) {
      console.error('Error deleting step:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete step');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Modal onClose={onClose}>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Edit Step</h3>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-white p-2 rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500 mx-auto"></div>
              <p className="text-neutral-400 mt-4">Loading endpoints...</p>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose}>
      <div className="space-y-6 max-h-[70vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Edit Step: {step.title || 'Step'}</h3>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-2 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
          {error && (
            <div className="mb-4 bg-red-900/30 border border-red-800 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-400">Error</h3>
                  <div className="mt-2 text-sm text-red-300">
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">Step Title</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent text-neutral-100"
                placeholder="Enter step title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">Instructions</label>
              <textarea
                name="instructions"
                value={formData.instructions}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent text-neutral-100 resize-none"
                placeholder="Enter step instructions"
              />
              <p className="text-xs text-neutral-500 mt-1">
                Use <code className="text-neutral-400">{'{api.<endpoint_name>.response.*}'}</code> to reference endpoint responses. Example: <code className="text-neutral-400">{'{api.tasks_pending.response.id}'}</code>
              </p>
            </div>

            {/* Flow List Section */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-neutral-400">Flow List</label>
                <button
                  type="button"
                  onClick={() => setShowFlowList(!showFlowList)}
                  className="text-xs text-neutral-400 hover:text-neutral-300 flex items-center"
                >
                  {showFlowList ? 'Hide' : 'Show'} Flows
                  <svg className={`w-3 h-3 ml-1 transition-transform ${showFlowList ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              
              {showFlowList && (
                <div className="mb-4 p-4 bg-neutral-800/50 border border-neutral-700 rounded-lg max-h-60 overflow-y-auto">
                  <p className="text-sm text-neutral-400 mb-3">
                    Available flows in the system. Current flow: <span className="text-neutral-300 font-medium">{step.flow_id}</span>
                  </p>
                  
                  <div className="space-y-2">
                    {flows.length === 0 ? (
                      <div className="text-center py-4 text-neutral-500 text-sm">
                        No flows found
                      </div>
                    ) : (
                      flows.map(flow => (
                        <div 
                          key={flow.id}
                          className={`p-3 rounded border ${
                            flow.id === step.flow_id 
                              ? 'bg-neutral-700/30 border-neutral-600' 
                              : 'bg-neutral-800/30 border-neutral-700'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="text-sm font-medium text-neutral-200">
                                {flow.name}
                              </div>
                              <div className="text-xs text-neutral-400 mt-1">
                                ID: {flow.id}
                              </div>
                              <div className="text-xs text-neutral-500 mt-1">
                                Agent: {flow.agent} • Steps: {flow.max_iterations}
                              </div>
                            </div>
                            {flow.id === step.flow_id && (
                              <span className="text-xs px-2 py-1 rounded bg-neutral-700 text-neutral-300">
                                Current
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">Connected Endpoints</label>
              <div className="mb-4 p-4 bg-neutral-800/50 border border-neutral-700 rounded-lg">
                <p className="text-sm text-neutral-400 mb-3">
                  Configure endpoints used by this step. Each endpoint can be used for input, command, or output phases.
                </p>
                
                <div className="space-y-3">
                  {endpointConfigs.length === 0 ? (
                    <div className="text-center py-4 text-neutral-500 text-sm">
                      No endpoints configured yet. Click "Add Endpoint" to connect endpoints.
                    </div>
                  ) : (
                    endpointConfigs.map((config, index) => {
                      const endpoint = endpoints.find(ep => ep.id === config.endpoint_id);
                      const endpointName = endpoint?.name || config.endpoint_id;
                      const isShowingKeys = showingKeysFor === config.endpoint_id;
                      const keys = endpointKeys[config.endpoint_id] || [];
                      
                      return (
                        <div key={index} className="bg-neutral-800/30 rounded-lg border border-neutral-700 overflow-hidden">
                          <div className="flex items-center justify-between p-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-neutral-200">
                                  {endpointName}
                                </span>
                                <span className="text-xs px-2 py-1 rounded bg-neutral-700 text-neutral-300">
                                  {config.phase}
                                </span>
                              </div>
                              <div className="text-xs text-neutral-400 mt-1">
                                {endpoint?.url || config.endpoint_id}
                              </div>
                              <div className="text-xs text-neutral-500 mt-2">
                                Use in instructions: <code className="text-neutral-300">{`{api.${endpointName}.response.*}`}</code>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleShowKeys(config.endpoint_id, endpointName)}
                                className="text-xs px-3 py-1 bg-neutral-700 hover:bg-neutral-600 rounded text-neutral-300 hover:text-white transition-colors"
                              >
                                {isShowingKeys ? 'Hide Keys' : 'Show Keys'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveEndpoint(index)}
                                className="text-neutral-400 hover:text-red-400 p-1 rounded hover:bg-neutral-700"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          
                          {isShowingKeys && keys.length > 0 && (
                            <div className="border-t border-neutral-700 p-3 bg-neutral-900/50">
                              <div className="text-xs font-medium text-neutral-400 mb-2">Available response keys:</div>
                              <div className="flex flex-wrap gap-2">
                                {keys.map((key, keyIndex) => (
                                  <div key={keyIndex} className="text-xs px-2 py-1 bg-neutral-800 rounded border border-neutral-700 text-neutral-300">
                                    <code>{key}</code>
                                  </div>
                                ))}
                              </div>
                              <div className="text-xs text-neutral-500 mt-3">
                                Use in instructions: <code className="text-neutral-300">{`{api.${endpointName}.response.${keys[0] || 'field_name'}}`}</code>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
                
                <div className="mt-4">
                  {!showAddEndpoint ? (
                    <button
                      type="button"
                      onClick={() => setShowAddEndpoint(true)}
                      className="w-full py-2 px-4 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg text-sm text-neutral-300 hover:text-white transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Endpoint
                    </button>
                  ) : (
                    <div className="space-y-3 p-3 bg-neutral-800/30 rounded-lg border border-neutral-700">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-medium text-neutral-300">Add New Endpoint</h4>
                        <button
                          type="button"
                          onClick={() => setShowAddEndpoint(false)}
                          className="text-neutral-400 hover:text-white p-1 rounded hover:bg-neutral-700"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-neutral-400 mb-1">Endpoint</label>
                        <div className="flex gap-2">
                          <select
                            name="endpoint_id"
                            value={newEndpoint.endpoint_id}
                            onChange={handleNewEndpointChange}
                            className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-transparent text-neutral-100 text-sm"
                          >
                            <option value="">Select endpoint</option>
                            {endpoints.map(endpoint => (
                              <option key={endpoint.id} value={endpoint.id}>
                                {endpoint.name} ({endpoint.method} {endpoint.url})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => setShowCreateEndpoint(true)}
                            className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white flex items-center gap-1 text-sm"
                            title="Create new endpoint"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            New
                          </button>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-neutral-400 mb-1">Phase</label>
                        <select
                          name="phase"
                          value={newEndpoint.phase}
                          onChange={handleNewEndpointChange}
                          className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-transparent text-neutral-100 text-sm"
                        >
                          <option value="input">Input (provides data to step)</option>
                          <option value="command">Command (executes action)</option>
                          <option value="output">Output (sends results)</option>
                        </select>
                      </div>
                      
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={handleAddEndpoint}
                          className="w-full py-2 px-4 bg-gray-600 hover:bg-gray-700 rounded-lg text-sm text-white font-medium transition-colors"
                        >
                          Add Endpoint
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-4">
                <p className="text-xs text-neutral-500">
                  <strong>How to use endpoints in instructions:</strong> Reference endpoint responses using{' '}
                  <code className="text-neutral-300">{`{api.<endpoint_name>.response.<field>}`}</code>. For example:{' '}
                  <code className="text-neutral-300">{`{api.github_user.response.name}`}</code> or{' '}
                  <code className="text-neutral-300">{`{api.internal_task.response.id}`}</code>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="blocking"
                  name="blocking"
                  checked={formData.blocking === 1}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-gray-500 focus:ring-gray-500 border-neutral-600 bg-neutral-800 rounded"
                />
                <label htmlFor="blocking" className="ml-2 text-sm text-neutral-300">
                  Blocking Step
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="retryable"
                  name="retryable"
                  checked={formData.retryable === 1}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-gray-500 focus:ring-gray-500 border-neutral-600 bg-neutral-800 rounded"
                />
                <label htmlFor="retryable" className="ml-2 text-sm text-neutral-300">
                  Retryable
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="auto_fail_on_error"
                  name="auto_fail_on_error"
                  checked={formData.auto_fail_on_error === 1}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-gray-500 focus:ring-gray-500 border-neutral-600 bg-neutral-800 rounded"
                />
                <label htmlFor="auto_fail_on_error" className="ml-2 text-sm text-neutral-300">
                  Auto Fail on Error
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="requires_task"
                  name="requires_task"
                  checked={formData.requires_task === 1}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-gray-500 focus:ring-gray-500 border-neutral-600 bg-neutral-800 rounded"
                />
                <label htmlFor="requires_task" className="ml-2 text-sm text-neutral-300">
                  Requires Task
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-800">
              <div className="flex justify-between">
                <div>
                  <button
                    type="button"
                    onClick={handleDeleteStep}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-red-300 hover:text-red-100 bg-red-900/20 hover:bg-red-900/40 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Step
                  </button>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {saving && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    )}
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Create Endpoint Modal */}
        {showCreateEndpoint && (
          <Modal onClose={() => setShowCreateEndpoint(false)}>
          <div className="space-y-6 max-h-[70vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Create New Endpoint</h3>
              <button
                onClick={() => setShowCreateEndpoint(false)}
                className="text-neutral-400 hover:text-white p-2 rounded-lg hover:bg-neutral-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1">Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={newEndpointData.name}
                      onChange={handleNewEndpointDataChange}
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-transparent text-neutral-100"
                      placeholder="e.g., github_user"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1">Description</label>
                    <input
                      type="text"
                      name="description"
                      value={newEndpointData.description}
                      onChange={handleNewEndpointDataChange}
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-transparent text-neutral-100"
                      placeholder="Brief description"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1">URL *</label>
                    <input
                      type="text"
                      name="url"
                      value={newEndpointData.url}
                      onChange={handleNewEndpointDataChange}
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-transparent text-neutral-100"
                      placeholder="e.g., https://api.github.com/users/{username}"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1">Method *</label>
                    <select
                      name="method"
                      value={newEndpointData.method}
                      onChange={handleNewEndpointDataChange}
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-transparent text-neutral-100"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                      <option value="PATCH">PATCH</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1">Auth Type</label>
                    <select
                      name="auth_type"
                      value={newEndpointData.auth_type}
                      onChange={handleNewEndpointDataChange}
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-transparent text-neutral-100"
                    >
                      <option value="none">None</option>
                      <option value="bearer">Bearer Token</option>
                      <option value="api_key">API Key</option>
                      <option value="basic">Basic Auth</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1">Auth Value</label>
                    <input
                      type="password"
                      name="auth_value"
                      value={newEndpointData.auth_value}
                      onChange={handleNewEndpointDataChange}
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-transparent text-neutral-100"
                      placeholder="Token or API key"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-1">Headers (JSON)</label>
                  <textarea
                    name="headers"
                    value={newEndpointData.headers}
                    onChange={handleNewEndpointDataChange}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-transparent text-neutral-100 font-mono text-sm"
                    rows={3}
                    placeholder='{"Content-Type": "application/json"}'
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-1">Body Template (JSON)</label>
                  <textarea
                    name="body_template"
                    value={newEndpointData.body_template}
                    onChange={handleNewEndpointDataChange}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-transparent text-neutral-100 font-mono text-sm"
                    rows={3}
                    placeholder='{"username": "{username}"}'
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1">Query Parameters</label>
                    <input
                      type="text"
                      name="query_params"
                      value={newEndpointData.query_params}
                      onChange={handleNewEndpointDataChange}
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-transparent text-neutral-100"
                      placeholder="e.g., page=1&limit=10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1">Response Path</label>
                    <input
                      type="text"
                      name="response_path"
                      value={newEndpointData.response_path}
                      onChange={handleNewEndpointDataChange}
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-transparent text-neutral-100"
                      placeholder="e.g., data.results"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1">Timeout (ms)</label>
                    <input
                      type="number"
                      name="timeout_ms"
                      value={newEndpointData.timeout_ms}
                      onChange={handleNewEndpointDataChange}
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-transparent text-neutral-100"
                      min="1000"
                      step="1000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1">Max Retries</label>
                    <input
                      type="number"
                      name="max_retries"
                      value={newEndpointData.max_retries}
                      onChange={handleNewEndpointDataChange}
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-transparent text-neutral-100"
                      min="0"
                      max="10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1">Retry Delay (ms)</label>
                    <input
                      type="number"
                      name="retry_delay_ms"
                      value={newEndpointData.retry_delay_ms}
                      onChange={handleNewEndpointDataChange}
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-transparent text-neutral-100"
                      min="100"
                      step="100"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-neutral-800">
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => setShowCreateEndpoint(false)}
                      className="px-4 py-2 text-sm font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateEndpoint}
                      className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create Endpoint
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Modal>
        )}
      </Modal>
  );
}