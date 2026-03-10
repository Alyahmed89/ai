'use client';

import { useState } from 'react';
import NodeBox from './NodeBox';

interface NodeLink {
  id: string;
  source_id: string;
  target_id: string;
  description: string;
  type: string;
  created_at: string;
}

interface Node {
  id: string;
  title: string;
  content: string;
  type: 'project' | 'doc' | 'flow' | 'task' | 'step' | 'flow-run';
  status?: string;
  commentCount?: number;
  children?: Node[];
  leftLinks?: NodeLink[];
  rightLinks?: NodeLink[];
  dependencies?: any[];
  relationships?: any[];
  project_id?: string;
  parent_id?: string;
}

interface UnifiedMainContentProps {
  nodes: Node[];
  currentNodeType: string;
  onNavigateToNode: (nodeId: string) => void;
  onAddComment: (nodeId: string) => void;
  onAddLink: (nodeId: string, targetId: string, description: string, linkType: string) => void;
  onAddNewNode: (title: string, content: string, type: string, parentId?: string) => void;
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

  // Recursive function to render nodes with hierarchy
  const renderNodeTree = (nodeList: Node[], level = 0) => {
    return nodeList.map(node => (
      <div key={node.id} className={level > 0 ? 'ml-6 border-l-2 border-gray-200 pl-4' : ''}>
        <NodeBox
          id={node.id}
          title={node.title}
          content={node.content}
          type={node.type}
          status={node.status}
          commentCount={node.commentCount}
          leftLinks={node.leftLinks}
          rightLinks={node.rightLinks}
          dependencies={node.dependencies}
          relationships={node.relationships}
          onNavigate={onNavigateToNode}
          onAddComment={onAddComment}
          onAddLink={(targetId, description, linkType) => onAddLink(node.id, targetId, description, linkType)}
          level={level}
        />
        {node.children && node.children.length > 0 && (
          <div className="mt-2">
            {renderNodeTree(node.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{getTypeLabel(currentNodeType)}</h1>
            <p className="text-gray-600 mt-1">
              {nodes.length} {nodes.length === 1 ? 'item' : 'items'} total
            </p>
          </div>
        </div>

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
          <div className="space-y-4">
            {renderNodeTree(nodes)}
          </div>
        )}
      </div>
    </div>
  );
}