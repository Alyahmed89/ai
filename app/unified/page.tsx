'use client';

import { useState, useEffect } from 'react';
import UnifiedSidebar from '@/app/components/UnifiedSidebar';
import UnifiedTopBar from '@/app/components/UnifiedTopBar';
import UnifiedMainContent from '@/app/components/UnifiedMainContent';
import NodeBox from '@/app/components/NodeBox';
import { apiClient } from '@/lib/api-client';

type NodeType = 'project' | 'doc' | 'flow' | 'task' | 'step' | 'flow-run';

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

interface ApiNodeLink {
  id: string;
  source_node_id: string;
  target_node_id: string;
  relation_type: string;
  weight: number;
  created_at: number;
  metadata: string | null;
  target_title?: string;
  target_type?: string;
  direction?: 'outgoing' | 'incoming';
}

interface NodeLink {
  id: string;
  source_id: string;
  target_id: string;
  description: string;
  type: string;
  created_at: string;
}

interface NodeRelationship {
  id: string;
  source_id: string;
  target_id: string;
  type: string;
  metadata: string;
  created_at: string;
}

interface NodeDependency {
  id: string;
  node_id: string;
  depends_on_id: string;
  type: string;
  metadata: string | null;
  created_at: number;
  updated_at: number;
}

interface UnifiedNode {
  id: string;
  title: string;
  type: NodeType;
  content: string;
  children?: UnifiedNode[];
  leftLinks?: NodeLink[];
  rightLinks?: NodeLink[];
  dependencies?: NodeDependency[];
  relationships?: NodeRelationship[];
  status?: string;
  project_id?: string;
  parent_id?: string;
}

