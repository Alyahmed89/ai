'use client';
export const runtime = "edge";

import { useParams } from 'next/navigation';
import { useNodes } from '@/app/hooks/useNodes';
import TopBar from '@/app/components/TopBar';
import MainCanvas from '@/app/components/MainCanvas';
import RightPanel from '@/app/components/RightPanel';
import VerticalTree from '@/app/components/VerticalTree';


export default function ItemPage() {
  const params = useParams();
  const nodeId = params.id as string;
  
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
  } = useNodes();

  // Set the current node to the one from the URL
  if (nodeId && nodeId !== currentNodeId) {
    setCurrentNodeId(nodeId);
  }

  const currentNode = getNode(currentNodeId);
  const selectedNode = selectedNodeId ? getNode(selectedNodeId) : null;
  const breadcrumbs = getBreadcrumbs(currentNodeId);

  const handleEdit = (node: any) => {
    updateNode(node);
  };

  const handleDelete = (nodeId: string) => {
    deleteNode(nodeId);
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

  const handleNewNode = () => {
    // Add a new root node
    const newNodeId = `node-${Date.now()}`;
    const newNode = {
      id: newNodeId,
      title: 'New Document',
      content: 'Start documenting here...',
      parentId: null,
      children: [],
      leftLinks: [],
      rightLinks: [],
      conditions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    updateNode(newNode);
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
          <div className="text-gray-500">Node not found</div>
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