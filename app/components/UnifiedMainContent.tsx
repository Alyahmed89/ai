'use client';

import { useState } from 'react';
import NodeBox from './NodeBox';

interface Node {
  id: string;
  title: string;
  content: string;
  type: 'project' | 'doc' | 'flow' | 'task' | 'step' | 'flow-run';
  commentCount?: number;
  leftLinks?: Array<{
    targetId: string;
    description?: string;
    type: 'doc' | 'flow' | 'task' | 'step' | 'flow-run';
  }>;
  rightLinks?: Array<{
    targetId: string;
    description?: string;
    type: 'doc' | 'flow' | 'task' | 'step' | 'flow-run';
  }>;
}

interface UnifiedMainContentProps {
  nodes: Node[];
  currentNodeType: string;
  onNavigateToNode: (nodeId: string) => void;
  onAddComment: (nodeId: string) => void;
  onAddLink: (nodeId: string) => void;
  onAddNewNode: () => void;
}

export default function UnifiedMainContent({
  nodes,
  currentNodeType,
  onNavigateToNode,
  onAddComment,
  onAddLink,
  onAddNewNode
}: UnifiedMainContentProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'project': return 'Projects';
      case 'doc': return 'Documents';
      case 'flow': return 'Flows';
      case 'task': return 'Tasks';
      case 'step': return 'Steps';
      case 'flow-run': return 'Flow Runs';
      default: return 'Items';
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Content */}
        {nodes.length === 0 ? (
          <div className="bg-gray-100 rounded-lg p-8 text-center">
            <div className="mx-auto w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No items found</h3>
            <p className="text-gray-600 mb-4">No {currentNodeType}s available</p>
          </div>
        ) : (
          <div className="space-y-3">
            {nodes.map(node => (
              <NodeBox
                key={node.id}
                id={node.id}
                title={node.title}
                content={node.content}
                type={node.type}
                commentCount={node.commentCount}
                leftLinks={node.leftLinks}
                rightLinks={node.rightLinks}
                onNavigate={onNavigateToNode}
                onAddComment={onAddComment}
                onAddLink={() => onAddLink(node.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}