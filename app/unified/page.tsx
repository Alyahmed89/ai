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
}

interface NodeLink {
  targetId: string;
  description: string;
  type: NodeType;
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
}

export default function UnifiedPage() {
  // State for navigation
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [navigationStack, setNavigationStack] = useState<string[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{id: string, title: string, type: NodeType}>>([]);
  
  // State for API data
  const [projects, setProjects] = useState<Project[]>([]);
  const [nodes, setNodes] = useState<ApiNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch projects and nodes on initial load
  useEffect(() => {
    const fetchData = async () => {
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

        // Fetch nodes for each project
        const allNodes: ApiNode[] = [];
        for (const project of projectsList) {
          try {
            const nodesResponse = await apiClient.getNodesByProjectId(project.id);
            if (nodesResponse.ok) {
              const nodesData = await nodesResponse.json();
              const nodesList = nodesData.success ? nodesData.data : nodesData;
              allNodes.push(...nodesList);
            }
          } catch (err) {
            console.error(`Error fetching nodes for project ${project.id}:`, err);
          }
        }
        setNodes(allNodes);

        // If we have projects, set the first project as current node
        if (projectsList.length > 0 && !currentNodeId) {
          const firstProject = projectsList[0];
          setCurrentNodeId(firstProject.id);
        }

        setError(null);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Get current node
  const currentNode = currentNodeId 
    ? nodes.find(node => node.id === currentNodeId) || projects.find(project => project.id === currentNodeId)
    : null;

  // Get nodes for the current project
  const getProjectNodes = (projectId: string) => {
    return nodes.filter(node => node.project_id === projectId);
  };

  // Get nodes to show in sidebar
  const sidebarNodes = (() => {
    if (currentNode && 'name' in currentNode) {
      // If current node is a project, show its nodes
      const projectNodes = getProjectNodes(currentNode.id);
      return projectNodes.map(node => ({
        id: node.id,
        title: node.title,
        type: node.type as NodeType,
        content: node.content,
        status: node.status
      }));
    } else if (currentNode) {
      // If current node is a regular node, show nodes from the same project
      const projectNodes = getProjectNodes(currentNode.project_id);
      return projectNodes.map(node => ({
        id: node.id,
        title: node.title,
        type: node.type as NodeType,
        content: node.content,
        status: node.status
      }));
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

  // Get nodes to show in main content
  const mainContentNodes = (() => {
    if (currentNode && 'name' in currentNode) {
      // If current node is a project, show its nodes
      const projectNodes = getProjectNodes(currentNode.id);
      return projectNodes.map(node => ({
        id: node.id,
        title: node.title,
        content: node.content || '',
        type: node.type as NodeType,
        leftLinks: [],
        rightLinks: []
      }));
    } else if (currentNode) {
      // If current node is a regular node, show nodes from the same project
      const projectNodes = getProjectNodes(currentNode.project_id);
      return projectNodes.map(node => ({
        id: node.id,
        title: node.title,
        content: node.content || '',
        type: node.type as NodeType,
        leftLinks: [],
        rightLinks: []
      }));
    }
    
    // Show projects as main content when no node is selected
    return projects.map(project => ({
      id: project.id,
      title: project.name,
      content: `Project: ${project.status}`,
      type: 'project' as NodeType,
      leftLinks: [],
      rightLinks: []
    }));
  })();

  // Build breadcrumbs
  useEffect(() => {
    if (!currentNodeId) {
      setBreadcrumbs([]);
      return;
    }

    const node = nodes.find(n => n.id === currentNodeId) || projects.find(p => p.id === currentNodeId);
    if (node) {
      setBreadcrumbs([{
        id: node.id,
        title: 'name' in node ? node.name : node.title,
        type: 'name' in node ? 'project' : (node as ApiNode).type as NodeType
      }]);
    } else {
      setBreadcrumbs([]);
    }
  }, [currentNodeId, nodes, projects]);

  const handleSelectNode = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId) || projects.find(p => p.id === nodeId);
    if (node) {
      setNavigationStack(prev => [...prev, currentNodeId]);
      setCurrentNodeId(nodeId);
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

  const handleAddLink = (nodeId: string) => {
    console.log(`Adding link to node ${nodeId}`);
    alert(`Add link dialog for node ${nodeId}`);
  };

  const handleAddNewNode = () => {
    const newNodeType = currentNode ? ('name' in currentNode ? 'project' : currentNode.type) : 'project';
    console.log(`Adding new ${newNodeType}`);
    alert(`Create new ${newNodeType} dialog`);
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