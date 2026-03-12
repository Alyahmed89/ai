'use client';

import { useState, useEffect } from 'react';

interface Node {
  id: string;
  title: string;
  content: string;
  type: string;
  created_at: string;
  updated_at: string;
}

export default function NodesPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchNodes();
  }, []);

  const fetchNodes = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/nodes');
      if (!response.ok) {
        throw new Error('Failed to fetch nodes');
      }
      const data = await response.json();
      setNodes(data);
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
            <h3 className="text-sm font-medium text-red-800">Error loading nodes</h3>
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
        <h1 className="text-3xl font-bold text-gray-900">Nodes</h1>
        <button
          onClick={fetchNodes}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Refresh
        </button>
      </div>

      {nodes.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No nodes</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new node.</p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {nodes.map((node) => (
              <li key={node.id}>
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                          node.type === 'document' ? 'bg-blue-100' :
                          node.type === 'code' ? 'bg-green-100' :
                          node.type === 'api' ? 'bg-purple-100' :
                          'bg-gray-100'
                        }`}>
                          <span className={`text-sm font-medium ${
                            node.type === 'document' ? 'text-blue-800' :
                            node.type === 'code' ? 'text-green-800' :
                            node.type === 'api' ? 'text-purple-800' :
                            'text-gray-800'
                          }`}>
                            {node.type.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{node.title}</div>
                        <div className="text-sm text-gray-500">ID: {node.id}</div>
                      </div>
                    </div>
                    <div className="ml-2 flex-shrink-0 flex">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        node.type === 'document' ? 'bg-blue-100 text-blue-800' :
                        node.type === 'code' ? 'bg-green-100 text-green-800' :
                        node.type === 'api' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {node.type}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="text-sm text-gray-600 line-clamp-2">{node.content}</div>
                  </div>
                  <div className="mt-2 flex justify-between text-sm text-gray-500">
                    <span>Created: {new Date(node.created_at).toLocaleDateString()}</span>
                    <span>Updated: {new Date(node.updated_at).toLocaleDateString()}</span>
                  </div>
                  <div className="mt-2">
                    <a href={`/nodes/${node.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-500">
                      View details →
                    </a>
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