export default function UnifiedPage() {
  // State for navigation
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [navigationStack, setNavigationStack] = useState<string[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{id: string, title: string, type: NodeType}>>([]);
  
  // State for API data
  const [projects, setProjects] = useState<Project[]>([]);
  const [nodes, setNodes] = useState<ApiNode[]>([]);
  const [nodeHierarchy, setNodeHierarchy] = useState<Map<string, ApiNode[]>>(new Map());
  const [nodeLinks, setNodeLinks] = useState<Map<string, ApiNodeLink[]>>(new Map());
  const [nodeDependencies, setNodeDependencies] = useState<Map<string, NodeDependency[]>>(new Map());
  const [nodeRelationships, setNodeRelationships] = useState<Map<string, NodeRelationship[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for node leveling
  const [allNodes, setAllNodes] = useState<ApiNode[]>([]); // Store all nodes for filtering
  const [currentParentId, setCurrentParentId] = useState<string | null>(null); // Track current parent node
  
  // State for chat
  const [chatMessage, setChatMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  // State for view mode
  const [viewMode, setViewMode] = useState<'nodes' | 'flowruns'>('nodes');
  const [flowRuns, setFlowRuns] = useState<any[]>([]);
  const [flowRunsLoading, setFlowRunsLoading] = useState(false);
  const [selectedFlowRun, setSelectedFlowRun] = useState<any>(null);

  // Fetch projects on initial load
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        
        // Fetch projects
        const projectsResponse = await apiClient.getProjects(50);
        if (!projectsResponse.ok) {
          throw new Error(`Failed to fetch projects: ${projectsResponse.status}`);
        }
        const projectsData = await projectsResponse.json();
        const projectsList = projectsData.success ? projectsData.data : projectsData;
        setProjects(projectsList);

        // If we have projects, set the first project as current node
        if (projectsList.length > 0 && !currentNodeId) {
          const firstProject = projectsList[0];
          setCurrentNodeId(firstProject.id);
        }

        setError(null);
      } catch (err) {
        console.error('Error fetching projects:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  // Fetch nodes for current project or node
  useEffect(() => {
    const fetchNodes = async () => {
      if (!currentNodeId) return;

      try {
        setLoading(true);
        
        // Check if current node is a project
        const currentProject = projects.find(p => p.id === currentNodeId);
        if (currentProject) {
          // Fetch all nodes for this project
          const nodesResponse = await apiClient.getNodesByProjectId(currentProject.id);
          if (!nodesResponse.ok) {
            throw new Error(`Failed to fetch nodes: ${nodesResponse.status}`);
          }
          const nodesData = await nodesResponse.json();
          const allNodesList = nodesData.success ? nodesData.data : nodesData;
          setAllNodes(allNodesList);
          
          // Log which nodes have children for debugging
          console.log('All nodes loaded:', allNodesList.length);
          allNodesList.forEach((node: ApiNode) => {
            try {
              const metadata = node.metadata ? JSON.parse(node.metadata) : {};
              if (metadata.parent_id) {
                console.log('Node has parent:', node.title, node.id, 'parent:', metadata.parent_id);
              }
            } catch {}
          });
          
          // Set all nodes for the project
          setNodes(allNodesList);
          setCurrentParentId(null); // Reset parent when viewing project (show level 1 nodes)
          
          // Initialize empty maps for hierarchy and links
          setNodeHierarchy(new Map());
          setNodeLinks(new Map());
          
          // Breadcrumbs will be set by the buildBreadcrumbs useEffect
        } else {
          // Current node is not a project, fetch node details
          const nodeResponse = await apiClient.getNode(currentNodeId);
          if (!nodeResponse.ok) {
            throw new Error(`Failed to fetch node: ${nodeResponse.status}`);
          }
          const nodeData = await nodeResponse.json();
          const node = nodeData.success ? nodeData.data : nodeData;
          
          // Also fetch all nodes for this node's project to support leveling
          if (node.project_id) {
            const nodesResponse = await apiClient.getNodesByProjectId(node.project_id);
            if (nodesResponse.ok) {
              const nodesData = await nodesResponse.json();
              const allNodesList = nodesData.success ? nodesData.data : nodesData;
              setAllNodes(allNodesList);
              console.log('All nodes loaded for node view:', allNodesList.length);
              // Log parent-child relationships
              allNodesList.forEach((childNode: ApiNode) => {
                try {
                  const metadata = childNode.metadata ? JSON.parse(childNode.metadata) : {};
                  if (metadata.parent_id) {
                    console.log('Child node:', childNode.title, childNode.id, 'parent:', metadata.parent_id);
                  }
                } catch {}
              });
            }
          }
          
          // Fetch breadcrumbs for this node
          const breadcrumbsResponse = await apiClient.getNodeBreadcrumbs(currentNodeId);
          if (breadcrumbsResponse.ok) {
            const breadcrumbsData = await breadcrumbsResponse.json();
            const breadcrumbsList = breadcrumbsData.success ? breadcrumbsData.data.breadcrumbs : [];
            setBreadcrumbs(breadcrumbsList.map((bc: any) => ({
              id: bc.id,
              title: bc.title,
              type: bc.type as NodeType
            })));
          }
          
          // Fetch links for this node
          const linksResponse = await apiClient.getNodeLinks(currentNodeId);
          if (linksResponse.ok) {
            const linksData = await linksResponse.json();
            const links = linksData.success ? linksData.data : { outgoing: [], incoming: [] };
            
            // Update node links map
            setNodeLinks(prevLinks => {
              const newLinksMap = new Map(prevLinks);
              newLinksMap.set(currentNodeId, [...links.outgoing, ...links.incoming]);
              return newLinksMap;
            });
          }
          
          // Fetch dependencies for this node
          const dependenciesResponse = await apiClient.getNodeDependencies(currentNodeId);
          if (dependenciesResponse.ok) {
            const dependenciesData = await dependenciesResponse.json();
            const dependencies = dependenciesData.success ? dependenciesData.data : [];
            
            // Update node dependencies map
            setNodeDependencies(prevDeps => {
              const newDepsMap = new Map(prevDeps);
              newDepsMap.set(currentNodeId, dependencies);
              return newDepsMap;
            });
          }
          
          // Fetch relationships for this node
          const relationshipsResponse = await apiClient.getNodeRelationships(currentNodeId);
          if (relationshipsResponse.ok) {
            const relationshipsData = await relationshipsResponse.json();
            const relationships = relationshipsData.success ? relationshipsData.data : [];
            
            // Update node relationships map
            setNodeRelationships(prevRels => {
              const newRelsMap = new Map(prevRels);
              newRelsMap.set(currentNodeId, relationships);
              return newRelsMap;
            });
          }
        }

        setError(null);
      } catch (err) {
        console.error('Error fetching nodes:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchNodes();
  }, [currentNodeId, projects]);

  // Fetch flow runs when view mode changes to 'flowruns'
  useEffect(() => {
    if (viewMode === 'flowruns') {
      fetchFlowRuns();
    }
  }, [viewMode]);

  // Get current node
  const currentNode = currentNodeId 
    ? nodes.find(node => node.id === currentNodeId) || projects.find(project => project.id === currentNodeId)
    : null;

  // Get nodes for the current project with hierarchy
  const getProjectNodesWithHierarchy = (projectId: string, parentId?: string | null): UnifiedNode[] => {
    const projectNodes = nodes.filter(node => node.project_id === projectId);
    
    // Build tree structure
    const buildTree = (currentParentId?: string): UnifiedNode[] => {
      return projectNodes
        .filter(node => {
          // Check if node has parent_id in metadata
          try {
            const metadata = node.metadata ? JSON.parse(node.metadata) : {};
            const nodeParentId = metadata.parent_id || node.parent_id;
            return nodeParentId === currentParentId;
          } catch {
            return node.parent_id === currentParentId;
          }
        })
        .map(node => {
          const children = buildTree(node.id);
          const links = nodeLinks.get(node.id);
          const linkArray = Array.isArray(links) ? links : [];
          const dependencies = nodeDependencies.get(node.id) || [];
          const relationships = nodeRelationships.get(node.id) || [];
          
          // Separate left and right links based on relation_type
          const leftLinks = linkArray.filter(link => link && link.relation_type && (link.relation_type === 'dependency' || link.relation_type === 'left'));
          const rightLinks = linkArray.filter(link => link && link.relation_type && (link.relation_type === 'reference' || link.relation_type === 'right'));
          
          // Convert links to component format
          const convertLink = (link: ApiNodeLink) => ({
            id: link.id,
            source_id: link.source_node_id,
            target_id: link.target_node_id,
            description: link.relation_type || '',
            type: link.relation_type || '',
            created_at: link.created_at.toString()
          });
          
          return {
            id: node.id,
            title: node.title,
            type: node.type as NodeType,
            content: node.content,
            status: node.status,
            project_id: node.project_id,
            parent_id: node.parent_id,
            children: children.length > 0 ? children : undefined,
            leftLinks: leftLinks.length > 0 ? leftLinks.map(convertLink) : undefined,
            rightLinks: rightLinks.length > 0 ? rightLinks.map(convertLink) : undefined,
            dependencies: dependencies.length > 0 ? dependencies : undefined,
            relationships: relationships.length > 0 ? relationships : undefined
          };
        });
    };
    
    return buildTree(parentId || undefined);
  };

  // Get nodes to show in sidebar with hierarchy
  const sidebarNodes = (() => {
    if (!currentNode) {
      // Show projects as root nodes
      return projects.map(project => ({
        id: project.id,
        title: project.name,
        type: 'project' as NodeType,
        content: `Project: ${project.status}`,
        status: project.status
      }));
    }
    
    // Check if current node is a project (has 'name' property)
    if ('name' in currentNode) {
      // If current node is a project, show its hierarchical nodes
      return getProjectNodesWithHierarchy(currentNode.id, currentParentId);
    } else {
      // If current node is a regular node, show nodes from the same project with hierarchy
      return getProjectNodesWithHierarchy(currentNode.project_id, currentParentId);
    }
  })();

  // Get nodes to show in main content with hierarchy and links
  const mainContentNodes = (() => {
    if (!currentNode) {
      // Show projects as main content when no node is selected
      return projects.map(project => ({
        id: project.id,
        title: project.name,
        content: `Project: ${project.status}`,
        type: 'project' as NodeType,
        status: project.status
      }));
    }
    
    // Check if current node is a project (has 'name' property)
    if ('name' in currentNode) {
      // If current node is a project, show its hierarchical nodes
      return getProjectNodesWithHierarchy(currentNode.id, currentParentId);
    } else {
      // If current node is a regular node, show nodes from the same project with hierarchy
      return getProjectNodesWithHierarchy(currentNode.project_id, currentParentId);
    }
  })();

  // Build breadcrumbs - using API breadcrumbs when available, otherwise fallback
  useEffect(() => {
    if (!currentNodeId) {
      setBreadcrumbs([]);
      return;
    }

    // Only build breadcrumbs if they haven't been set by API
    // The API sets breadcrumbs for nodes in fetchNodes function
    const node = nodes.find(n => n.id === currentNodeId);
    const project = projects.find(p => p.id === currentNodeId);
    
    if (project && breadcrumbs.length === 0) {
      // For projects, set simple breadcrumb
      setBreadcrumbs([{
        id: project.id,
        title: project.name,
        type: 'project' as NodeType
      }]);
    } else if (node && breadcrumbs.length === 0) {
      // For nodes without API breadcrumbs, create simple breadcrumb
      // This is a fallback in case API breadcrumbs fail
      setBreadcrumbs([{
        id: node.id,
        title: node.title,
        type: node.type as NodeType
      }]);
    }
  }, [currentNodeId, nodes, projects, breadcrumbs.length]);

  const handleSelectNode = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId) || projects.find(p => p.id === nodeId);
    if (node) {
      console.log('handleSelectNode called:', { 
        nodeId, 
        viewMode, 
        allNodesLength: allNodes.length,
        currentNodeId,
        isProject: !!projects.find(p => p.id === nodeId)
      });
      
      // For leveling feature: filter to show children instead of navigating to node details
      if (viewMode === 'nodes' && allNodes.length > 0) {
        const children = allNodes.filter(childNode => {
          try {
            const metadata = childNode.metadata ? JSON.parse(childNode.metadata) : {};
            const hasParent = metadata.parent_id === nodeId;
            if (hasParent) {
              console.log('Found child:', childNode.title, childNode.id, 'of parent:', nodeId);
            }
            return hasParent;
          } catch {
            return false;
          }
        });
        
        console.log('Found children:', children.length, 'for node:', nodeId, 'node title:', 'title' in node ? node.title : node.name);
        
        if (children.length > 0) {
          // Show children nodes (leveling feature)
          console.log('Setting currentParentId to:', nodeId);
          setCurrentParentId(nodeId);
          if (currentNodeId) {
            setNavigationStack(prev => [...prev, currentNodeId]);
          }
          // Don't change currentNodeId - we're staying in the same project view
        } else {
          // No children, navigate to node details (existing behavior)
          console.log('No children, navigating to node details');
          if (currentNodeId) {
            setNavigationStack(prev => [...prev, currentNodeId]);
          }
          setCurrentNodeId(nodeId);
        }
      } else {
        // Existing behavior for non-nodes view or when allNodes not loaded
        console.log('Using existing behavior, viewMode:', viewMode, 'allNodes:', allNodes.length);
        if (currentNodeId) {
          setNavigationStack(prev => [...prev, currentNodeId]);
        }
        setCurrentNodeId(nodeId);
      }
      
      // Clear breadcrumbs when selecting a new node (they'll be fetched from API if available)
      if (!projects.find(p => p.id === nodeId)) {
        setBreadcrumbs([]);
      }
    }
  };

  const handleBack = () => {
    if (navigationStack.length > 0) {
      const previousNodeId = navigationStack[navigationStack.length - 1];
      setNavigationStack(prev => prev.slice(0, -1));
      
      // Update nodes view based on the parent (leveling feature)
      if (allNodes.length > 0) {
        if (previousNodeId) {
          // Check if previous node is a project
          const previousProject = projects.find(p => p.id === previousNodeId);
          if (previousProject) {
            // Show level 1 nodes for this project
            setCurrentParentId(null);
            setCurrentNodeId(previousNodeId); // Navigate to project
          } else {
            // Check if previous node has children
            const children = allNodes.filter(childNode => {
              try {
                const metadata = childNode.metadata ? JSON.parse(childNode.metadata) : {};
                return metadata.parent_id === previousNodeId;
              } catch {
                return false;
              }
            });
            if (children.length > 0) {
              // Show children of the previous node
              setCurrentParentId(previousNodeId);
              // Don't change currentNodeId - we're staying in the same project view
            } else {
              // No children, navigate to node details
              setCurrentNodeId(previousNodeId);
              setCurrentParentId(null);
            }
          }
        } else {
          // No previous node, show level 1 nodes
          setCurrentParentId(null);
          setCurrentNodeId(null); // Go back to project list
        }
      } else {
        // Fallback to existing behavior
        setCurrentNodeId(previousNodeId);
      }
    } else {
      setCurrentNodeId(null);
    }
  };

  const handleNavigateBreadcrumb = (nodeId: string) => {
    // Find the index of this breadcrumb
    const index = breadcrumbs.findIndex(b => b.id === nodeId);
    if (index >= 0) {
      // Navigate to this node
      setCurrentNodeId(nodeId);
      // Trim navigation stack
      setNavigationStack(prev => prev.slice(0, index));
    }
  };

  const handleAddComment = (nodeId: string) => {
    console.log(`Adding comment to node ${nodeId}`);
    // Comment dialog for node
  };

  const handleNavigateToNode = (nodeId: string) => {
    handleSelectNode(nodeId);
  };

  const handleAddLink = async (nodeId: string, targetId: string, description: string, linkType: string) => {
    try {
      const response = await apiClient.createNodeLink(nodeId, {
        target_id: targetId,
        description,
        type: linkType
      });
      
      if (response.ok) {
        // Refresh links for this node
        const linksResponse = await apiClient.getNodeLinks(nodeId);
        if (linksResponse.ok) {
          const linksData = await linksResponse.json();
          const links = linksData.success ? linksData.data : linksData;
          
          const newLinks = new Map(nodeLinks);
          newLinks.set(nodeId, links);
          setNodeLinks(newLinks);
        }
        // Link created
      } else {
        // Failed to create link
      }
    } catch (err) {
      console.error('Error creating link:', err);
      // Error creating link
    }
  };

  const handleAddNewNode = async (title: string, content: string, type: string, parentId?: string) => {
    try {
      let response;
      
      if (type === 'project') {
        // Create new project
        response = await apiClient.createProject({
          name: title,
          status: 'active',
          metadata: JSON.stringify({ description: content })
        });
      } else if (currentNode && 'name' in currentNode) {
        // Create new node in current project
        response = await apiClient.createNode({
          project_id: currentNode.id,
          type,
          title,
          content,
          status: 'active',
          metadata: JSON.stringify({ parent_id: parentId })
        });
      } else if (currentNode && !('name' in currentNode)) {
        // Create new node in same project as current node (only if currentNode is a node, not a project)
        response = await apiClient.createNode({
          project_id: currentNode.project_id,
          type,
          title,
          content,
          status: 'active',
          metadata: JSON.stringify({ parent_id: parentId || currentNode.id })
        });
      } else {
        // Create new project as fallback
        response = await apiClient.createProject({
          name: title,
          status: 'active',
          metadata: JSON.stringify({ description: content })
        });
      }
      
      if (response.ok) {
        // Refresh data
        if (currentNodeId) {
          // Trigger refetch of nodes
          setCurrentNodeId(currentNodeId);
        }
        // Created
      } else {
        // Failed to create
      }
    } catch (err) {
      console.error(`Error creating ${type}:`, err);
      // Error creating
    }
  };

  // Handle chat message submission - creates a task and navigates to flowruns
  const handleChatSubmit = async () => {
    if (!chatMessage.trim()) return;
    
    setIsChatLoading(true);
    try {
      // Create a task by calling the /api/tasks endpoint
      const response = await fetch('https://deepseek-agent.alghamdimo89.workers.dev/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flow_id: 'doc-comment',
          title: `Task: ${chatMessage.substring(0, 50)}${chatMessage.length > 50 ? '...' : ''}`,
          description: chatMessage,
          status: 'pending',
          priority: '1',
          numeric_priority: 1,
          task_type: 'implementation'
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create task: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Task created:', result);
      
      // Clear the input
      setChatMessage('');
      
      // Navigate to flowruns view
      setViewMode('flowruns');
      await fetchFlowRuns();
      
      // Show success message
      // Task created
      
    } catch (err) {
      console.error('Error creating task:', err);
      // Error creating task
    } finally {
      setIsChatLoading(false);
    }
  };

  // Handle Enter key press in chat input
  const handleChatKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSubmit();
    }
  };

  // Fetch flow runs
  const fetchFlowRuns = async () => {
    setFlowRunsLoading(true);
    try {
      const response = await fetch('https://deepseek-agent.alghamdimo89.workers.dev/api/flow-runs?limit=50');
      if (!response.ok) {
        throw new Error(`Failed to fetch flow runs: ${response.status}`);
      }
      
      const data = await response.json();
      setFlowRuns(data.data || data);
    } catch (err) {
      console.error('Error fetching flow runs:', err);
      // Error fetching flow runs
    } finally {
      setFlowRunsLoading(false);
    }
  };

  // Navigate back to nodes view


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading projects and nodes...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600"></div>
      </div>
    );
  }

  // Compute which nodes have children for the leveling feature
  const nodesWithChildren = new Set<string>();
  if (allNodes.length > 0) {
    allNodes.forEach(node => {
      try {
        const metadata = node.metadata ? JSON.parse(node.metadata) : {};
        if (metadata.parent_id) {
          // This node has a parent, so the parent has children
          nodesWithChildren.add(metadata.parent_id);
        }
      } catch {}
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Bar */}
      <UnifiedTopBar
        breadcrumbs={breadcrumbs}
        onNavigateBreadcrumb={handleNavigateBreadcrumb}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar - only show in nodes view */}
        {viewMode === 'nodes' && (
          <UnifiedSidebar
            nodes={sidebarNodes}
            selectedNodeId={currentNodeId}
            onSelectNode={handleSelectNode}
            onBack={handleBack}
            currentPath={breadcrumbs}
          />
        )}

        {/* Main Content - show nodes or flowruns */}
        {viewMode === 'nodes' ? (
          <UnifiedMainContent
            nodes={mainContentNodes}
            currentNodeType={currentNode ? ('name' in currentNode ? 'project' : currentNode.type as NodeType) : 'project'}
            onNavigateToNode={handleNavigateToNode}
            onAddComment={handleAddComment}
            onAddLink={handleAddLink}
            onAddNewNode={handleAddNewNode}
            nodesWithChildren={nodesWithChildren}
          />
        ) : (
          // Flowruns View
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-6xl mx-auto">
              {/* Flowruns Header */}
              <div className="mb-6">
                <div className="mb-4">
                  <h1 className="text-2xl font-bold text-gray-900">Flowruns</h1>
                </div>
              </div>

              {/* Flowruns List */}
              {flowRunsLoading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : flowRuns.length === 0 ? (
                <div className="text-center py-12">
                </div>
              ) : (
                <div className="space-y-4">
                  {flowRuns.map((flowRun) => (
                    <div key={flowRun.id}>
                      <NodeBox
                        node={{
                          id: flowRun.id,
                          name: flowRun.input_prompt || 'Untitled Flow Run',
                          type: 'flowrun' as any,
                          description: flowRun.output_response || 'No response yet',
                          created_at: flowRun.created_at,
                          updated_at: flowRun.updated_at,
                          status: flowRun.status,
                          flow_id: flowRun.flow_id,
                          duration_ms: flowRun.duration_ms
                        }}
                        onNavigate={() => {
                          // Show flow run detail
                          setSelectedFlowRun(flowRun);
                        }}
                        onAddComment={() => {}}
                        onAddLink={() => {}}
                        dependencies={[]}
                        relationships={[]}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Flow Run Detail Modal */}
      {selectedFlowRun && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900"></h2>
              </div>
              <button
                onClick={() => setSelectedFlowRun(null)}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="overflow-y-auto p-6 space-y-6 max-h-[calc(80vh-80px)]">
              {/* Prompt Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Prompt</h3>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <pre className="whitespace-pre-wrap text-gray-800 font-mono text-sm">
                    {selectedFlowRun.input_prompt || 'No prompt provided'}
                  </pre>
                </div>
              </div>

              {/* Response Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Response</h3>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  {selectedFlowRun.output_response ? (
                    <pre className="whitespace-pre-wrap text-gray-800 font-mono text-sm">
                      {selectedFlowRun.output_response}
                    </pre>
                  ) : (
                    <div className="text-gray-500 italic">No response yet</div>
                  )}
                </div>
              </div>

              {/* Metadata Section */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Flow ID</h4>
                  <div className="text-gray-900 font-mono text-sm bg-gray-50 px-3 py-2 rounded border border-gray-200">
                    {selectedFlowRun.flow_id || 'N/A'}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Duration</h4>
                  <div className="text-gray-900 font-mono text-sm bg-gray-50 px-3 py-2 rounded border border-gray-200">
                    {selectedFlowRun.duration_ms ? `${selectedFlowRun.duration_ms}ms` : 'N/A'}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Created</h4>
                  <div className="text-gray-900 text-sm bg-gray-50 px-3 py-2 rounded border border-gray-200">
                    {selectedFlowRun.created_at ? new Date(selectedFlowRun.created_at).toLocaleString() : 'N/A'}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Updated</h4>
                  <div className="text-gray-900 text-sm bg-gray-50 px-3 py-2 rounded border border-gray-200">
                    {selectedFlowRun.updated_at ? new Date(selectedFlowRun.updated_at).toLocaleString() : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Chat Interface */}
      <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyPress={handleChatKeyPress}
              placeholder=""
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isChatLoading}
            />
            <button
              onClick={handleChatSubmit}
              disabled={isChatLoading || !chatMessage.trim()}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isChatLoading ? 'Sending...' : 'Send'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}