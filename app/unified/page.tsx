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
  const [viewMode, setViewMode] = useState<'nodes' | 'flows' | 'tasks'>('nodes');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<ApiNode[]>([]);
  const [flows, setFlows] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [flowRuns, setFlowRuns] = useState<FlowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [nodesLoading, setNodesLoading] = useState(false);
  const [flowsLoading, setFlowsLoading] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [flowRunsLoading, setFlowRunsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [childNodes, setChildNodes] = useState<ApiNode[]>([]);
  const [nodeLoading, setNodeLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'links' | 'dependencies' | 'relationships'>('links');
  const [links, setLinks] = useState<any[]>([]);
  const [dependencies, setDependencies] = useState<any[]>([]);
  const [relationships, setRelationships] = useState<any[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [dependenciesLoading, setDependenciesLoading] = useState(false);
  const [relationshipsLoading, setRelationshipsLoading] = useState(false);

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
        setNodesLoading(true);
        // Get all nodes for the project
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
        setNodes(nodesData || []);
      } catch (err) {
        setError('Failed to load nodes');
        console.error('Error loading nodes:', err);
      } finally {
        setNodesLoading(false);
      }
    };

    loadNodes();
    
    // Also load flows and tasks when project changes
    if (viewMode === 'flows') {
      loadFlows();
    } else if (viewMode === 'tasks') {
      loadTasks();
    }
  }, [selectedProjectId, viewMode]);

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
      
      // Try to load children from API first
      try {
        const response = await apiClient.getNodeChildren(nodeId);
        
        if (response.ok) {
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
          
          if (childrenData && childrenData.length > 0) {
            console.log(`Loaded ${childrenData.length} children from API for node ${nodeId}`);
            setChildNodes(childrenData || []);
            return;
          }
        }
      } catch (apiErr) {
        console.log('API getNodeChildren failed, falling back to client-side filtering:', apiErr);
      }
      
      // Fallback: filter children from all nodes
      const children = nodes.filter(node => {
        try {
          if (!node.metadata || node.metadata === 'null' || node.metadata === '') {
            return false;
          }
          const metadata = JSON.parse(node.metadata);
          return 'parent_id' in metadata && metadata.parent_id === nodeId;
        } catch {
          return false;
        }
      });
      
      setChildNodes(children);
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
    setLinks([]);
    setDependencies([]);
    setRelationships([]);
  };

  // Load links, dependencies, and relationships when a node is selected
  useEffect(() => {
    const loadNodeRelations = async () => {
      if (!selectedNodeId) {
        setLinks([]);
        setDependencies([]);
        setRelationships([]);
        return;
      }

      try {
        // Load links
        setLinksLoading(true);
        const linksResponse = await apiClient.getNodeLinks(selectedNodeId);
        if (linksResponse.ok) {
          const linksData = await linksResponse.json();
          // Handle different response formats
          let linksArray;
          if (linksData.error) {
            console.error('API error for links:', linksData.error);
            linksArray = [];
          } else if (linksData.success && linksData.data) {
            linksArray = Array.isArray(linksData.data) ? linksData.data : [];
          } else if (Array.isArray(linksData)) {
            linksArray = linksData;
          } else {
            linksArray = [];
          }
          setLinks(linksArray);
        } else {
          setLinks([]);
        }
      } catch (err) {
        console.error('Error loading links:', err);
        setLinks([]);
      } finally {
        setLinksLoading(false);
      }

      try {
        // Load dependencies
        setDependenciesLoading(true);
        const depsResponse = await apiClient.getNodeDependencies(selectedNodeId);
        if (depsResponse.ok) {
          const depsData = await depsResponse.json();
          // Handle different response formats
          let depsArray;
          if (depsData.error) {
            console.error('API error for dependencies:', depsData.error);
            depsArray = [];
          } else if (depsData.success && depsData.data) {
            depsArray = Array.isArray(depsData.data) ? depsData.data : [];
          } else if (Array.isArray(depsData)) {
            depsArray = depsData;
          } else {
            depsArray = [];
          }
          setDependencies(depsArray);
        } else {
          setDependencies([]);
        }
      } catch (err) {
        console.error('Error loading dependencies:', err);
        setDependencies([]);
      } finally {
        setDependenciesLoading(false);
      }

      try {
        // Load relationships
        setRelationshipsLoading(true);
        const relsResponse = await apiClient.getNodeRelationships(selectedNodeId);
        if (relsResponse.ok) {
          const relsData = await relsResponse.json();
          // Handle different response formats
          let relsArray;
          if (relsData.error) {
            console.error('API error for relationships:', relsData.error);
            relsArray = [];
          } else if (relsData.success && relsData.data) {
            relsArray = Array.isArray(relsData.data) ? relsData.data : [];
          } else if (Array.isArray(relsData)) {
            relsArray = relsData;
          } else {
            relsArray = [];
          }
          setRelationships(relsArray);
        } else {
          setRelationships([]);
        }
      } catch (err) {
        console.error('Error loading relationships:', err);
        setRelationships([]);
      } finally {
        setRelationshipsLoading(false);
      }
    };

    loadNodeRelations();
  }, [selectedNodeId]);

  // Load flows for selected project
  const loadFlows = async () => {
    if (!selectedProjectId) return;
    
    try {
      setFlowsLoading(true);
      const response = await apiClient.getFlowsByProjectId(selectedProjectId);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Handle different response formats
      let flowsData;
      if (data.error) {
        throw new Error(data.error);
      } else if (data.success && data.data) {
        flowsData = data.data;
      } else {
        flowsData = data;
      }
      
      console.log('Loaded flows:', flowsData?.length || 0, 'flows');
      setFlows(flowsData || []);
    } catch (err) {
      console.error('Error loading flows:', err);
      setFlows([]);
    } finally {
      setFlowsLoading(false);
    }
  };

  // Load tasks for selected project
  const loadTasks = async () => {
    if (!selectedProjectId) return;
    
    try {
      setTasksLoading(true);
      const response = await apiClient.getTasksByProjectId(selectedProjectId);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Handle different response formats
      let tasksData;
      if (data.error) {
        throw new Error(data.error);
      } else if (data.success && data.data) {
        tasksData = data.data;
      } else {
        tasksData = data;
      }
      
      console.log('Loaded tasks:', tasksData?.length || 0, 'tasks');
      setTasks(tasksData || []);
    } catch (err) {
      console.error('Error loading tasks:', err);
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  };

  // Filter nodes to show only root nodes (nodes without parent_id in metadata)
  const displayNodes = nodes.filter((node) => {
    // Check if this is a root node (no parent_id in metadata)
    try {
      if (!node.metadata || node.metadata === 'null' || node.metadata === '') {
        return true; // No metadata or empty metadata = root node
      }
      
      const metadata = JSON.parse(node.metadata);
      // Check if parent_id exists and is not null/empty
      const hasParentId = 'parent_id' in metadata && metadata.parent_id;
      return !hasParentId;
    } catch (e) {
      return true; // If metadata parsing fails, treat as root node
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
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setViewMode('nodes')}
                className={`text-sm ${viewMode === 'nodes' ? 'text-gray-900 font-medium' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Nodes
              </button>
              <span className="text-gray-300">|</span>
              <button 
                onClick={() => setViewMode('flows')}
                className={`text-sm ${viewMode === 'flows' ? 'text-gray-900 font-medium' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Flows
              </button>
              <span className="text-gray-300">|</span>
              <button 
                onClick={() => setViewMode('tasks')}
                className={`text-sm ${viewMode === 'tasks' ? 'text-gray-900 font-medium' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Tasks
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Left sidebar - shows projects or parent nodes */}
        <div className="w-48">
          {selectedNodeId ? (
            <div>
              <div className="mb-2">
                <button
                  onClick={handleBackToParentNodes}
                  className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 text-gray-600"
                >
                  ← Back to parent nodes
                </button>
              </div>
              
              <div className="mb-3 text-sm font-medium text-gray-700">Child Nodes</div>
              
              {nodeLoading ? (
                <div className="text-sm text-gray-500 py-2">Loading children...</div>
              ) : childNodes.length === 0 ? (
                <div className="text-sm text-gray-500 py-2">No child nodes</div>
              ) : (
                <div className="space-y-1">
                  {childNodes.map((node) => (
                    <button
                      key={node.id}
                      onClick={() => handleNodeClick(node.id)}
                      className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100"
                    >
                      {node.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
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
          )}
        </div>

        {/* Main content */}
        <div className="flex-1">
          {viewMode === 'nodes' ? (
            <div>
              {selectedNodeId ? (
                <div>
                  {/* Node Details - Always Visible */}
                  <div className="mb-6 bg-white rounded-lg p-4">
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <button
                          onClick={handleBackToParentNodes}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          ← Back to parent nodes
                        </button>
                      </div>
                      <div className="text-lg font-semibold text-gray-900">
                        {(() => {
                          const selectedNode = nodes.find(n => n.id === selectedNodeId);
                          return selectedNode ? selectedNode.title : 'Node Details';
                        })()}
                      </div>
                    </div>
                    
                    {/* Node Content - Always Visible */}
                    {(() => {
                      const selectedNode = nodes.find(n => n.id === selectedNodeId);
                      if (!selectedNode) {
                        if (loading) {
                          return <div className="text-gray-600">Loading node details...</div>;
                        }
                        return <div className="text-gray-600">Node not found in current data</div>;
                      }
                      return (
                        <div className="mb-6">
                          <div className="text-sm text-gray-600 whitespace-pre-wrap">{selectedNode.content}</div>
                        </div>
                      );
                    })()}
                    
                    {/* Tabs for Links, Dependencies, Relationships */}
                    <div className="border-t pt-4">
                      <div className="flex gap-2 mb-4">
                        <button
                          onClick={() => setActiveTab('links')}
                          className={`px-3 py-1 text-sm rounded ${activeTab === 'links' ? 'bg-gray-200' : 'text-gray-600 hover:text-gray-900'}`}
                        >
                          Links
                        </button>
                        <button
                          onClick={() => setActiveTab('dependencies')}
                          className={`px-3 py-1 text-sm rounded ${activeTab === 'dependencies' ? 'bg-gray-200' : 'text-gray-600 hover:text-gray-900'}`}
                        >
                          Dependencies
                        </button>
                        <button
                          onClick={() => setActiveTab('relationships')}
                          className={`px-3 py-1 text-sm rounded ${activeTab === 'relationships' ? 'bg-gray-200' : 'text-gray-600 hover:text-gray-900'}`}
                        >
                          Relationships
                        </button>
                      </div>
                      
                      {/* Tab Content */}
                      {activeTab === 'links' && (
                        <div>
                          {linksLoading ? (
                            <div className="text-gray-600">Loading links...</div>
                          ) : !Array.isArray(links) || links.length === 0 ? (
                            <div className="text-gray-600">
                              <div className="mb-2">No links found for this node</div>
                              <div className="text-sm">Links show connections to other nodes</div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {links.map((link: any) => (
                                <div key={link.id} className="p-3 border rounded">
                                  <div className="font-medium text-gray-900">{link.target_title || `Link to ${link.target_id}`}</div>
                                  <div className="text-sm text-gray-600 mt-1">{link.description || 'No description'}</div>
                                  <div className="text-xs text-gray-500 mt-1">Type: {link.type || 'unknown'}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {activeTab === 'dependencies' && (
                        <div>
                          {dependenciesLoading ? (
                            <div className="text-gray-600">Loading dependencies...</div>
                          ) : !Array.isArray(dependencies) || dependencies.length === 0 ? (
                            <div className="text-gray-600">
                              <div className="mb-2">No dependencies found for this node</div>
                              <div className="text-sm">Dependencies show nodes that this node depends on</div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {dependencies.map((dep: any) => (
                                <div key={dep.id} className="p-3 border rounded">
                                  <div className="font-medium text-gray-900">{dep.target_title || `Dependency on ${dep.target_id}`}</div>
                                  <div className="text-sm text-gray-600 mt-1">{dep.description || 'No description'}</div>
                                  <div className="text-xs text-gray-500 mt-1">Type: {dep.type || 'unknown'}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {activeTab === 'relationships' && (
                        <div>
                          {relationshipsLoading ? (
                            <div className="text-gray-600">Loading relationships...</div>
                          ) : !Array.isArray(relationships) || relationships.length === 0 ? (
                            <div className="text-gray-600">
                              <div className="mb-2">No relationships found for this node</div>
                              <div className="text-sm">Relationships show various types of connections</div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {relationships.map((rel: any) => (
                                <div key={rel.id} className="p-3 border rounded">
                                  <div className="font-medium text-gray-900">{rel.target_title || `Relationship with ${rel.target_id}`}</div>
                                  <div className="text-sm text-gray-600 mt-1">{rel.description || 'No description'}</div>
                                  <div className="text-xs text-gray-500 mt-1">Type: {rel.type || 'unknown'}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Related Nodes Section */}
                  <div className="mb-4">
                    <div className="text-sm font-medium text-gray-700 mb-2">Related Nodes</div>
                    {nodeLoading ? (
                      <div className="text-gray-600">Loading related nodes...</div>
                    ) : childNodes.length === 0 ? (
                      <div className="text-gray-600">No related nodes found</div>
                    ) : (
                      <div className="space-y-3">
                        {childNodes.map((node) => (
                          <button
                            key={node.id}
                            onClick={() => handleNodeClick(node.id)}
                            className="w-full text-left bg-white rounded-lg p-4 hover:bg-gray-50"
                          >
                            <div className="font-medium text-gray-900">{node.title}</div>
                            <div className="text-sm text-gray-600 mt-1">{node.content}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  {nodesLoading ? (
                    <div className="text-gray-600 py-4">Loading nodes...</div>
                  ) : displayNodes.length === 0 ? (
                    <div className="text-gray-600 py-4">No nodes found</div>
                  ) : (
                    <div className="space-y-3">
                      {displayNodes.map((node) => (
                        <button
                          key={node.id}
                          onClick={() => handleNodeClick(node.id)}
                          disabled={nodesLoading}
                          className={`w-full text-left bg-white rounded-lg p-4 ${nodesLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                        >
                          <div className="font-medium text-gray-900">{node.title}</div>
                          <div className="text-sm text-gray-600 mt-1">{node.content}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : viewMode === 'flows' ? (
            // Flows View
            <div>
              <div className="mb-4">
                <div className="text-sm font-medium text-gray-700 mb-2">Flows</div>
                {flowsLoading ? (
                  <div className="text-gray-600">Loading flows...</div>
                ) : flows.length === 0 ? (
                  <div className="text-gray-600">No flows found for this project</div>
                ) : (
                  <div className="space-y-3">
                    {flows.map((flow) => (
                      <div key={flow.id} className="bg-white rounded-lg p-4">
                        <div className="font-medium text-gray-900">{flow.name || flow.title || `Flow ${flow.id}`}</div>
                        <div className="text-sm text-gray-600 mt-1">
                          {flow.description || flow.content || 'No description available'}
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                          Status: {flow.status || 'Unknown'} | Created: {flow.created_at ? new Date(flow.created_at).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Tasks View
            <div>
              <div className="mb-4">
                <div className="text-sm font-medium text-gray-700 mb-2">Tasks</div>
                {tasksLoading ? (
                  <div className="text-gray-600">Loading tasks...</div>
                ) : tasks.length === 0 ? (
                  <div className="text-gray-600">No tasks found for this project</div>
                ) : (
                  <div className="space-y-3">
                    {tasks.map((task) => (
                      <div key={task.id} className="bg-white rounded-lg p-4">
                        <div className="font-medium text-gray-900">{task.name || task.title || `Task ${task.id}`}</div>
                        <div className="text-sm text-gray-600 mt-1">
                          {task.description || task.content || 'No description available'}
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                          Status: {task.status || 'Unknown'} | Created: {task.created_at ? new Date(task.created_at).toLocaleDateString() : 'N/A'}
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