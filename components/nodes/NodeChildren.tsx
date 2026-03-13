'use client';

import { useState, useEffect } from 'react';

interface Node {
  id: string;
  title: string;
  type: string;
  status: string;
  created_at: number;
}

interface NodeChildrenProps {
  nodeId: string;
}

export default function NodeChildren({ nodeId }: NodeChildrenProps) {
  const [children, setChildren] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchChildren();
  }, [nodeId]);

  const fetchChildren = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/nodes/${nodeId}/children`);
      if (!response.ok) {
        throw new Error('Failed to fetch children');
      }
      const result = await response.json();
      if (result.success) {
        setChildren(result.data || []);
      } else {
        throw new Error(result.error || 'Failed to fetch children');
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
            <h3 className="text-sm font-medium text-red-800">Error loading children</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="text-center py-8">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No child nodes</h3>
        <p className="mt-1 text-sm text-gray-500">This node doesn't have any children.</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      <ul className="divide-y divide-gray-200">
        {children.map((child) => (
          <li key={child.id}>
            <div className="px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                      child.type === 'document' ? 'bg-blue-100' :
                      child.type === 'code' ? 'bg-green-100' :
                      child.type === 'api' ? 'bg-purple-100' :
                      'bg-gray-100'
                    }`}>
                      <span className={`text-sm font-medium ${
                        child.type === 'document' ? 'text-blue-800' :
                        child.type === 'code' ? 'text-green-800' :
                        child.type === 'api' ? 'text-purple-800' :
                        'text-gray-800'
                      }`}>
                        {child.type.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">{child.title}</div>
                    <div className="text-sm text-gray-500">ID: {child.id}</div>
                  </div>
                </div>
                <div className="ml-2 flex-shrink-0 flex">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getTypeColor(child.type)}`}>
                    {child.type}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex justify-between text-sm text-gray-500">
                <span>Created: {new Date(child.created_at * 1000).toLocaleDateString()}</span>
                <a href={`/nodes/${child.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-500">
                  View →
                </a>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}