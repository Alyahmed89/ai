'use client';

import { useState, useEffect } from 'react';

interface Relationship {
  id: string;
  source_id: string;
  target_id: string;
  type: string;
  metadata: string | null;
  created_at: number;
}

interface NodeRelationshipsProps {
  nodeId: string;
}

export default function NodeRelationships({ nodeId }: NodeRelationshipsProps) {
  const [relationships, setRelationships] = useState<{ outgoing: Relationship[], incoming: Relationship[] }>({ outgoing: [], incoming: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRelationships();
  }, [nodeId]);

  const fetchRelationships = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/proxy/graph/nodes/${nodeId}/relationships`);
      if (!response.ok) {
        throw new Error('Failed to fetch relationships');
      }
      const result = await response.json();
      if (result.success) {
        setRelationships(result.data || { outgoing: [], incoming: [] });
      } else {
        throw new Error(result.error || 'Failed to fetch relationships');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getRelationshipTypeColor = (type: string) => {
    switch (type) {
      case 'parent_child': return 'bg-blue-100 text-blue-800';
      case 'sibling': return 'bg-green-100 text-green-800';
      case 'dependency': return 'bg-purple-100 text-purple-800';
      case 'reference': return 'bg-yellow-100 text-yellow-800';
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
            <h3 className="text-sm font-medium text-red-800">Error loading relationships</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalRelationships = relationships.outgoing.length + relationships.incoming.length;

  if (totalRelationships === 0) {
    return (
      <div className="text-center py-8">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No relationships</h3>
        <p className="mt-1 text-sm text-gray-500">This node doesn't have any relationships.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Outgoing Relationships */}
      {relationships.outgoing.length > 0 && (
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-3">Outgoing Relationships ({relationships.outgoing.length})</h4>
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {relationships.outgoing.map((relationship) => (
                <li key={relationship.id}>
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          Relationship to: {relationship.target_id}
                        </div>
                        <div className="text-sm text-gray-500">
                          Type: <span className={`px-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRelationshipTypeColor(relationship.type)}`}>
                            {relationship.type}
                          </span>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        Created: {new Date(relationship.created_at * 1000).toLocaleDateString()}
                      </div>
                    </div>
                    {relationship.metadata && (
                      <div className="mt-2 text-sm text-gray-600">
                        Metadata: {relationship.metadata}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Incoming Relationships */}
      {relationships.incoming.length > 0 && (
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-3">Incoming Relationships ({relationships.incoming.length})</h4>
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {relationships.incoming.map((relationship) => (
                <li key={relationship.id}>
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          Relationship from: {relationship.source_id}
                        </div>
                        <div className="text-sm text-gray-500">
                          Type: <span className={`px-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRelationshipTypeColor(relationship.type)}`}>
                            {relationship.type}
                          </span>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        Created: {new Date(relationship.created_at * 1000).toLocaleDateString()}
                      </div>
                    </div>
                    {relationship.metadata && (
                      <div className="mt-2 text-sm text-gray-600">
                        Metadata: {relationship.metadata}
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