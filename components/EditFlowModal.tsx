'use client';

import { useState, useEffect } from 'react';
import Modal from './ui/Modal';
import { FlowDefinition, FlowStep } from '@/types';

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
    agent: 'deepseek' as 'deepseek' | 'openhands',
    system_message: ''
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
          agent: flowData.data.agent,
          system_message: flowData.data.system_message || ''
        });
      } else {
        // Direct flow definition object
        setFlowDefinition(flowData);
        setFormData({
          name: flowData.name,
          agent: flowData.agent,
          system_message: flowData.system_message || ''
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
      [name]: value
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
      // Prepare payload - include system_message only when agent is deepseek
      const payload: any = {
        name: formData.name,
        agent: formData.agent
      };
      
      // Include system message only when agent is deepseek
      if (formData.agent === 'deepseek' && formData.system_message.trim()) {
        payload.system_message = formData.system_message.trim();
      }
      
      // Update flow definition
      const response = await fetch(`/api/proxy/api/flow-definitions/${flowId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
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
      <Modal onClose={onClose}>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Edit Flow</h3>
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
              <p className="text-neutral-400 mt-4">Loading flow data...</p>
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
          <h3 className="text-lg font-semibold">Edit Flow: {flowDefinition?.name || flowId}</h3>
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
              <label className="block text-sm font-medium text-neutral-400 mb-2">Flow Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent text-neutral-100"
                placeholder="Enter flow name"
              />
            </div>



            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">Agent</label>
              <div className="flex space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    checked={formData.agent === 'deepseek'}
                    onChange={() => handleAgentChange('deepseek')}
                    className="h-4 w-4 text-gray-500 focus:ring-gray-500 border-neutral-600 bg-neutral-800"
                  />
                  <span className="ml-2 text-sm text-neutral-300">DeepSeek</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    checked={formData.agent === 'openhands'}
                    onChange={() => handleAgentChange('openhands')}
                    className="h-4 w-4 text-gray-500 focus:ring-gray-500 border-neutral-600 bg-neutral-800"
                  />
                  <span className="ml-2 text-sm text-neutral-300">OpenHands</span>
                </label>
              </div>
            </div>

            {formData.agent === 'deepseek' && (
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">
                  System Message (DeepSeek only)
                </label>
                <textarea
                  name="system_message"
                  value={formData.system_message}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent text-neutral-100 resize-none"
                  placeholder="You are an expert software developer..."
                />
                <p className="mt-1 text-xs text-neutral-500">
                  Optional system message for DeepSeek agent. This will be included in the flow definition.
                </p>
              </div>
            )}

            {/* Flow Steps Section */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-neutral-400">Flow Steps</label>
                <span className="text-xs text-neutral-500">{flowSteps.length} step(s)</span>
              </div>
              
              <div className="space-y-3">
                {flowSteps.map((step, index) => (
                  <div key={step.id} className="bg-neutral-800 border border-neutral-700 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <h4 className="text-sm font-medium text-neutral-300">Step {step.order_index}: {step.title}</h4>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs px-2 py-1 bg-gray-500/20 text-gray-400 rounded">{step.step_type}</span>
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
                        <label className="block text-xs text-neutral-400 mb-1">Instructions</label>
                        <div className="text-sm text-neutral-300 bg-neutral-900/50 p-3 rounded border border-neutral-700 whitespace-pre-wrap">
                          {step.instructions}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-neutral-400 mb-1">Step Key</label>
                          <div className="text-sm text-neutral-300 bg-neutral-900/50 p-2 rounded border border-neutral-700">
                            {step.step_key}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-neutral-400 mb-1">Order</label>
                          <div className="text-sm text-neutral-300 bg-neutral-900/50 p-2 rounded border border-neutral-700">
                            {step.order_index}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {flowSteps.length === 0 && (
                  <div className="text-center py-6 border border-dashed border-neutral-700 rounded-lg">
                    <p className="text-neutral-400 text-sm">No steps defined for this flow</p>
                    <p className="text-neutral-500 text-xs mt-1">Add steps via the API or backend interface</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="pt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                Saving...
              </>
            ) : 'Save Changes'}
          </button>
        </div>
      </Modal>
  );
}