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
  instructions: string;
  inputEndpointId: string;
  outputEndpointId: string;
  condition: string;
  order: number;
}

interface SimpleFlowCreatorProps {
  onClose: () => void;
  onFlowCreated: (flowId: string) => void;
}

export default function SimpleFlowCreator({ onClose, onFlowCreated }: SimpleFlowCreatorProps) {
  const [step, setStep] = useState<'flow' | 'steps'>('flow');
  const [flowName, setFlowName] = useState('');
  const [agent, setAgent] = useState<'openhands' | 'deepseek'>('deepseek');
  const [steps, setSteps] = useState<FlowStep[]>([
    { id: '1', instructions: '', inputEndpointId: '', outputEndpointId: '', condition: '', order: 1 }
  ]);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingFlow, setCreatingFlow] = useState(false);

  // Fetch available endpoints
  useEffect(() => {
    fetchEndpoints();
  }, []);

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

  const createFlow = async () => {
    if (!flowName.trim()) {
      setError('Flow name is required');
      return;
    }

    setCreatingFlow(true);
    setError(null);

    try {
      // Create flow definition
      const flowResponse = await fetch('/api/proxy/api/flow-definitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: flowName,
          description: `Flow created via chat UI with ${agent} agent`,
          max_iterations: 10,
          repository: '[MANUAL]',
          branch: '[MANUAL]',
          priority: 10,
          agent: agent
        }),
      });

      const flowResult = await flowResponse.json();

      if (!flowResponse.ok) {
        throw new Error(flowResult.error || 'Failed to create flow');
      }

      const flowId = flowResult.data?.id;
      if (!flowId) {
        throw new Error('No flow ID returned');
      }

      // Create steps
      for (const step of steps) {
        if (!step.instructions.trim()) continue;

        const stepResponse = await fetch('/api/proxy/api/flow-steps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            flow_id: flowId,
            step_key: `step_${step.order}`,
            title: `Step ${step.order}`,
            instructions: step.instructions,
            step_type: 'execution',
            order_index: step.order,
            blocking: true,
            auto_fail_on_error: false,
            retryable: true,
            input_keys: step.inputEndpointId ? JSON.stringify([{
              key: 'input_data',
              endpoint_ref: step.inputEndpointId
            }]) : null,
            output: true,
            output_url: step.outputEndpointId ? `endpoint://${step.outputEndpointId}` : null,
            requires_task: false
          }),
        });

        if (!stepResponse.ok) {
          const stepError = await stepResponse.json();
          console.error('Failed to create step:', stepError);
        }

        // Create condition if specified
        if (step.condition.trim()) {
          const conditionResponse = await fetch('/api/proxy/api/flow-step-conditions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              flow_id: flowId,
              step_id: `step_${step.order}`,
              condition_type: 'custom',
              condition_value: step.condition,
              priority: step.order,
              description: `Condition for step ${step.order}`
            }),
          });

          if (!conditionResponse.ok) {
            const conditionError = await conditionResponse.json();
            console.error('Failed to create condition:', conditionError);
          }
        }
      }

      onFlowCreated(flowId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setCreatingFlow(false);
    }
  };

  const addStep = () => {
    setSteps(prev => [
      ...prev,
      { id: Date.now().toString(), instructions: '', inputEndpointId: '', outputEndpointId: '', condition: '', order: prev.length + 1 }
    ]);
  };

  const removeStep = (id: string) => {
    if (steps.length > 1) {
      setSteps(prev => {
        const newSteps = prev.filter(step => step.id !== id);
        // Reorder steps
        return newSteps.map((step, index) => ({ ...step, order: index + 1 }));
      });
    }
  };

  const updateStep = (id: string, field: keyof FlowStep, value: string) => {
    setSteps(prev => prev.map(step => 
      step.id === id ? { ...step, [field]: value } : step
    ));
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 border border-gray-800 rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-100">
              {step === 'flow' ? 'Create New Flow' : 'Add Steps'}
            </h3>
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

          {step === 'flow' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Flow Name
                </label>
                <input
                  type="text"
                  value={flowName}
                  onChange={(e) => setFlowName(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-100"
                  placeholder="Enter flow name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Agent
                </label>
                <div className="flex space-x-4">
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      checked={agent === 'deepseek'}
                      onChange={() => setAgent('deepseek')}
                      className="h-4 w-4 text-blue-500 focus:ring-blue-500 border-gray-600 bg-gray-800"
                    />
                    <span className="ml-2 text-sm text-gray-300">DeepSeek</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      checked={agent === 'openhands'}
                      onChange={() => setAgent('openhands')}
                      className="h-4 w-4 text-blue-500 focus:ring-blue-500 border-gray-600 bg-gray-800"
                    />
                    <span className="ml-2 text-sm text-gray-300">OpenHands</span>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-800">
                <button
                  onClick={() => setStep('steps')}
                  className="w-full inline-flex justify-center items-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                >
                  Next: Add Steps
                  <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-4">
                {steps.map((stepItem) => (
                  <div key={stepItem.id} className="border border-gray-800 rounded-lg p-4 bg-gray-900/50">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-sm font-medium text-gray-200">Step {stepItem.order}</h4>
                      {steps.length > 1 && (
                        <button
                          onClick={() => removeStep(stepItem.id)}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">
                          Instructions
                        </label>
                        <textarea
                          value={stepItem.instructions}
                          onChange={(e) => updateStep(stepItem.id, 'instructions', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-100 text-sm"
                          rows={2}
                          placeholder="What should this step do?"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            Input Endpoint
                          </label>
                          <select
                            value={stepItem.inputEndpointId}
                            onChange={(e) => updateStep(stepItem.id, 'inputEndpointId', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-100 text-sm"
                          >
                            <option value="">Select input endpoint</option>
                            {endpoints.map(endpoint => (
                              <option key={endpoint.id} value={endpoint.id}>
                                {endpoint.name} ({endpoint.method} {endpoint.url})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            Output Endpoint
                          </label>
                          <select
                            value={stepItem.outputEndpointId}
                            onChange={(e) => updateStep(stepItem.id, 'outputEndpointId', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-100 text-sm"
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

                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">
                          Condition (Optional)
                        </label>
                        <input
                          type="text"
                          value={stepItem.condition}
                          onChange={(e) => updateStep(stepItem.id, 'condition', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-100 text-sm"
                          placeholder="e.g., response.status === 'success'"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={addStep}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-700 text-sm font-medium rounded-lg text-gray-300 bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Another Step
              </button>

              <div className="pt-4 border-t border-gray-800 flex justify-between">
                <button
                  onClick={() => setStep('flow')}
                  className="inline-flex items-center px-4 py-2 border border-gray-700 text-sm font-medium rounded-lg text-gray-300 bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                >
                  <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                <button
                  onClick={createFlow}
                  disabled={creatingFlow || !flowName.trim()}
                  className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingFlow ? (
                    <>
                      <svg className="animate-spin mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Creating...
                    </>
                  ) : (
                    'Create Flow'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}