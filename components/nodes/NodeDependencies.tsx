'use client';

import { useState, useEffect } from 'react';

interface Dependency {
  id: string;
  source_id: string;
  target_id: string;
  type: string;
  metadata: string | null;
  created_at: number;
}

interface NodeDependenciesProps {
  nodeId: string;
}

export default function NodeDependencies({ nodeId }: NodeDependenciesProps) {
  const [dependencies, setDependencies] = useState<{ depends_on: Dependency[], depended_by: Dependency[] }>({ depends_on: [], depended_by: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDependencies();
  }, [nodeId]);

  const fetchDependencies = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/nodes/${nodeId}/dependencies`);
      if (!response.ok) {
        throw new Error('Failed to fetch dependencies');
      }
      const result = await response.json();
      if (result.success) {
        setDependencies(result.data || { depends_on: [], depended_by: [] });
      } else {
        throw new Error(result.error || 'Failed to fetch dependencies');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getDependencyTypeColor = (type: string) => {
    switch (type) {
      case 'hard': return 'bg-red-100 text-red-800';
      case 'soft': return 'bg-yellow-100 text-yellow-800';
      case 'optional': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
            <h3 className="text-sm font-medium text-red-800">Error loading dependencies</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalDependencies = dependencies.depends_on.length + dependencies.depended_by.length;

  if (totalDependencies === 0) {
    return (
      <div className="text-center py-8">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No dependencies</h3>
        <p className="mt-1 text-sm text-gray-500">This node doesn't have any dependencies.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dependencies (depends_on) */}
      {dependencies.depends_on.length > 0 && (
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-3">Depends On ({dependencies.depends_on.length})</h4>
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {dependencies.depends_on.map((dependency) => (
                <li key={dependency.id}>
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          Depends on: {dependency.target_id}
                        </div>
                        <div className="text-sm text-gray-500">
                          Type: <span className={`px-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getDependencyTypeColor(dependency.type)}`}>
                            {dependency.type}
                          </span>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        Created: {new Date(dependency.created_at * 1000).toLocaleDateString()}
                      </div>
                    </div>
                    {dependency.metadata && (
                      <div className="mt-2 text-sm text-gray-600">
                        Metadata: {dependency.metadata}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Dependencies (depended_by) */}
      {dependencies.depended_by.length > 0 && (
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-3">Depended By ({dependencies.depended_by.length})</h4>
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {dependencies.depended_by.map((dependency) => (
                <li key={dependency.id}>
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          Depended by: {dependency.source_id}
                        </div>
                        <div className="text-sm text-gray-500">
                          Type: <span className={`px-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getDependencyTypeColor(dependency.type)}`}>
                            {dependency.type}
                          </span>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        Created: {new Date(dependency.created_at * 1000).toLocaleDateString()}
                      </div>
                    </div>
                    {dependency.metadata && (
                      <div className="mt-2 text-sm text-gray-600">
                        Metadata: {dependency.metadata}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}