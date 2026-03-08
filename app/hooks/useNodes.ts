'use client';

import { useState, useCallback } from 'react';
import { Node, HorizontalLink } from '@/app/types';

// Mock initial data
const initialNodes: Node[] = [
  {
    id: '1',
    title: 'Getting Started',
    content: 'Welcome to the documentation system. This is the root node.',
    parentId: null,
    children: ['2', '3'],
    leftLinks: [],
    rightLinks: [
      { targetId: '4', condition: 'mobile' },
      { targetId: '5', condition: 'web' },
    ],
    conditions: ['status = active'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Installation',
    content: 'Install the required dependencies and set up the environment.',
    parentId: '1',
    children: [],
    leftLinks: [],
    rightLinks: [],
    conditions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '3',
    title: 'Configuration',
    content: 'Configure your project settings and preferences.',
    parentId: '1',
    children: [],
    leftLinks: [],
    rightLinks: [],
    conditions: ['environment = production'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '4',
    title: 'Mobile App',
    content: 'Documentation for the mobile application interface.',
    parentId: null,
    children: [],
    leftLinks: [{ targetId: '1', condition: 'back' }],
    rightLinks: [],
    conditions: ['platform = ios', 'platform = android'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '5',
    title: 'Web Interface',
    content: 'Documentation for the web-based interface.',
    parentId: null,
    children: [],
    leftLinks: [{ targetId: '1', condition: 'back' }],
    rightLinks: [],
    conditions: ['browser = chrome', 'browser = firefox'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export function useNodes() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [currentNodeId, setCurrentNodeId] = useState<string>('1');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const getNode = useCallback((id: string) => {
    return nodes.find(node => node.id === id) || null;
  }, [nodes]);

  const updateNode = useCallback((updatedNode: Node) => {
    setNodes(prev => prev.map(node => 
      node.id === updatedNode.id 
        ? { ...updatedNode, updatedAt: new Date().toISOString() }
        : node
    ));
  }, []);

  const deleteNode = useCallback((nodeId: string) => {
    setNodes(prev => {
      const nodeToDelete = prev.find(n => n.id === nodeId);
      if (!nodeToDelete) return prev;
      
      // Remove from parent's children
      const updated = prev.map(node => {
        if (node.id === nodeToDelete.parentId) {
          return {
            ...node,
            children: node.children.filter(id => id !== nodeId),
          };
        }
        return node;
      });
      
      // Remove the node itself
      const filtered = updated.filter(node => node.id !== nodeId);
      
      // If we deleted the current node, navigate to parent or first available
      if (nodeId === currentNodeId) {
        if (nodeToDelete?.parentId) {
          setCurrentNodeId(nodeToDelete.parentId);
        } else if (filtered.length > 0) {
          const otherNode = filtered[0];
          if (otherNode) {
            setCurrentNodeId(otherNode.id);
          }
        }
      }
      
      return filtered;
    });
  }, [currentNodeId]);

  const addNode = useCallback((
    parentId: string | null,
    position: 'above' | 'below' | 'left' | 'right',
    referenceNodeId?: string
  ) => {
    // Use a more unique ID to avoid collisions
    const newNodeId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNode: Node = {
      id: newNodeId,
      title: 'New Node',
      content: 'Add your content here...',
      parentId: null,
      children: [],
      leftLinks: [],
      rightLinks: [],
      conditions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setNodes(prev => {
      const updated = [...prev, newNode];
      
      if (position === 'above' || position === 'below') {
        // Find reference node
        const refNode = prev.find(n => n.id === referenceNodeId);
        if (!refNode) return updated;
        
        // Find parent
        const parent = refNode.parentId ? prev.find(n => n.id === refNode.parentId) : null;
        
        if (parent) {
          // Insert in parent's children at correct position
          const parentIndex = updated.findIndex(n => n.id === parent.id);
          const childIndex = parent.children.indexOf(referenceNodeId);
          
          if (childIndex !== -1) {
            const insertIndex = position === 'above' ? childIndex : childIndex + 1;
            parent.children.splice(insertIndex, 0, newNodeId);
            newNode.parentId = parent.id;
          }
        } else {
          // If no parent, the reference node is a root node
          if (position === 'below') {
            // Add as child of the reference node
            const refNodeIndex = updated.findIndex(n => n.id === referenceNodeId);
            if (refNodeIndex !== -1) {
              updated[refNodeIndex].children.push(newNodeId);
              newNode.parentId = referenceNodeId;
            }
          } else if (position === 'above') {
            // For 'above' on a root node, we can't insert above without a parent
            // So make it a sibling before (but still root)
            newNode.parentId = null;
          }
        }
      } else if (position === 'left' || position === 'right') {
        // Add horizontal link
        if (referenceNodeId) {
          const link: HorizontalLink = {
            targetId: newNodeId,
            condition: 'condition',
          };
          
          const refNodeIndex = updated.findIndex(n => n.id === referenceNodeId);
          if (refNodeIndex !== -1) {
            if (position === 'left') {
              updated[refNodeIndex].leftLinks.push(link);
              // Create reciprocal right link from new node to reference node
              const reciprocalLink: HorizontalLink = {
                targetId: referenceNodeId,
                condition: 'condition',
              };
              newNode.rightLinks.push(reciprocalLink);
            } else {
              updated[refNodeIndex].rightLinks.push(link);
              // Create reciprocal left link from new node to reference node
              const reciprocalLink: HorizontalLink = {
                targetId: referenceNodeId,
                condition: 'condition',
              };
              newNode.leftLinks.push(reciprocalLink);
            }
          }
        }
      }
      
      return updated;
    });
    
    // Navigate to new node if it's in the vertical hierarchy
    if (position === 'above' || position === 'below') {
      setCurrentNodeId(newNodeId);
    }
  }, []);

  const navigateHorizontal = useCallback((targetNodeId: string) => {
    setCurrentNodeId(targetNodeId);
  }, []);

  const getBreadcrumbs = useCallback((nodeId: string): { id: string; title: string }[] => {
    const breadcrumbs: { id: string; title: string }[] = [];
    let currentNode = nodes.find(n => n.id === nodeId);
    
    while (currentNode) {
      breadcrumbs.unshift({ id: currentNode.id, title: currentNode.title });
      if (currentNode.parentId) {
        currentNode = nodes.find(n => n.id === currentNode!.parentId);
      } else {
        currentNode = undefined;
      }
    }
    
    return breadcrumbs;
  }, [nodes]);

  return {
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
  };
}