'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export const runtime = 'edge';

interface FlowRun {
  id: string;
  flow_id: string;
  status: string;
  input_prompt: string;
  output_response: string;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  stepRuns?: StepRun[];
}

interface StepRun {
  id: string;
  step_id: string;
  prompt: string;
  response: string;
  status: string;
  iteration: number;
  attempt: number;
  duration_ms: number;
  created_at: string;
  input_payload?: string;
  output_payload?: string;
}

export default function FlowRunDetailsPage() {
  const params = useParams();
  const [id, setId] = useState<string | null>(null);
  
  const [flowRun, setFlowRun] = useState<FlowRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchParams = async () => {
      const resolvedParams = await params;
      const flowRunId = resolvedParams?.id as string;
      setId(flowRunId);
    };
    fetchParams();
  }, [params]);

  useEffect(() => {
    if (id) {
      fetchFlowRun();
    }
  }, [id]);

  const fetchFlowRun = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/proxy/api/flow-runs/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch flow run');
      }
      const data = await response.json();
      setFlowRun(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !flowRun) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading flow run</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error || 'Flow run not found'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/flow-runs" className="text-blue-600 hover:text-blue-500">
          ← Back to Flow Runs
        </Link>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Flow Run Details</h1>
          <p className="text-gray-600">ID: {flowRun.id}</p>
        </div>
        <button
          onClick={fetchFlowRun}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Refresh
        </button>
      </div>

      {/* Flow Run Summary */}
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Flow Information</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Flow ID</dt>
                <dd className="mt-1 text-sm text-gray-900">{flowRun.flow_id}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    flowRun.status === 'completed' ? 'bg-green-100 text-green-800' :
                    flowRun.status === 'failed' ? 'bg-red-100 text-red-800' :
                    flowRun.status === 'running' ? 'bg-blue-100 text-blue-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {flowRun.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Duration</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {flowRun.duration_ms > 0 ? formatDuration(flowRun.duration_ms) : 'N/A'}
                </dd>
              </div>
            </dl>
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Timing</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Started</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatDate(flowRun.started_at)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Completed</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {flowRun.completed_at ? formatDate(flowRun.completed_at) : 'Still running'}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Input/Output */}
        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Execution Details</h3>
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Input Prompt</h4>
              <div className="bg-gray-50 rounded-lg p-4">
                <pre className="text-sm text-gray-800 whitespace-pre-wrap">{flowRun.input_prompt || 'No input'}</pre>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Output Response</h4>
              <div className="bg-green-50 rounded-lg p-4">
                <pre className="text-sm text-gray-800 whitespace-pre-wrap">{flowRun.output_response || 'No output'}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step Runs */}
      {flowRun.stepRuns && flowRun.stepRuns.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Step Execution Details ({flowRun.stepRuns.length} steps)</h2>
          
          <div className="space-y-6">
            {flowRun.stepRuns.map((stepRun, index) => (
              <div key={stepRun.id} className="border border-gray-200 rounded-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      Step {index + 1}: {stepRun.step_id || `Step ${stepRun.id.substring(0, 8)}...`}
                    </h3>
                    <div className="flex items-center space-x-4 mt-2">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        stepRun.status === 'completed' ? 'bg-green-100 text-green-800' :
                        stepRun.status === 'failed' ? 'bg-red-100 text-red-800' :
                        stepRun.status === 'running' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {stepRun.status}
                      </span>
                      <span className="text-sm text-gray-500">
                        Iteration: {stepRun.iteration || 0}, Attempt: {stepRun.attempt || 1}
                      </span>
                      {stepRun.duration_ms > 0 && (
                        <span className="text-sm text-gray-500">
                          Duration: {formatDuration(stepRun.duration_ms)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatDate(stepRun.created_at)}
                  </div>
                </div>

                {/* Step Prompt */}
                {stepRun.prompt && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Prompt</h4>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <pre className="text-sm text-gray-800 whitespace-pre-wrap">{stepRun.prompt}</pre>
                    </div>
                  </div>
                )}

                {/* Step Response */}
                {stepRun.response && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Response</h4>
                    <div className="bg-green-50 rounded-lg p-4">
                      <pre className="text-sm text-gray-800 whitespace-pre-wrap">{stepRun.response}</pre>
                    </div>
                  </div>
                )}

                {/* Input/Output Payloads */}
                {(stepRun.input_payload || stepRun.output_payload) && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Technical Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {stepRun.input_payload && (
                        <div>
                          <h5 className="text-xs font-medium text-gray-500 mb-1">Input Payload</h5>
                          <div className="bg-gray-50 rounded p-3">
                            <pre className="text-xs text-gray-600 whitespace-pre-wrap break-all">{stepRun.input_payload}</pre>
                          </div>
                        </div>
                      )}
                      {stepRun.output_payload && (
                        <div>
                          <h5 className="text-xs font-medium text-gray-500 mb-1">Output Payload</h5>
                          <div className="bg-gray-50 rounded p-3">
                            <pre className="text-xs text-gray-600 whitespace-pre-wrap break-all">{stepRun.output_payload}</pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}