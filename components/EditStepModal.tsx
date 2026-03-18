'use client';

import { useState, useEffect } from 'react';

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
  output: number;
  default_next_step_id: string | null;
  step_number: number | null;
  requires_task: number;
}

interface EditStepModalProps {
  step: FlowStep;
  onClose: () => void;
  onStepUpdated: (stepId: string) => void;
}

export default function EditStepModal({ step, onClose, onStepUpdated }: EditStepModalProps) {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    instructions: '',
    step_type: 'action',
    inputEndpointId: '',
    outputEndpointId: '',
    inputKeys: '',
    blocking: 0,
    retryable: 0,
    auto_fail_on_error: 0,
    requires_task: 0
  });

  // Initialize form data from step prop and fetch endpoints
  useEffect(() => {
    if (step) {
      // Parse input_keys to get endpoint ID or input keys string
      let inputEndpointId = '';
      let inputKeys = '';
      try {
        if (step.input_keys) {
          // Try to parse as JSON (for endpoint references)
          const parsed = JSON.parse(step.input_keys);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].endpoint_ref) {
            inputEndpointId = parsed[0].endpoint_ref;
          } else {
            // Not a valid endpoint JSON, treat as input keys string
            inputKeys = step.input_keys;
          }
        }
      } catch (e) {
        // Not valid JSON, treat as input keys string
        inputKeys = step.input_keys;
      }
      
      // Parse output_url to get endpoint ID
      let outputEndpointId = '';
      if (step.output_url && step.output_url.startsWith('endpoint://')) {
        outputEndpointId = step.output_url.replace('endpoint://', '');
      }
      
      setFormData({
        title: step.title || '',
        instructions: step.instructions || '',
        step_type: step.step_type || 'action',
        inputEndpointId,
        outputEndpointId,
        inputKeys,
        blocking: step.blocking || 0,
        retryable: step.retryable || 0,
        auto_fail_on_error: step.auto_fail_on_error || 0,
        requires_task: step.requires_task || 0
      });
    }
    
    fetchEndpoints();
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
      // Clear the other input field when one is set
      if (name === 'inputEndpointId' && value) {
        setFormData(prev => ({
          ...prev,
          inputEndpointId: value,
          inputKeys: '' // Clear input keys when endpoint is selected
        }));
      } else if (name === 'inputKeys' && value) {
        setFormData(prev => ({
          ...prev,
          inputKeys: value,
          inputEndpointId: '' // Clear endpoint when input keys are entered
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          [name]: value
        }));
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    
    try {
      // Prepare input_keys based on selected input endpoint or input keys string
      let inputKeys = '[]';
      if (formData.inputEndpointId) {
        // Use endpoint reference format
        inputKeys = JSON.stringify([{
          key: 'endpoint',
          endpoint_ref: formData.inputEndpointId
        }]);
      } else if (formData.inputKeys.trim()) {
        // Use simple string format (comma-separated keys)
        inputKeys = formData.inputKeys.trim();
      }
      
      // Prepare output_url based on selected output endpoint
      let outputUrl = null;
      if (formData.outputEndpointId) {
        outputUrl = `endpoint://${formData.outputEndpointId}`;
      }
      
      // Create payload with all required fields from the step
      const payload: any = {
        id: step.id,
        flow_id: step.flow_id,
        step_key: step.step_key || '',
        title: formData.title,
        instructions: formData.instructions,
        step_type: formData.step_type,
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
        input_keys: inputKeys,
        output: step.output === 1,
        default_next_step_id: step.default_next_step_id || null,
        step_number: step.step_number || null,
        requires_task: formData.requires_task === 1
      };
      
      // Only update output_url if we have a new value
      if (outputUrl !== null) {
        payload.output_url = outputUrl;
      }
      
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

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-800">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-100">Edit Step</h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-gray-400 mt-4">Loading endpoints...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-100">Edit Step: {step.title || 'Step'}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
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
              <label className="block text-sm font-medium text-gray-400 mb-2">Step Title</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-100"
                placeholder="Enter step title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Instructions</label>
              <textarea
                name="instructions"
                value={formData.instructions}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-100 resize-none"
                placeholder="Enter step instructions"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Step Type</label>
              <select
                name="step_type"
                value={formData.step_type}
                onChange={handleInputChange}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-100"
              >
                <option value="action">Action</option>
                <option value="decision">Decision</option>
                <option value="input">Input</option>
                <option value="output">Output</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Input Endpoint</label>
                <select
                  name="inputEndpointId"
                  value={formData.inputEndpointId}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-100"
                >
                  <option value="">Select input endpoint</option>
                  {endpoints.map(endpoint => (
                    <option key={endpoint.id} value={endpoint.id}>
                      {endpoint.name} ({endpoint.method} {endpoint.url})
                    </option>
                  ))}
                </select>
                <div className="mt-2">
                  <label className="block text-sm font-medium text-gray-400 mb-2">Or Input Keys (comma-separated)</label>
                  <input
                    type="text"
                    name="inputKeys"
                    value={formData.inputKeys}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-100"
                    placeholder="e.g., user_input,test_data"
                  />
                  <p className="text-xs text-gray-500 mt-1">Enter comma-separated input keys (used if no endpoint selected)</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Output Endpoint</label>
                <select
                  name="outputEndpointId"
                  value={formData.outputEndpointId}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-100"
                >
                  <option value="">Select output endpoint</option>
                  {endpoints.map(endpoint => (
                    <option key={endpoint.id} value={endpoint.id}>
                      {endpoint.name} ({endpoint.method} {endpoint.url})
                    </option>
                  ))}
                </select>
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
                  className="h-4 w-4 text-blue-500 focus:ring-blue-500 border-gray-600 bg-gray-800 rounded"
                />
                <label htmlFor="blocking" className="ml-2 text-sm text-gray-300">
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
                  className="h-4 w-4 text-blue-500 focus:ring-blue-500 border-gray-600 bg-gray-800 rounded"
                />
                <label htmlFor="retryable" className="ml-2 text-sm text-gray-300">
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
                  className="h-4 w-4 text-blue-500 focus:ring-blue-500 border-gray-600 bg-gray-800 rounded"
                />
                <label htmlFor="auto_fail_on_error" className="ml-2 text-sm text-gray-300">
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
                  className="h-4 w-4 text-blue-500 focus:ring-blue-500 border-gray-600 bg-gray-800 rounded"
                />
                <label htmlFor="requires_task" className="ml-2 text-sm text-gray-300">
                  Requires Task
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-800">
              <div className="flex justify-end space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
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
    </div>
  );
}