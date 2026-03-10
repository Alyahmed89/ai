'use client';

import { useState, useEffect } from 'react';
import UnifiedSidebar from '@/app/components/UnifiedSidebar';
import UnifiedTopBar from '@/app/components/UnifiedTopBar';
import UnifiedMainContent from '@/app/components/UnifiedMainContent';
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

interface NodeLink {
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
  const [nodeLinks, setNodeLinks] = useState<Map<string, NodeLink[]>>(new Map());
  const [nodeDependencies, setNodeDependencies] = useState<Map<string, NodeDependency[]>>(new Map());
  const [nodeRelationships, setNodeRelationships] = useState<Map<string, NodeRelationship[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for chat
  const [chatMessage, setChatMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

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
          // Fetch nodes for this project
          const nodesResponse = await apiClient.getNodesByProjectId(currentProject.id);
          if (!nodesResponse.ok) {
            throw new Error(`Failed to fetch nodes: ${nodesResponse.status}`);
          }
          const nodesData = await nodesResponse.json();
          const nodesList = nodesData.success ? nodesData.data : nodesData;
          setNodes(nodesList);
          
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

  // Get current node
  const currentNode = currentNodeId 
    ? nodes.find(node => node.id === currentNodeId) || projects.find(project => project.id === currentNodeId)
    : null;

  // Get nodes for the current project with hierarchy
  const getProjectNodesWithHierarchy = (projectId: string): UnifiedNode[] => {
    const projectNodes = nodes.filter(node => node.project_id === projectId);
    
    // Build tree structure
    const buildTree = (parentId?: string): UnifiedNode[] => {
      return projectNodes
        .filter(node => node.parent_id === parentId)
        .map(node => {
          const children = buildTree(node.id);
          const links = nodeLinks.get(node.id);
          const linkArray = Array.isArray(links) ? links : [];
          const dependencies = nodeDependencies.get(node.id) || [];
          const relationships = nodeRelationships.get(node.id) || [];
          
          // Separate left and right links based on relation_type
          const leftLinks = linkArray.filter(link => link && link.relation_type && (link.relation_type === 'dependency' || link.relation_type === 'left'));
          const rightLinks = linkArray.filter(link => link && link.relation_type && (link.relation_type === 'reference' || link.relation_type === 'right'));
          
          return {
            id: node.id,
            title: node.title,
            type: node.type as NodeType,
            content: node.content,
            status: node.status,
            project_id: node.project_id,
            parent_id: node.parent_id,
            children: children.length > 0 ? children : undefined,
            leftLinks: leftLinks.length > 0 ? leftLinks : undefined,
            rightLinks: rightLinks.length > 0 ? rightLinks : undefined,
            dependencies: dependencies.length > 0 ? dependencies : undefined,
            relationships: relationships.length > 0 ? relationships : undefined
          };
        });
    };
    
    return buildTree();
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
      return getProjectNodesWithHierarchy(currentNode.id);
    } else {
      // If current node is a regular node, show nodes from the same project with hierarchy
      return getProjectNodesWithHierarchy(currentNode.project_id);
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
      return getProjectNodesWithHierarchy(currentNode.id);
    } else {
      // If current node is a regular node, show nodes from the same project with hierarchy
      return getProjectNodesWithHierarchy(currentNode.project_id);
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
      setNavigationStack(prev => [...prev, currentNodeId]);
      setCurrentNodeId(nodeId);
      
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
      setCurrentNodeId(previousNodeId);
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
    alert(`Comment dialog for node ${nodeId}`);
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
        alert('Link created successfully!');
      } else {
        alert('Failed to create link');
      }
    } catch (err) {
      console.error('Error creating link:', err);
      alert('Error creating link');
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
        alert(`${type} created successfully!`);
      } else {
        alert(`Failed to create ${type}`);
      }
    } catch (err) {
      console.error(`Error creating ${type}:`, err);
      alert(`Error creating ${type}`);
    }
  };

  // Handle chat message submission
  const handleChatSubmit = async () => {
    if (!chatMessage.trim()) return;
    
    setIsChatLoading(true);
    try {
      // For now, just show an alert with the message
      // In a real implementation, this would call an AI API
      alert(`Chat message: "${chatMessage}"\n\nThis would be sent to an AI assistant for processing.`);
      
      // Clear the input
      setChatMessage('');
    } catch (err) {
      console.error('Error sending chat message:', err);
      alert('Error sending chat message');
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
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">No projects found. Create a project to get started.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Bar */}
      <UnifiedTopBar
        breadcrumbs={breadcrumbs}
        onNavigateBreadcrumb={handleNavigateBreadcrumb}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <UnifiedSidebar
          nodes={sidebarNodes}
          selectedNodeId={currentNodeId}
          onSelectNode={handleSelectNode}
          onBack={handleBack}
          currentPath={breadcrumbs}
        />

        {/* Main Content */}
        <UnifiedMainContent
          nodes={mainContentNodes}
          currentNodeType={currentNode ? ('name' in currentNode ? 'project' : currentNode.type as NodeType) : 'project'}
          onNavigateToNode={handleNavigateToNode}
          onAddComment={handleAddComment}
          onAddLink={handleAddLink}
          onAddNewNode={handleAddNewNode}
        />
      </div>

      {/* Sticky Chat Interface */}
      <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyPress={handleChatKeyPress}
              placeholder="Type your message here..."
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
          <div className="mt-2 text-xs text-gray-500 text-center">
            Chat with AI assistant about your nodes and projects
          </div>
        </div>
      </div>
    </div>
  );
}