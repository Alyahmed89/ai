'use client';

export const runtime = 'edge';
import { useState, useEffect } from 'react';
import { parseApiResponse } from '@/lib/api-utils';
import Link from 'next/link';

interface FlowRun {
  id: string;
  flow_id: string;
  status: string;
  input_prompt: string;
  output_response: string;
  started_at: string;
  completed_at: string;
  duration_ms: number;
}

export default function FlowRunsPage() {
  const [flowRuns, setFlowRuns] = useState<FlowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFlowRuns();
  }, []);

  const fetchFlowRuns = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/proxy/api/flow-runs');
      if (!response.ok) {
        throw new Error('Failed to fetch flow runs');
      }
      const data = await response.json();
      setFlowRuns(data);
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading flow runs</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Flow Runs</h1>
        <button
          onClick={fetchFlowRuns}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Refresh
        </button>
      </div>

      {flowRuns.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No flow runs</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by running a flow.</p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {flowRuns.map((flowRun) => (
              <li key={flowRun.id}>
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                          flowRun.status === 'completed' ? 'bg-green-100' :
                          flowRun.status === 'failed' ? 'bg-red-100' :
                          flowRun.status === 'running' ? 'bg-blue-100' :
                          'bg-yellow-100'
                        }`}>
                          <span className={`text-sm font-medium ${
                            flowRun.status === 'completed' ? 'text-green-800' :
                            flowRun.status === 'failed' ? 'text-red-800' :
                            flowRun.status === 'running' ? 'text-blue-800' :
                            'text-yellow-800'
                          }`}>
                            {flowRun.status.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">Flow: {flowRun.flow_id}</div>
                        <div className="text-sm text-gray-500">ID: {flowRun.id}</div>
                      </div>
                    </div>
                    <div className="ml-2 flex-shrink-0 flex">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        flowRun.status === 'completed' ? 'bg-green-100 text-green-800' :
                        flowRun.status === 'failed' ? 'bg-red-100 text-red-800' :
                        flowRun.status === 'running' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {flowRun.status}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="text-sm text-gray-600 line-clamp-2">
                      <span className="font-medium">Input:</span> {flowRun.input_prompt || 'No input'}
                    </div>
                    <div className="mt-1 text-sm text-gray-600 line-clamp-2">
                      <span className="font-medium">Output:</span> {flowRun.output_response || 'No output'}
                    </div>
                  </div>
                  <div className="mt-2 flex justify-between text-sm text-gray-500">
                    <div>
                      <span>Started: {new Date(flowRun.started_at).toLocaleString()}</span>
                      {flowRun.completed_at && (
                        <span className="ml-4">Completed: {new Date(flowRun.completed_at).toLocaleString()}</span>
                      )}
                    </div>
                    {flowRun.duration_ms > 0 && (
                      <span>Duration: {formatDuration(flowRun.duration_ms)}</span>
                    )}
                  </div>
                  <div className="mt-2">
                    <Link 
                      href={`/flow-runs/${flowRun.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-500"
                    >
                      View details with step runs →
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}