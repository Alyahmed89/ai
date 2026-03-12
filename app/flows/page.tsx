'use client';

import { useState, useEffect } from 'react';
import { parseApiResponse } from '@/lib/api-utils';

interface Flow {
  id: string;
  name: string;
  description: string;
  steps: number;
  created_at: string;
  updated_at: string;
}

export default function FlowsPage() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFlows();
  }, []);

  const fetchFlows = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/flows');
      if (!response.ok) {
        throw new Error('Failed to fetch flows');
      }
      const data = await response.json();
      const parsedData = parseApiResponse<Flow>(data);
      setFlows(parsedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
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
            <h3 className="text-sm font-medium text-red-800">Error loading flows</h3>
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
        <h1 className="text-3xl font-bold text-gray-900">Flows</h1>
        <button
          onClick={fetchFlows}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Refresh
        </button>
      </div>

      {flows.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No flows</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new flow.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {flows.map((flow) => (
            <div key={flow.id} className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-md bg-purple-500 flex items-center justify-center">
                      <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">{flow.name}</h3>
                    <p className="text-sm text-gray-500">ID: {flow.id}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-gray-600">{flow.description}</p>
                </div>
                <div className="mt-4 flex items-center">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="ml-2 text-sm text-gray-500">{flow.steps} steps</span>
                </div>
                <div className="mt-4 flex justify-between text-sm text-gray-500">
                  <span>Created: {new Date(flow.created_at).toLocaleDateString()}</span>
                  <span>Updated: {new Date(flow.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="bg-gray-50 px-5 py-3">
                <div className="text-sm flex justify-between">
                  <a href={`/flows/${flow.id}`} className="font-medium text-blue-600 hover:text-blue-500">
                    View details
                  </a>
                  <a href={`/flow-runs?flow_id=${flow.id}`} className="font-medium text-green-600 hover:text-green-500">
                    View runs
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}