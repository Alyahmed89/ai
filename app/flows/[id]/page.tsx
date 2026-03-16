'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { parseApiResponse } from '@/lib/api-utils';

export const runtime = 'edge';

interface FlowDefinition {
  id: string;
  name: string;
  description: string | null;
  max_iterations: number;
  repository: string | null;
  branch: string | null;
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
  page_key: string | null;
  blocking: number;
  auto_fail_on_error: number;
  retryable: number;
  created_at: string;
  updated_at: string;
  task_id: string | null;
  output_keys: string | null;
  output_url: string | null;
  output_payload_template: string | null;
  default_next_step: string | null;
  output_auth_token: string | null;
  input_keys: string | null;
  output: number;
  default_next_step_id: string | null;
  step_number: number | null;
  requires_task: number;
}

export default function FlowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [flowId, setFlowId] = useState<string | null>(null);
  
  const [flow, setFlow] = useState<FlowDefinition | null>(null);
  const [steps, setSteps] = useState<FlowStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchParams = async () => {
      const resolvedParams = await params;
      const id = resolvedParams?.id as string;
      setFlowId(id);
    };
    fetchParams();
  }, [params]);

  useEffect(() => {
    if (flowId) {
      fetchFlowDetails();
    }
  }, [flowId]);

  const fetchFlowDetails = async () => {
    try {
      setLoading(true);
      
      // Fetch flow definition
      const flowResponse = await fetch(`/api/proxy/api/flow-definitions`);
      if (!flowResponse.ok) {
        throw new Error('Failed to fetch flow definition');
      }
      const flowData = await flowResponse.json();
      const flowDefinitions = parseApiResponse<FlowDefinition>(flowData);
      const currentFlow = flowDefinitions.find(f => f.id === flowId);
      
      if (!currentFlow) {
        throw new Error('Flow not found');
      }
      setFlow(currentFlow);
      
      // Fetch flow steps
      const stepsResponse = await fetch(`/api/proxy/api/flow-steps?flow_id=${flowId}`);
      if (!stepsResponse.ok) {
        throw new Error('Failed to fetch flow steps');
      }
      const stepsData = await stepsResponse.json();
      
      if (stepsData.success && stepsData.data) {
        // Sort steps by order_index
        const sortedSteps = stepsData.data.sort((a: FlowStep, b: FlowStep) => 
          a.order_index - b.order_index
        );
        setSteps(sortedSteps);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading flow details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading flow</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <Link href="/flows" className="text-blue-600 hover:text-blue-800">
            ← Back to Flows
          </Link>
        </div>
      </div>
    );
  }

  if (!flow) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Flow not found</h3>
          <p className="mt-2 text-sm text-gray-500">The flow you're looking for doesn't exist.</p>
          <div className="mt-4">
            <Link href="/flows" className="text-blue-600 hover:text-blue-800">
              ← Back to Flows
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link href="/flows" className="text-blue-600 hover:text-blue-800 flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Flows
        </Link>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
        <div className="px-4 py-5 sm:px-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">{flow.name}</h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                {flow.description || 'No description provided'}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                flow.priority >= 8 ? 'bg-red-100 text-red-800' :
                flow.priority >= 5 ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }`}>
                Priority: {flow.priority}
              </span>
              <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                {flow.agent}
              </span>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
          <dl className="sm:divide-y sm:divide-gray-200">
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Flow ID</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 font-mono">{flow.id}</dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Repository</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {flow.repository ? (
                  <span className="font-mono">{flow.repository}</span>
                ) : (
                  <span className="text-gray-400">Not specified</span>
                )}
              </dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Branch</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {flow.branch ? (
                  <span className="font-mono">{flow.branch}</span>
                ) : (
                  <span className="text-gray-400">Not specified</span>
                )}
              </dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Max Iterations</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{flow.max_iterations}</dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Next Flow</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {flow.next_flow_id ? (
                  <Link href={`/flows/${flow.next_flow_id}`} className="text-blue-600 hover:text-blue-800">
                    {flow.next_flow_id}
                  </Link>
                ) : (
                  <span className="text-gray-400">None</span>
                )}
              </dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Created</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{formatDate(flow.created_at)}</dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{formatDate(flow.updated_at)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">Flow Steps ({steps.length})</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Steps are executed in order from top to bottom
            </p>
          </div>
          <button
            onClick={() => window.location.href = `/flows/${flowId}/steps/create`}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Step
          </button>
        </div>
        
        {steps.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">
            No steps defined for this flow
          </div>
        ) : (
          <div className="border-t border-gray-200">
            <ul className="divide-y divide-gray-200">
              {steps.map((step, index) => (
                <li key={step.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-800 font-medium">{step.order_index}</span>
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center">
                          <h4 className="text-sm font-medium text-gray-900">{step.title}</h4>
                          <span className="ml-2 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                            {step.step_type}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{step.instructions}</p>
                        <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                          <span>Key: <code className="font-mono">{step.step_key}</code></span>
                          {step.blocking === 1 && (
                            <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-800 rounded">Blocking</span>
                          )}
                          {step.auto_fail_on_error === 1 && (
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-800 rounded">Auto-fail on error</span>
                          )}
                          {step.retryable === 1 && (
                            <span className="px-1.5 py-0.5 bg-green-100 text-green-800 rounded">Retryable</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {step.default_next_step && (
                        <div className="text-right">
                          <span className="text-gray-400">Next: </span>
                          <span className="font-medium">{step.default_next_step}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}