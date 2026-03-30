'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import NodeChildren from '@/components/nodes/NodeChildren';
import NodeParent from '@/components/nodes/NodeParent';
import NodeLinks from '@/components/nodes/NodeLinks';
import NodeRelationships from '@/components/nodes/NodeRelationships';
import NodeDependencies from '@/components/nodes/NodeDependencies';

export const runtime = 'edge';

interface Node {
  id: string;
  project_id: string;
  title: string;
  content: string;
  type: string;
  status: string;
  created_at: number;
  updated_at: number;
  metadata: string | null;
  deleted_at: number | null;
}

export default function NodeDetailPage() {
  const params = useParams();
  const nodeId = params.id as string;
  
  const [node, setNode] = useState<Node | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'children' | 'links' | 'relationships' | 'dependencies'>('details');

  useEffect(() => {
    if (nodeId) {
      fetchNode();
    }
  }, [nodeId]);

  const fetchNode = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/proxy/graph/nodes/${nodeId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch node');
      }
      const result = await response.json();
      if (result.success) {
        setNode(result.data);
      } else {
        throw new Error(result.error || 'Failed to fetch node');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600"></div>
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
            <h3 className="text-sm font-medium text-red-800">Error loading node</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!node) {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">Node not found</h3>
        <p className="mt-1 text-sm text-gray-500">The node you're looking for doesn't exist.</p>
      </div>
    );
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'document': return 'bg-gray-100 text-gray-800';
      case 'code': return 'bg-green-100 text-green-800';
      case 'api': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'archived': return 'bg-gray-100 text-gray-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link href="/nodes" className="text-sm font-medium text-gray-600 hover:text-gray-500">
          ← Back to Nodes
        </Link>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{node.title}</h1>
              <p className="mt-1 text-sm text-gray-500">ID: {node.id}</p>
            </div>
            <div className="flex space-x-2">
              <span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${getTypeColor(node.type)}`}>
                {node.type}
              </span>
              <span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${getStatusColor(node.status)}`}>
                {node.status}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-4" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('details')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'details'
                  ? 'border-gray-500 text-gray-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab('children')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'children'
                  ? 'border-gray-500 text-gray-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Children
            </button>
            <button
              onClick={() => setActiveTab('links')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'links'
                  ? 'border-gray-500 text-gray-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Links
            </button>
            <button
              onClick={() => setActiveTab('relationships')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'relationships'
                  ? 'border-gray-500 text-gray-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Relationships
            </button>
            <button
              onClick={() => setActiveTab('dependencies')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'dependencies'
                  ? 'border-gray-500 text-gray-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Dependencies
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="px-4 py-5 sm:p-6">
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Content</h3>
                <div className="mt-2 bg-gray-50 rounded-lg p-4">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap">{node.content}</pre>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
                  <dl className="mt-2 space-y-2">
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-gray-500">Project ID</dt>
                      <dd className="text-sm text-gray-900">{node.project_id}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-gray-500">Created</dt>
                      <dd className="text-sm text-gray-900">{new Date(node.created_at * 1000).toLocaleString()}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-gray-500">Updated</dt>
                      <dd className="text-sm text-gray-900">{new Date(node.updated_at * 1000).toLocaleString()}</dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900">Metadata</h3>
                  <div className="mt-2 bg-gray-50 rounded-lg p-4">
                    {node.metadata ? (
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap">{node.metadata}</pre>
                    ) : (
                      <p className="text-sm text-gray-500 italic">No metadata</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Parent Section */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Parent Node</h3>
                <NodeParent nodeId={nodeId} />
              </div>
            </div>
          )}

          {activeTab === 'children' && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Child Nodes</h3>
              <NodeChildren nodeId={nodeId} />
            </div>
          )}

          {activeTab === 'links' && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Node Links</h3>
              <NodeLinks nodeId={nodeId} />
            </div>
          )}

          {activeTab === 'relationships' && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Node Relationships</h3>
              <NodeRelationships nodeId={nodeId} />
            </div>
          )}

          {activeTab === 'dependencies' && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Node Dependencies</h3>
              <NodeDependencies nodeId={nodeId} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}