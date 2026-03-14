'use client';

import { useState, useEffect } from 'react';

interface Link {
  id: string;
  source_id: string;
  target_id: string;
  type: string;
  metadata: string | null;
  created_at: number;
}

interface NodeLinksProps {
  nodeId: string;
}

export default function NodeLinks({ nodeId }: NodeLinksProps) {
  const [links, setLinks] = useState<{ outgoing: Link[], incoming: Link[] }>({ outgoing: [], incoming: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLinks();
  }, [nodeId]);

  const fetchLinks = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/proxy/graph/nodes/${nodeId}/links`);
      if (!response.ok) {
        throw new Error('Failed to fetch links');
      }
      const result = await response.json();
      if (result.success) {
        setLinks(result.data || { outgoing: [], incoming: [] });
      } else {
        throw new Error(result.error || 'Failed to fetch links');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getLinkTypeColor = (type: string) => {
    switch (type) {
      case 'reference': return 'bg-blue-100 text-blue-800';
      case 'dependency': return 'bg-green-100 text-green-800';
      case 'related': return 'bg-purple-100 text-purple-800';
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
            <h3 className="text-sm font-medium text-red-800">Error loading links</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalLinks = links.outgoing.length + links.incoming.length;

  if (totalLinks === 0) {
    return (
      <div className="text-center py-8">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No links</h3>
        <p className="mt-1 text-sm text-gray-500">This node doesn't have any links.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Outgoing Links */}
      {links.outgoing.length > 0 && (
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-3">Outgoing Links ({links.outgoing.length})</h4>
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {links.outgoing.map((link) => (
                <li key={link.id}>
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          Link to: {link.target_id}
                        </div>
                        <div className="text-sm text-gray-500">
                          Type: <span className={`px-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getLinkTypeColor(link.type)}`}>
                            {link.type}
                          </span>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        Created: {new Date(link.created_at * 1000).toLocaleDateString()}
                      </div>
                    </div>
                    {link.metadata && (
                      <div className="mt-2 text-sm text-gray-600">
                        Metadata: {link.metadata}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Incoming Links */}
      {links.incoming.length > 0 && (
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-3">Incoming Links ({links.incoming.length})</h4>
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {links.incoming.map((link) => (
                <li key={link.id}>
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          Link from: {link.source_id}
                        </div>
                        <div className="text-sm text-gray-500">
                          Type: <span className={`px-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getLinkTypeColor(link.type)}`}>
                            {link.type}
                          </span>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        Created: {new Date(link.created_at * 1000).toLocaleDateString()}
                      </div>
                    </div>
                    {link.metadata && (
                      <div className="mt-2 text-sm text-gray-600">
                        Metadata: {link.metadata}
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