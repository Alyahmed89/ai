'use client';

import { useState, useEffect } from 'react';

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
}

interface FlowStep {
  id: string;
  flow_id: string;
  step_key: string;
  title: string;
  instructions: string;
  step_type: string;
  order_index: number;
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
  step_number: number;
  requires_task: number;
}

interface EditFlowModalProps {
  flowId: string;
  onClose: () => void;
  onFlowUpdated: (flowId: string) => void;
}

export default function EditFlowModal({ flowId, onClose, onFlowUpdated }: EditFlowModalProps) {
  const [flowDefinition, setFlowDefinition] = useState<FlowDefinition | null>(null);
  const [flowSteps, setFlowSteps] = useState<FlowStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    max_iterations: 10,
    priority: 10,
    agent: 'deepseek' as 'deepseek' | 'openhands'
  });

  // Fetch flow definition and steps
  useEffect(() => {
    fetchFlowData();
  }, [flowId]);

  const fetchFlowData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch flow definition
      const flowResponse = await fetch(`/api/proxy/api/flow-definitions/${flowId}`);
      if (!flowResponse.ok) throw new Error('Failed to fetch flow definition');
      
      const flowData = await flowResponse.json();
      
      // Check if response has success field (some APIs wrap data)
      if (flowData.success !== undefined) {
        if (!flowData.success) throw new Error(flowData.error || 'Failed to fetch flow definition');
        setFlowDefinition(flowData.data);
        setFormData({
          name: flowData.data.name,
          description: flowData.data.description,
          max_iterations: flowData.data.max_iterations,
          priority: flowData.data.priority,
          agent: flowData.data.agent
        });
      } else {
        // Direct flow definition object
        setFlowDefinition(flowData);
        setFormData({
          name: flowData.name,
          description: flowData.description,
          max_iterations: flowData.max_iterations,
          priority: flowData.priority,
          agent: flowData.agent
        });
      }

      // Fetch flow steps
      const stepsResponse = await fetch(`/api/proxy/api/flow-steps?flow_id=${flowId}`);
      if (!stepsResponse.ok) throw new Error('Failed to fetch flow steps');
      
      const stepsData = await stepsResponse.json();
      
      // Handle different response formats for steps
      let stepsArray = [];
      if (stepsData.success !== undefined && stepsData.data) {
        stepsArray = stepsData.data;
      } else if (Array.isArray(stepsData)) {
        stepsArray = stepsData;
      } else if (stepsData.data && Array.isArray(stepsData.data)) {
        stepsArray = stepsData.data;
      }
      
      // Filter steps for this flow and sort by order_index
      const filteredSteps = stepsArray
        .filter((step: any) => step.flow_id === flowId)
        .sort((a: any, b: any) => a.order_index - b.order_index);
      setFlowSteps(filteredSteps);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load flow data');
      console.error('Error fetching flow data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'max_iterations' || name === 'priority' ? parseInt(value) || 0 : value
    }));
  };

  const handleAgentChange = (agent: 'deepseek' | 'openhands') => {
    setFormData(prev => ({ ...prev, agent }));
  };

  const handleSave = async () => {
    if (!flowDefinition) return;
    
    setSaving(true);
    setError(null);
    
    try {
      // Update flow definition
      const response = await fetch(`/api/proxy/api/flow-definitions/${flowId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) throw new Error('Failed to update flow');
      
      const data = await response.json();
      
      // Check response format
      if (data.success !== undefined) {
        if (!data.success) throw new Error(data.error || 'Failed to update flow');
      }
      
      onFlowUpdated(flowId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
      console.error('Error saving flow:', err);
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
              <h3 className="text-lg font-semibold text-gray-100">Edit Flow</h3>
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
              <p className="text-gray-400 mt-4">Loading flow data...</p>
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
            <h3 className="text-lg font-semibold text-gray-100">Edit Flow: {flowDefinition?.name || flowId}</h3>
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
              <label className="block text-sm font-medium text-gray-400 mb-2">Flow Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-100"
                placeholder="Enter flow name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-100 resize-none"
                placeholder="Enter flow description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Max Iterations</label>
                <input
                  type="number"
                  name="max_iterations"
                  value={formData.max_iterations}
                  onChange={handleInputChange}
                  min="1"
                  max="100"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Priority</label>
                <input
                  type="number"
                  name="priority"
                  value={formData.priority}
                  onChange={handleInputChange}
                  min="1"
                  max="100"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Agent</label>
              <div className="flex space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    checked={formData.agent === 'deepseek'}
                    onChange={() => handleAgentChange('deepseek')}
                    className="h-4 w-4 text-blue-500 focus:ring-blue-500 border-gray-600 bg-gray-800"
                  />
                  <span className="ml-2 text-sm text-gray-300">DeepSeek</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    checked={formData.agent === 'openhands'}
                    onChange={() => handleAgentChange('openhands')}
                    className="h-4 w-4 text-blue-500 focus:ring-blue-500 border-gray-600 bg-gray-800"
                  />
                  <span className="ml-2 text-sm text-gray-300">OpenHands</span>
                </label>
              </div>
            </div>

            {/* Flow Steps Section */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-400">Flow Steps</label>
                <span className="text-xs text-gray-500">{flowSteps.length} step(s)</span>
              </div>
              
              <div className="space-y-3">
                {flowSteps.map((step, index) => (
                  <div key={step.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <h4 className="text-sm font-medium text-gray-300">Step {step.order_index}: {step.title}</h4>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded">{step.step_type}</span>
                          {step.blocking === 1 && (
                            <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded">Blocking</span>
                          )}
                          {step.retryable === 1 && (
                            <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">Retryable</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Instructions</label>
                        <div className="text-sm text-gray-300 bg-gray-900/50 p-3 rounded border border-gray-700 whitespace-pre-wrap">
                          {step.instructions}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Step Key</label>
                          <div className="text-sm text-gray-300 bg-gray-900/50 p-2 rounded border border-gray-700">
                            {step.step_key}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Order</label>
                          <div className="text-sm text-gray-300 bg-gray-900/50 p-2 rounded border border-gray-700">
                            {step.order_index}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {flowSteps.length === 0 && (
                  <div className="text-center py-6 border border-dashed border-gray-700 rounded-lg">
                    <p className="text-gray-400 text-sm">No steps defined for this flow</p>
                    <p className="text-gray-500 text-xs mt-1">Add steps via the API or backend interface</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-6 border-t border-gray-800 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                Saving...
              </>
            ) : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}