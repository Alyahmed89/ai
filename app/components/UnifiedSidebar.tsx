'use client';

import { useState } from 'react';

interface Node {
  id: string;
  title: string;
  type: 'project' | 'doc' | 'flow' | 'task' | 'step' | 'flow-run';
  children?: Node[];
  content?: string;
}

interface UnifiedSidebarProps {
  nodes: Node[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  onBack: () => void;
  currentPath: Node[];
}

export default function UnifiedSidebar({ 
  nodes, 
  selectedNodeId, 
  onSelectNode,
  onBack,
  currentPath 
}: UnifiedSidebarProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const toggleExpand = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const renderNode = (node: Node, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = selectedNodeId === node.id;

    return (
      <div key={node.id}>
        <div
          className={`flex items-center justify-between px-4 py-2 hover:bg-gray-100 cursor-pointer transition-colors ${
            isSelected ? 'bg-gray-200 border-l-2 border-gray-800' : ''
          }`}
          style={{ paddingLeft: `${depth * 16 + 16}px` }}
          onClick={() => onSelectNode(node.id)}
        >
          <span className="text-sm font-medium text-gray-900 truncate">
            {node.title}
          </span>
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.id);
              }}
              className="ml-2 text-gray-500 hover:text-gray-700"
            >
              {isExpanded ? '−' : '›'}
            </button>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div>
            {node.children!.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-64 bg-gray-50 overflow-y-auto h-full flex flex-col">
      {/* Back button for nested navigation */}
      {currentPath.length > 1 && (
        <div className="bg-gray-100">
          <button
            onClick={onBack}
            className="w-full px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-200 flex items-center gap-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>
      )}

      {/* Node list */}
      <div className="flex-1 overflow-y-auto py-2 bg-gray-50">
        {nodes.length === 0 ? (
          <div className="px-4 py-8 text-center bg-gray-50">
            <div className="text-gray-400 mb-2">No items found</div>
            <div className="text-xs text-gray-500">Select a project to get started</div>
          </div>
        ) : (
          nodes.map(node => renderNode(node))
        )}
      </div>
    </div>
  );
}