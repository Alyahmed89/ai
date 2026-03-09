'use client';

import { useNodes } from '@/app/hooks/useNodes';
import TopBar from '@/app/components/TopBar';
import MainCanvas from '@/app/components/MainCanvas';
import RightPanel from '@/app/components/RightPanel';
import VerticalTree from '@/app/components/VerticalTree';

export default function Home() {
  const {
    nodes,
    currentNodeId,
    selectedNodeId,
    setSelectedNodeId,
    getNode,
    updateNode,
    deleteNode,
    addNode,
    navigateHorizontal,
    getBreadcrumbs,
    setCurrentNodeId,
    setNodes,
  } = useNodes();

  const currentNode = getNode(currentNodeId);
  const selectedNode = selectedNodeId ? getNode(selectedNodeId) : null;
  const breadcrumbs = getBreadcrumbs(currentNodeId);

  const handleEdit = (node: any) => {
    updateNode(node);
  };

  const handleDelete = (nodeId: string) => {
    // Simple confirmation for testing - in production you might want a proper modal
    // Temporarily bypass for testing
    deleteNode(nodeId);
    // if (window.confirm('Delete this node?')) {
    //   deleteNode(nodeId);
    // }
  };

  const handleAddAbove = (nodeId: string) => {
    addNode(null, 'above', nodeId);
  };

  const handleAddBelow = (nodeId: string) => {
    addNode(null, 'below', nodeId);
  };

  const handleAddLeft = (nodeId: string) => {
    addNode(null, 'left', nodeId);
  };

  const handleAddRight = (nodeId: string) => {
    addNode(null, 'right', nodeId);
  };

  const handleNavigateHorizontal = (targetNodeId: string, direction: 'left' | 'right') => {
    navigateHorizontal(targetNodeId);
  };

  const handleNavigateBreadcrumb = (nodeId: string) => {
    setCurrentNodeId(nodeId);
  };

  const handleNewNode = () => {
    // Add a new root node
    const newNodeId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNode = {
      id: newNodeId,
      title: 'New Document',
      content: 'Start documenting here...',
      parentId: null,
      children: [],
      leftLinks: [],
      rightLinks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Add the new node to the nodes array
    setNodes(prev => [...prev, newNode]);
    setCurrentNodeId(newNodeId);
  };

  const handleUpdateNode = (node: any) => {
    updateNode(node);
  };

  const handleClosePanel = () => {
    setSelectedNodeId(null);
  };

  if (!currentNode) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopBar
        projectName="Documentation Project"
        breadcrumbs={breadcrumbs}
        onNewNode={handleNewNode}
        onNavigateBreadcrumb={handleNavigateBreadcrumb}
      />
      
      <div className="flex flex-1">
        <MainCanvas>
          <VerticalTree
            nodes={nodes}
            currentNodeId={currentNodeId}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onAddAbove={handleAddAbove}
            onAddBelow={handleAddBelow}
            onAddLeft={handleAddLeft}
            onAddRight={handleAddRight}
            onNavigateHorizontal={handleNavigateHorizontal}
            onSelect={setSelectedNodeId}
          />
        </MainCanvas>
        
        <RightPanel
          node={selectedNode}
          onUpdateNode={handleUpdateNode}
          onClose={handleClosePanel}
        />
      </div>
    </div>
  );
}