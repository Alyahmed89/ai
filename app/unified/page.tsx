'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface Project {
  id: string;
  name: string;
  status: string;
  metadata: string | null;
  created_at: number;
  updated_at: number;
}

interface ApiNode {
  id: string;
  project_id: string;
  type: string;
  title: string;
  content: string;
  status: string;
  metadata: string;
  created_at: string;
  updated_at: string;
  parent_id?: string;
}

interface FlowRun {
  id: string;
  flow_id: string;
  input_prompt: string;
  output_response: string;
  status: string;
  created_at: string;
  updated_at: string;
  duration_ms: number;
}

export default function MinimalUnifiedPage() {
  const [viewMode, setViewMode] = useState<'nodes' | 'flowruns'>('nodes');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<ApiNode[]>([]);
  const [flowRuns, setFlowRuns] = useState<FlowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [flowRunsLoading, setFlowRunsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [childNodes, setChildNodes] = useState<ApiNode[]>([]);
  const [nodeLoading, setNodeLoading] = useState(false);

  // Load projects
  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoading(true);
        const response = await apiClient.getProjects();
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Handle different response formats
        let projectsData;
        if (data.error) {
          throw new Error(data.error);
        } else if (data.success && data.data) {
          projectsData = data.data;
        } else {
          projectsData = data;
        }
        
        setProjects(projectsData || []);
        if (projectsData && projectsData.length > 0) {
          setSelectedProjectId(projectsData[0].id);
        }
      } catch (err) {
        setError('Failed to load projects');
        console.error('Error loading projects:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, []);

  // Load nodes for selected project
  useEffect(() => {
    const loadNodes = async () => {
      if (!selectedProjectId) return;

      try {
        setLoading(true);
        const response = await apiClient.getNodesByProjectId(selectedProjectId);
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Handle different response formats
        let nodesData;
        if (data.error) {
          throw new Error(data.error);
        } else if (data.success && data.data) {
          nodesData = data.data;
        } else {
          nodesData = data;
        }
        
        console.log('Loaded nodes:', nodesData?.length || 0, 'nodes');
        if (nodesData) {
          console.log('Node IDs:', nodesData.map(n => n.id));
          console.log('Node titles:', nodesData.map(n => n.title));
        }
        setNodes(nodesData || []);
      } catch (err) {
        setError('Failed to load nodes');
        console.error('Error loading nodes:', err);
      } finally {
        setLoading(false);
      }
    };

    loadNodes();
  }, [selectedProjectId]);

  // Load flow runs
  useEffect(() => {
    const loadFlowRuns = async () => {
      try {
        setFlowRunsLoading(true);
        const response = await apiClient.getFlowRuns();
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Handle different response formats
        let flowRunsData;
        if (data.error) {
          throw new Error(data.error);
        } else if (data.success && data.data) {
          flowRunsData = data.data;
        } else {
          flowRunsData = data;
        }
        
        setFlowRuns(flowRunsData || []);
      } catch (err) {
        console.error('Error loading flow runs:', err);
      } finally {
        setFlowRunsLoading(false);
      }
    };

    loadFlowRuns();
  }, []);

  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
    setSelectedNodeId(null); // Reset selected node when project changes
    setChildNodes([]);
  };

  const handleNodeClick = async (nodeId: string) => {
    try {
      setNodeLoading(true);
      
      // First, check if the node exists in our current nodes array
      const nodeExists = nodes.find(n => n.id === nodeId);
      if (!nodeExists) {
        console.warn(`Node ${nodeId} not found in current nodes array`);
        // We'll still proceed, but this might indicate a race condition
      }
      
      setSelectedNodeId(nodeId);
      
      // Load children for this node
      const response = await apiClient.getNodeChildren(nodeId);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Handle different response formats
      let childrenData;
      if (data.error) {
        throw new Error(data.error);
      } else if (data.success && data.data) {
        childrenData = data.data;
      } else {
        childrenData = data;
      }
      
      setChildNodes(childrenData || []);
    } catch (err) {
      console.error('Error loading node children:', err);
      setChildNodes([]);
    } finally {
      setNodeLoading(false);
    }
  };

  const handleBackToParentNodes = () => {
    setSelectedNodeId(null);
    setChildNodes([]);
  };

  // Filter nodes to show only parent nodes (nodes without parent_id in metadata)
  // Deduplicate by a combination of ID, title, and content to handle API duplicates
  const uniqueNodes = nodes.filter((node, index, self) => {
    const firstIndex = self.findIndex(n => 
      n.id === node.id || 
      (n.title === node.title && n.content === node.content)
    );
    return index === firstIndex;
  });
  
  const parentNodes = uniqueNodes.filter(node => {
    try {
      const metadata = node.metadata ? JSON.parse(node.metadata) : {};
      return !metadata.parent_id;
    } catch {
      return true; // If metadata parsing fails, treat as parent node
    }
  });

  if (loading && projects.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Top Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-lg font-medium text-gray-900">Flowruns</div>
            {selectedProjectId && (
              <>
                <div className="text-lg font-medium text-gray-900">
                  {projects.find(p => p.id === selectedProjectId)?.name || ''}
                </div>
                <button 
                  onClick={() => {
                    setSelectedProjectId(null);
                    setSelectedNodeId(null);
                    setChildNodes([]);
                  }}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  (Projects)
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setViewMode('flowruns')}
              className={`px-3 py-1.5 text-sm ${viewMode === 'flowruns' ? 'bg-gray-200' : 'text-gray-600'}`}
            >
              Flow Runs
            </button>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => console.log('Flows clicked')}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Flows
              </button>
              <span className="text-gray-300">|</span>
              <button 
                onClick={() => console.log('Tasks clicked')}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Tasks
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Simple sidebar - only show 1 level at a time */}
        <div className="w-48">
          <div className="mb-3 text-sm font-medium text-gray-700">Projects</div>
          <div className="space-y-1">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => handleProjectSelect(project.id)}
                className={`w-full text-left px-3 py-2 text-sm rounded ${selectedProjectId === project.id ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
              >
                {project.name}
              </button>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1">
          {viewMode === 'nodes' ? (
            <div>
              {selectedNodeId ? (
                <div>
                  <div className="mb-4 flex items-center gap-2">
                    <button
                      onClick={handleBackToParentNodes}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      ← Back to Parent Nodes
                    </button>
                  </div>
                  
                  {/* Node Details View */}
                  <div className="mb-6 bg-white rounded-lg p-4">
                    <div className="text-sm font-medium text-gray-700 mb-2">Node Details</div>
                    {(() => {
                      const selectedNode = nodes.find(n => n.id === selectedNodeId);
                      if (!selectedNode) {
                        // Check if nodes are still loading
                        if (loading) {
                          return <div className="text-gray-600">Loading nodes...</div>;
                        }
                        // Nodes loaded but this node not found (shouldn't happen normally)
                        return <div className="text-gray-600">Node not found in current data</div>;
                      }
                      return (
                        <div>
                          <div className="font-medium text-gray-900 mb-2">{selectedNode.title}</div>
                          <div className="text-sm text-gray-600 whitespace-pre-wrap">{selectedNode.content}</div>
                        </div>
                      );
                    })()}
                  </div>
                  
                  <div className="mb-4">
                    <div className="text-sm font-medium text-gray-700 mb-2">Child Nodes</div>
                    {nodeLoading ? (
                      <div className="text-gray-600">Loading child nodes...</div>
                    ) : childNodes.length === 0 ? (
                      <div className="text-gray-600">No child nodes found</div>
                    ) : (
                      <div className="space-y-3">
                        {childNodes.map((node) => (
                          <div key={node.id} className="bg-white rounded-lg p-4">
                            <div className="font-medium text-gray-900">{node.title}</div>
                            <div className="text-sm text-gray-600 mt-1">{node.content}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="mb-4">
                    <div className="text-sm font-medium text-gray-700 mb-2">Parent Nodes</div>
                    <div className="space-y-3">
                      {parentNodes.map((node) => (
                        <button
                          key={node.id}
                          onClick={() => handleNodeClick(node.id)}
                          disabled={loading}
                          className={`w-full text-left bg-white rounded-lg p-4 ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                        >
                          <div className="font-medium text-gray-900">{node.title}</div>
                          <div className="text-sm text-gray-600 mt-1">{node.content}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Flowruns View
            <div>
              <div className="mb-4">
                <div className="text-sm font-medium text-gray-700 mb-2">Flow Runs</div>
                {flowRunsLoading ? (
                  <div className="text-gray-600">Loading flow runs...</div>
                ) : flowRuns.length === 0 ? (
                  <div className="text-gray-600">No flow runs found</div>
                ) : (
                  <div className="space-y-3">
                    {flowRuns.map((flowRun) => (
                      <div key={flowRun.id} className="bg-white rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-gray-900 flex-1">
                            {flowRun.input_prompt || 'Untitled Flow Run'}
                          </div>
                          <button
                            onClick={() => {
                              window.location.href = `/flow-run-details?id=${flowRun.id}`;
                            }}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            View
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}