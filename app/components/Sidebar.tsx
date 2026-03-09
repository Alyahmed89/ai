'use client';

import { Node } from '@/app/types';
import { useState } from 'react';

interface SidebarProps {
  nodes: Node[];
  currentNodeId: string;
  onSelectNode: (nodeId: string) => void;
}

export default function Sidebar({ nodes, currentNodeId, onSelectNode }: SidebarProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['1'])); // Start with root expanded

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  // Build tree structure
  const buildTree = () => {
    const nodeMap = new Map<string, Node>();
    const childrenMap = new Map<string, Node[]>();
    
    // Create maps
    nodes.forEach(node => {
      nodeMap.set(node.id, node);
    });
    
    // Build children map
    nodes.forEach(node => {
      node.children.forEach(child => {
        const childList = childrenMap.get(node.id) || [];
        const childNode = nodeMap.get(child.nodeId);
        if (childNode) {
          childList.push(childNode);
        }
        childrenMap.set(node.id, childList);
      });
    });
    
    // Get root nodes (nodes with no parent)
    const rootNodes = nodes.filter(node => !node.parentId);
    
    return { rootNodes, nodeMap, childrenMap };
  };

  const { rootNodes, nodeMap, childrenMap } = buildTree();

  const renderNode = (node: Node, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const isCurrent = node.id === currentNodeId;
    const children = childrenMap.get(node.id) || [];
    const hasChildren = children.length > 0;

    return (
      <div key={node.id} className="select-none">
        <div 
          className={`flex items-center py-2 px-3 hover:bg-gray-50 cursor-pointer transition-colors duration-150 ${
            isCurrent ? 'bg-blue-50 border-l-4 border-blue-500' : ''
          }`}
          style={{ paddingLeft: `${depth * 20 + 12}px` }}
          onClick={() => onSelectNode(node.id)}
        >
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(node.id);
              }}
              className="mr-2 w-5 h-5 flex items-center justify-center text-gray-500 hover:text-gray-700"
            >
              {isExpanded ? '−' : '+'}
            </button>
          )}
          {!hasChildren && <div className="mr-2 w-5"></div>}
          <div className="flex-1 truncate">
            <div className={`font-medium ${isCurrent ? 'text-blue-600' : 'text-gray-700'}`}>
              {node.title}
            </div>
            {node.children.length > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                {node.children.length} child{node.children.length !== 1 ? 'ren' : ''}
              </div>
            )}
          </div>
        </div>
        
        {isExpanded && hasChildren && (
          <div>
            {children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-64 border-r border-gray-200 bg-white overflow-y-auto h-full">
      <div className="p-4 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900">Documentation Tree</h2>
        <p className="text-xs text-gray-500 mt-1">All nodes in hierarchy</p>
      </div>
      
      <div className="py-2">
        {rootNodes.map(node => renderNode(node))}
      </div>
      
      <div className="p-4 border-t border-gray-200 text-xs text-gray-500">
        <div className="flex items-center justify-between">
          <span>Total nodes: {nodes.length}</span>
          <button
            onClick={() => setExpandedNodes(new Set())}
            className="text-blue-600 hover:text-blue-800"
          >
            Collapse all
          </button>
        </div>
      </div>
    </div>
  );
}