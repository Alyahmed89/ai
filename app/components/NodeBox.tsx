'use client';

import { useState } from 'react';

interface NodeLink {
  targetId: string;
  description?: string;
  type: 'doc' | 'flow' | 'task' | 'step' | 'flow-run';
}

interface NodeBoxProps {
  id: string;
  title: string;
  content: string;
  type: 'project' | 'doc' | 'flow' | 'task' | 'step' | 'flow-run';
  commentCount?: number;
  leftLinks?: NodeLink[];
  rightLinks?: NodeLink[];
  onNavigate: (nodeId: string) => void;
  onAddComment: (nodeId: string) => void;
  onAddLink: () => void;
}

export default function NodeBox({ 
  id, 
  title, 
  content, 
  type,
  commentCount = 0,
  leftLinks = [],
  rightLinks = [],
  onNavigate,
  onAddComment,
  onAddLink
}: NodeBoxProps) {
  const [showLinks, setShowLinks] = useState(false);

  const getTypeColor = () => {
    return 'bg-gray-100';
  };

  const getTypeIcon = () => {
    switch (type) {
      case 'project': return '📁';
      case 'doc': return '📄';
      case 'flow': return '↳';
      case 'task': return '✓';
      case 'step': return '→';
      case 'flow-run': return '↻';
      default: return '•';
    }
  };

  const renderLink = (link: NodeLink, direction: 'left' | 'right') => (
    <button
      key={link.targetId}
      onClick={() => onNavigate(link.targetId)}
      className="flex items-center gap-2 px-3 py-1.5 text-sm rounded bg-white hover:bg-gray-100 transition-colors"
    >
      <span className="text-xs opacity-60">
        {direction === 'left' ? '←' : '→'}
      </span>
      <div className="text-left">
        <div className="font-medium text-gray-900">{link.description || 'Link'}</div>
        <div className="text-xs text-gray-500">Click to navigate</div>
      </div>
    </button>
  );

  return (
    <div 
      className={`rounded-lg ${getTypeColor()} p-4 transition-all hover:shadow-sm cursor-pointer`}
      onClick={() => onNavigate(id)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">{getTypeIcon()}</span>
          <h3 className="font-semibold text-gray-900">{title}</h3>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddComment(id);
            }}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-200 flex items-center gap-1"
          >
            💬
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="mb-4">
        <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
          {content || <span className="text-gray-400 italic">No content</span>}
        </div>
      </div>
    </div>
  );
}