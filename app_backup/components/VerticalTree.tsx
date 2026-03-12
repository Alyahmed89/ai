'use client';

import { Node } from '@/app/types';
import NodeItem from './NodeItem';

interface VerticalTreeProps {
  nodes: Node[];
  currentNodeId: string;
  onEdit: (node: Node) => void;
  onDelete: (nodeId: string) => void;
  onAddAbove: (nodeId: string) => void;
  onAddBelow: (nodeId: string) => void;
  onAddLeft: (nodeId: string) => void;
  onAddRight: (nodeId: string) => void;
  onNavigateHorizontal: (nodeId: string, direction: 'left' | 'right') => void;
}

export default function VerticalTree({
  nodes,
  currentNodeId,
  onEdit,
  onDelete,
  onAddAbove,
  onAddBelow,
  onAddLeft,
  onAddRight,
  onNavigateHorizontal,
}: VerticalTreeProps) {
  // Find the current node
  const currentNode = nodes.find(node => node.id === currentNodeId);
  
  if (!currentNode) {
    return (
      <div className="text-center py-8 text-gray-500">
        Node not found
      </div>
    );
  }

  // Build the vertical hierarchy
  const buildHierarchy = (nodeId: string): Node[] => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return [];
    
    const hierarchy: Node[] = [];
    let current: Node | undefined = node;
    
    // Go up to root
    const pathToRoot: Node[] = [];
    while (current) {
      pathToRoot.unshift(current);
      if (current.parentId) {
        current = nodes.find(n => n.id === current!.parentId);
      } else {
        current = undefined;
      }
    }
    
    // Then add children recursively
    const addChildren = (parentNode: Node, depth: number) => {
      hierarchy.push(parentNode);
      parentNode.children.forEach(child => {
        const childNode = nodes.find(n => n.id === child.nodeId);
        if (childNode) {
          addChildren(childNode, depth + 1);
        }
      });
    };
    
    // Start from root
    if (pathToRoot.length > 0) {
      addChildren(pathToRoot[0], 0);
    }
    
    return hierarchy;
  };

  const hierarchy = buildHierarchy(currentNodeId);

  return (
    <div className="w-full">
      {hierarchy.map((node, index) => (
        <div key={node.id} className="w-full animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
          <NodeItem
            node={node}
            nodes={nodes}
            onEdit={onEdit}
            onDelete={onDelete}
            onAddAbove={onAddAbove}
            onAddBelow={onAddBelow}
            onAddLeft={onAddLeft}
            onAddRight={onAddRight}
            onNavigateHorizontal={onNavigateHorizontal}
          />
        </div>
      ))}
    </div>
  );
}