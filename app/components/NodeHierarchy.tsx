'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface Node {
  id: string;
  project_id: string;
  type: string;
  title: string;
  content: string;
  status: string;
  metadata: string;
  created_at: string;
  updated_at: string;
}

interface NodeHierarchyProps {
  projectId: string;
  onNodeSelect?: (nodeId: string) => void;
  selectedNodeId?: string;
}

export default function NodeHierarchy({ projectId, onNodeSelect, selectedNodeId }: NodeHierarchyProps) {
  const [rootNodes, setRootNodes] = useState<Node[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [nodeChildren, setNodeChildren] = useState<Record<string, Node[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRootNodes = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getProjectRootNodes(projectId);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch root nodes: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.data) {
        setRootNodes(data.data);
      } else {
        setRootNodes([]);
      }
    } catch (err) {
      console.error('Error fetching root nodes:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchNodeChildren = async (nodeId: string) => {
    try {
      const response = await apiClient.getNodeChildren(nodeId);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch children: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.data) {
        setNodeChildren(prev => ({
          ...prev,
          [nodeId]: data.data
        }));
      }
    } catch (err) {
      console.error(`Error fetching children for node ${nodeId}:`, err);
    }
  };

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
      // Fetch children if not already loaded
      if (!nodeChildren[nodeId]) {
        fetchNodeChildren(nodeId);
      }
    }
    setExpandedNodes(newExpanded);
  };

  const handleNodeClick = (nodeId: string) => {
    if (onNodeSelect) {
      onNodeSelect(nodeId);
    }
  };

  const renderNode = (node: Node, depth: number = 0) => {
    const hasChildren = nodeChildren[node.id] && nodeChildren[node.id].length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = selectedNodeId === node.id;

    return (
      <div key={node.id} className="w-full">
        <div 
          className={`flex items-center p-2 rounded cursor-pointer transition-colors ${
            isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50'
          }`}
          style={{ marginLeft: `${depth * 24}px` }}
          onClick={() => handleNodeClick(node.id)}
        >
          <button
            className="w-6 h-6 flex items-center justify-center mr-2 text-gray-500 hover:text-gray-700"
            onClick={(e) => {
              e.stopPropagation();
              toggleNode(node.id);
            }}
            disabled={!hasChildren}
          >
            {hasChildren ? (
              isExpanded ? '▼' : '▶'
            ) : (
              <span className="w-4 h-4"></span>
            )}
          </button>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 truncate">{node.title}</span>
              <span className={`px-2 py-1 text-xs rounded-full ${
                node.status === 'active' ? 'bg-green-100 text-green-800' :
                node.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                node.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {node.status}
              </span>
              <span className={`px-2 py-1 text-xs rounded-full ${
                node.type === 'task' ? 'bg-blue-100 text-blue-800' :
                node.type === 'note' ? 'bg-green-100 text-green-800' :
                node.type === 'issue' ? 'bg-red-100 text-red-800' :
                'bg-purple-100 text-purple-800'
              }`}>
                {node.type}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1 truncate">
              {new Date(node.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>

        {isExpanded && hasChildren && nodeChildren[node.id] && (
          <div className="ml-6 border-l border-gray-200">
            {nodeChildren[node.id].map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    if (projectId) {
      fetchRootNodes();
    }
  }, [projectId]);

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <p className="mt-2 text-gray-600">Loading hierarchy...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded">
        <p className="text-red-700">Error: {error}</p>
        <button
          onClick={fetchRootNodes}
          className="mt-2 px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (rootNodes.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>No nodes found in this project.</p>
        <p className="text-sm mt-1">Create nodes to build a hierarchy.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Node Hierarchy</h3>
        <p className="text-sm text-gray-600">Click on nodes to expand/collapse and select</p>
      </div>
      
      <div className="border rounded-lg bg-white">
        {rootNodes.map(node => renderNode(node))}
      </div>

      <div className="mt-4 text-sm text-gray-500">
        <p>Total root nodes: {rootNodes.length}</p>
        <p>Expanded nodes: {expandedNodes.size}</p>
      </div>
    </div>
  );
}