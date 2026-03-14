'use client';

import { useState, useEffect } from 'react';

interface Node {
  id: string;
  title: string;
  type: string;
  status: string;
  created_at: number;
}

interface NodeParentProps {
  nodeId: string;
}

export default function NodeParent({ nodeId }: NodeParentProps) {
  const [parent, setParent] = useState<Node | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchParent();
  }, [nodeId]);

  const fetchParent = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/proxy/graph/nodes/${nodeId}/parent`);
      if (!response.ok) {
        throw new Error('Failed to fetch parent');
      }
      const result = await response.json();
      if (result.success) {
        setParent(result.data || null);
      } else {
        throw new Error(result.error || 'Failed to fetch parent');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'document': return 'bg-blue-100 text-blue-800';
      case 'code': return 'bg-green-100 text-green-800';
      case 'api': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
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
            <h3 className="text-sm font-medium text-red-800">Error loading parent</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!parent) {
    return (
      <div className="text-center py-4">
        <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="mt-1 text-sm font-medium text-gray-900">No parent node</h3>
        <p className="mt-1 text-sm text-gray-500">This node doesn't have a parent.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
              parent.type === 'document' ? 'bg-blue-100' :
              parent.type === 'code' ? 'bg-green-100' :
              parent.type === 'api' ? 'bg-purple-100' :
              'bg-gray-100'
            }`}>
              <span className={`text-sm font-medium ${
                parent.type === 'document' ? 'text-blue-800' :
                parent.type === 'code' ? 'text-green-800' :
                parent.type === 'api' ? 'text-purple-800' :
                'text-gray-800'
              }`}>
                {parent.type.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900">{parent.title}</div>
            <div className="text-sm text-gray-500">ID: {parent.id}</div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getTypeColor(parent.type)}`}>
            {parent.type}
          </span>
          <a href={`/nodes/${parent.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-500">
            View →
          </a>
        </div>
      </div>
      <div className="mt-2 text-sm text-gray-500">
        Created: {new Date(parent.created_at * 1000).toLocaleDateString()}
      </div>
    </div>
  );
}