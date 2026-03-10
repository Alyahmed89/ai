'use client';

import { useState, useEffect } from 'react';
import UnifiedSidebar from '@/app/components/UnifiedSidebar';
import UnifiedTopBar from '@/app/components/UnifiedTopBar';
import UnifiedMainContent from '@/app/components/UnifiedMainContent';

// Mock data for demonstration
const mockProjects = [
  {
    id: 'project-1',
    title: 'Marketing Campaign',
    type: 'project' as const,
    children: [
      {
        id: 'doc-1',
        title: 'Campaign Strategy',
        type: 'doc' as const,
        content: 'Overview of Q2 marketing campaign strategy',
        children: [
          {
            id: 'flow-1',
            title: 'Social Media Flow',
            type: 'flow' as const,
            content: 'Automated social media posting workflow',
            children: [
              {
                id: 'task-1',
                title: 'Create Posts',
                type: 'task' as const,
                content: 'Draft social media posts for each platform',
                leftLinks: [
                  { targetId: 'doc-1', description: 'Strategy doc', type: 'doc' }
                ]
              },
              {
                id: 'task-2',
                title: 'Schedule Posts',
                type: 'task' as const,
                content: 'Schedule posts using automation tool',
                rightLinks: [
                  { targetId: 'flow-run-1', description: 'Latest run', type: 'flow-run' }
                ]
              }
            ]
          }
        ]
      },
      {
        id: 'doc-2',
        title: 'Budget Planning',
        type: 'doc' as const,
        content: 'Q2 marketing budget allocation',
        children: []
      }
    ]
  },
  {
    id: 'project-2',
    title: 'Product Development',
    type: 'project' as const,
    children: [
      {
        id: 'flow-2',
        title: 'Feature Pipeline',
        type: 'flow' as const,
        content: 'New feature development workflow',
        children: [
          {
            id: 'step-1',
            title: 'Design Review',
            type: 'step' as const,
            content: 'Review UI/UX designs with team',
            leftLinks: [
              { targetId: 'doc-3', description: 'Design specs', type: 'doc' }
            ]
          },
          {
            id: 'step-2',
            title: 'Implementation',
            type: 'step' as const,
            content: 'Code implementation phase',
            rightLinks: [
              { targetId: 'task-3', description: 'Dev tasks', type: 'task' }
            ]
          }
        ]
      }
    ]
  }
];

// Flatten nodes for easier access
const flattenNodes = (nodes: any[]): any[] => {
  let result: any[] = [];
  nodes.forEach(node => {
    result.push(node);
    if (node.children) {
      result = result.concat(flattenNodes(node.children));
    }
  });
  return result;
};

const allNodes = flattenNodes(mockProjects);

export default function UnifiedPage() {
  // State for navigation
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [navigationStack, setNavigationStack] = useState<any[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<any[]>([]);

  // Get current node
  const currentNode = currentNodeId 
    ? allNodes.find(node => node.id === currentNodeId)
    : null;

  // Get nodes to show in sidebar (children of current node or root projects)
  const sidebarNodes = currentNode && currentNode.children 
    ? currentNode.children
    : mockProjects;

  // Get nodes to show in main content (children of current node)
  const mainContentNodes = currentNode && currentNode.children
    ? currentNode.children.map((child: any) => ({
        id: child.id,
        title: child.title,
        content: child.content || '',
        type: child.type,
        commentCount: Math.floor(Math.random() * 5), // Random comment count for demo
        leftLinks: child.leftLinks || [],
        rightLinks: child.rightLinks || []
      }))
    : mockProjects.map(project => ({
        id: project.id,
        title: project.title,
        content: project.children?.[0]?.content || 'Project with nested content',
        type: project.type,
        commentCount: Math.floor(Math.random() * 3), // Random comment count for demo
        leftLinks: [],
        rightLinks: []
      }));

  // Initialize breadcrumbs
  useEffect(() => {
    if (currentNode) {
      // Build breadcrumb path by finding parent chain
      const buildBreadcrumbs = (nodeId: string): any[] => {
        const node = allNodes.find(n => n.id === nodeId);
        if (!node) return [];
        
        // Find parent
        const parent = allNodes.find(n => 
          n.children && n.children.some((child: any) => child.id === nodeId)
        );
        
        if (parent) {
          return [...buildBreadcrumbs(parent.id), {
            id: node.id,
            title: node.title,
            type: node.type
          }];
        }
        
        return [{
          id: node.id,
          title: node.title,
          type: node.type
        }];
      };
      
      setBreadcrumbs(buildBreadcrumbs(currentNode.id));
    } else {
      setBreadcrumbs([]);
    }
  }, [currentNode]);

  const handleSelectNode = (nodeId: string) => {
    const node = allNodes.find(n => n.id === nodeId);
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
    const newNodeType = currentNode?.type || 'project';
    console.log(`Adding new ${newNodeType}`);
    alert(`Create new ${newNodeType} dialog`);
  };

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
          currentNodeType={currentNode?.type || 'project'}
          onNavigateToNode={handleNavigateToNode}
          onAddComment={handleAddComment}
          onAddLink={handleAddLink}
          onAddNewNode={handleAddNewNode}
        />
      </div>
    </div>
  );
}