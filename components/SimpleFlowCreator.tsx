'use client';

import { useState } from 'react';
import Modal from './ui/Modal';

interface SimpleFlowCreatorProps {
  onClose: () => void;
  onFlowCreated: (flowId: string) => void;
}

export default function SimpleFlowCreator({ onClose, onFlowCreated }: SimpleFlowCreatorProps) {
  const [flowName, setFlowName] = useState('');
  const [agent, setAgent] = useState<'openhands' | 'deepseek'>('deepseek');
  const [systemMessage, setSystemMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creatingFlow, setCreatingFlow] = useState(false);

  const createFlow = async () => {
    if (!flowName.trim()) {
      setError('Flow name is required');
      return;
    }

    setCreatingFlow(true);
    setError(null);

    try {
      // Create flow definition
      const flowPayload: any = {
        name: flowName,
        description: `Flow created via chat UI with ${agent} agent`,
        max_iterations: 10,
        repository: agent === 'openhands' ? 'openhands' : '[MANUAL]',
        branch: agent === 'openhands' ? 'main' : '[MANUAL]',
        priority: 10,
        agent: agent
      };
      
      // Include system message only when agent is deepseek
      if (agent === 'deepseek' && systemMessage.trim()) {
        flowPayload.system_message = systemMessage.trim();
      }
      
      const flowResponse = await fetch('/api/proxy/api/flow-definitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(flowPayload),
      });

      const flowResult = await flowResponse.json();

      if (!flowResponse.ok) {
        throw new Error(flowResult.error || 'Failed to create flow');
      }

      const flowId = flowResult.data?.id;
      if (!flowId) {
        throw new Error('No flow ID returned');
      }

      onFlowCreated(flowId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setCreatingFlow(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="space-y-6 max-h-[70vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">
            Create New Flow
          </h3>
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
            <label className="block text-sm font-medium text-neutral-400 mb-2">
              Flow Name
            </label>
            <input
              type="text"
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent text-neutral-100"
              placeholder="Enter flow name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-2">
              Agent
            </label>
            <div className="flex space-x-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  checked={agent === 'deepseek'}
                  onChange={() => setAgent('deepseek')}
                  className="h-4 w-4 text-gray-500 focus:ring-gray-500 border-neutral-600 bg-neutral-800"
                />
                <span className="ml-2 text-sm text-neutral-300">DeepSeek</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  checked={agent === 'openhands'}
                  onChange={() => setAgent('openhands')}
                  className="h-4 w-4 text-gray-500 focus:ring-gray-500 border-neutral-600 bg-neutral-800"
                />
                <span className="ml-2 text-sm text-neutral-300">OpenHands</span>
              </label>
            </div>
          </div>

          {agent === 'deepseek' && (
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">
                System Message (DeepSeek only)
              </label>
              <textarea
                value={systemMessage}
                onChange={(e) => setSystemMessage(e.target.value)}
                className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent text-neutral-100"
                rows={3}
                placeholder="You are an expert software developer..."
              />
              <p className="mt-1 text-xs text-neutral-500">
                Optional system message for DeepSeek agent. This will be included in the flow definition.
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-neutral-800">
            <button
              onClick={createFlow}
              disabled={creatingFlow || !flowName.trim()}
              className="w-full inline-flex justify-center items-center px-4 py-2.5 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
      </div>
    </Modal>
  );
}