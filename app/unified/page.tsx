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

interface UnifiedNode {
  id: string;
  title: string;
  type: NodeType;
  content: string;
  children?: UnifiedNode[];
  leftLinks?: NodeLink[];
  rightLinks?: NodeLink[];
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          // For now, just set empty nodes since node endpoints don't exist
          setNodes([]);
          setNodeHierarchy(new Map());
          setNodeLinks(new Map());
          
          // Set breadcrumbs to just the project
          setBreadcrumbs([{
            id: currentProject.id,
            title: currentProject.title || currentProject.name,
            type: 'project' as NodeType
          }]);
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
          
          // Separate left and right links based on type or direction
          const leftLinks = linkArray.filter(link => link && link.type && (link.type === 'left' || link.type === 'dependency'));
          const rightLinks = linkArray.filter(link => link && link.type && (link.type === 'right' || link.type === 'reference'));
          
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
            rightLinks: rightLinks.length > 0 ? rightLinks : undefined
          };
        });
    };
    
    return buildTree();
  };

  // Get nodes to show in sidebar with hierarchy
  const sidebarNodes = (() => {
    if (currentNode && 'name' in currentNode) {
      // If current node is a project, show its hierarchical nodes
      return getProjectNodesWithHierarchy(currentNode.id);
    } else if (currentNode) {
      // If current node is a regular node, show nodes from the same project with hierarchy
      return getProjectNodesWithHierarchy(currentNode.project_id);
    }
    
    // Show projects as root nodes
    return projects.map(project => ({
      id: project.id,
      title: project.name,
      type: 'project' as NodeType,
      content: `Project: ${project.status}`,
      status: project.status
    }));
  })();

  // Get nodes to show in main content with hierarchy and links
  const mainContentNodes = (() => {
    if (currentNode && 'name' in currentNode) {
      // If current node is a project, show its hierarchical nodes
      return getProjectNodesWithHierarchy(currentNode.id);
    } else if (currentNode) {
      // If current node is a regular node, show nodes from the same project with hierarchy
      return getProjectNodesWithHierarchy(currentNode.project_id);
    }
    
    // Show projects as main content when no node is selected
    return projects.map(project => ({
      id: project.id,
      title: project.name,
      content: `Project: ${project.status}`,
      type: 'project' as NodeType,
      status: project.status
    }));
  })();

  // Build breadcrumbs - using API breadcrumbs when available, otherwise fallback
  useEffect(() => {
    if (!currentNodeId) {
      setBreadcrumbs([]);
      return;
    }

    // If breadcrumbs are already set from API (for nodes), keep them
    // Otherwise build simple breadcrumb for projects
    const node = nodes.find(n => n.id === currentNodeId);
    const project = projects.find(p => p.id === currentNodeId);
    
    if (project && breadcrumbs.length === 0) {
      setBreadcrumbs([{
        id: project.id,
        title: project.name,
        type: 'project' as NodeType
      }]);
    } else if (node && breadcrumbs.length === 0) {
      // For nodes without API breadcrumbs, create simple breadcrumb
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
      } else if (currentNode) {
        // Create new node in same project as current node
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
    </div>
  );
}