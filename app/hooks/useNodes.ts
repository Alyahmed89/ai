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
    children: [
      { nodeId: '2', condition: 'platform = web' },
      { nodeId: '3', condition: 'platform = mobile' }
    ],
    leftLinks: [],
    rightLinks: [
      { targetId: '4', description: 'Advanced topics' },
      { targetId: '5', description: 'Reference materials' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Web Installation',
    content: 'Installation guide for web platform.',
    parentId: '1',
    children: [
      { nodeId: '6', condition: 'os = windows' },
      { nodeId: '7', condition: 'os = macos' },
      { nodeId: '8', condition: 'os = linux' }
    ],
    leftLinks: [],
    rightLinks: [
      { targetId: '9', description: 'Troubleshooting' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '3',
    title: 'Mobile Installation',
    content: 'Installation guide for mobile platform.',
    parentId: '1',
    children: [
      { nodeId: '10', condition: 'device = ios' },
      { nodeId: '11', condition: 'device = android' }
    ],
    leftLinks: [],
    rightLinks: [
      { targetId: '12', description: 'Mobile-specific issues' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '4',
    title: 'Advanced Topics',
    content: 'Advanced documentation topics.',
    parentId: null,
    children: [],
    leftLinks: [{ targetId: '1', description: 'Back to basics' }],
    rightLinks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '5',
    title: 'Reference Materials',
    content: 'API references and technical specifications.',
    parentId: null,
    children: [],
    leftLinks: [{ targetId: '1', description: 'Back to basics' }],
    rightLinks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '6',
    title: 'Windows Setup',
    content: 'Windows-specific installation steps.',
    parentId: '2',
    children: [],
    leftLinks: [],
    rightLinks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '7',
    title: 'macOS Setup',
    content: 'macOS-specific installation steps.',
    parentId: '2',
    children: [],
    leftLinks: [],
    rightLinks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '8',
    title: 'Linux Setup',
    content: 'Linux-specific installation steps.',
    parentId: '2',
    children: [],
    leftLinks: [],
    rightLinks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '9',
    title: 'Troubleshooting',
    content: 'Common issues and solutions.',
    parentId: null,
    children: [],
    leftLinks: [{ targetId: '2', description: 'Back to installation' }],
    rightLinks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '10',
    title: 'iOS Setup',
    content: 'iOS-specific installation steps.',
    parentId: '3',
    children: [],
    leftLinks: [],
    rightLinks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '11',
    title: 'Android Setup',
    content: 'Android-specific installation steps.',
    parentId: '3',
    children: [],
    leftLinks: [],
    rightLinks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '12',
    title: 'Mobile Issues',
    content: 'Mobile-specific troubleshooting.',
    parentId: null,
    children: [],
    leftLinks: [{ targetId: '3', description: 'Back to mobile installation' }],
    rightLinks: [],
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
            children: node.children.filter(child => child.nodeId !== nodeId),
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setNodes(prev => {
      const updated = [...prev, newNode];
      
      if (position === 'above' || position === 'below') {
        // Find reference node
        const refNode = prev.find(n => n.id === referenceNodeId);
        if (!refNode || !referenceNodeId) return updated;
        
        // Find parent
        const parent = refNode.parentId ? prev.find(n => n.id === refNode.parentId) : null;
        
        if (parent) {
          // Insert in parent's children at correct position
          const parentIndex = updated.findIndex(n => n.id === parent.id);
          // referenceNodeId is guaranteed to be defined here because of the check above
          const childIndex = parent.children.findIndex(child => child.nodeId === referenceNodeId!);
          
          if (childIndex !== -1) {
            const insertIndex = position === 'above' ? childIndex : childIndex + 1;
            parent.children.splice(insertIndex, 0, { nodeId: newNodeId });
            newNode.parentId = parent.id;
          }
        } else {
          // If no parent, the reference node is a root node
          if (position === 'below') {
            // Add as child of the reference node
            const refNodeIndex = updated.findIndex(n => n.id === referenceNodeId!);
            if (refNodeIndex !== -1) {
              updated[refNodeIndex].children.push({ nodeId: newNodeId });
              newNode.parentId = referenceNodeId!;
            }
          } else if (position === 'above') {
            // For 'above' on a root node, we can't insert above without a parent
            // So make it a sibling before (but still root)
            newNode.parentId = null;
          }
        }
      } else if (position === 'left' || position === 'right') {
        // Add horizontal link (no conditions on horizontal links)
        if (referenceNodeId) {
          const link: HorizontalLink = {
            targetId: newNodeId,
            description: 'New link',
          };
          
          const refNodeIndex = updated.findIndex(n => n.id === referenceNodeId!);
          if (refNodeIndex !== -1) {
            if (position === 'left') {
              updated[refNodeIndex].leftLinks.push(link);
              // Create reciprocal right link from new node to reference node
              const reciprocalLink: HorizontalLink = {
                targetId: referenceNodeId!,
                description: 'Reciprocal link',
              };
              newNode.rightLinks.push(reciprocalLink);
            } else {
              updated[refNodeIndex].rightLinks.push(link);
              // Create reciprocal left link from new node to reference node
              const reciprocalLink: HorizontalLink = {
                targetId: referenceNodeId!,
                description: 'Reciprocal link',
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