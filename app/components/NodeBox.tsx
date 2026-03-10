'use client';

import { useState } from 'react';

interface NodeLink {
  id: string;
  source_id: string;
  target_id: string;
  description: string;
  type: string;
  created_at: string;
}

interface NodeBoxProps {
  id: string;
  title: string;
  content: string;
  type: 'project' | 'doc' | 'flow' | 'task' | 'step' | 'flow-run';
  status?: string;
  commentCount?: number;
  leftLinks?: NodeLink[];
  rightLinks?: NodeLink[];
  level?: number;
  onNavigate: (nodeId: string) => void;
  onAddComment: (nodeId: string) => void;
  onAddLink: (targetId: string, description: string, linkType: string) => void;
}

export default function NodeBox({ 
  id, 
  title, 
  content, 
  type,
  status,
  commentCount = 0,
  leftLinks = [],
  rightLinks = [],
  level = 0,
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

  const [showAddLinkForm, setShowAddLinkForm] = useState(false);
  const [linkTargetId, setLinkTargetId] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [linkType, setLinkType] = useState('reference');

  const handleAddLinkSubmit = (e: React.FormEvent) => {
    e.stopPropagation();
    if (linkTargetId.trim()) {
      onAddLink(linkTargetId, linkDescription, linkType);
      setShowAddLinkForm(false);
      setLinkTargetId('');
      setLinkDescription('');
      setLinkType('reference');
    }
  };

  const renderLink = (link: NodeLink, direction: 'left' | 'right') => (
    <button
      key={link.id}
      onClick={(e) => {
        e.stopPropagation();
        onNavigate(link.target_id);
      }}
      className="flex items-center gap-2 px-3 py-1.5 text-sm rounded bg-white hover:bg-gray-100 transition-colors border border-gray-200"
    >
      <span className="text-xs opacity-60">
        {direction === 'left' ? '←' : '→'}
      </span>
      <div className="text-left">
        <div className="font-medium text-gray-900">{link.description || 'Link'}</div>
        <div className="text-xs text-gray-500">{link.type} • Click to navigate</div>
      </div>
    </button>
  );

  return (
    <div 
      className={`rounded-lg ${getTypeColor()} p-4 transition-all hover:shadow-sm cursor-pointer border border-gray-200`}
      onClick={() => onNavigate(id)}
      style={{ marginLeft: level * 20 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">{getTypeIcon()}</span>
          <div>
            <h3 className="font-semibold text-gray-900">{title}</h3>
            {status && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                status === 'active' ? 'bg-green-100 text-green-800' :
                status === 'completed' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {status}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddComment(id);
            }}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-200 flex items-center gap-1"
            title="Add comment"
          >
            💬
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowAddLinkForm(!showAddLinkForm);
            }}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-200 flex items-center gap-1"
            title="Add link"
          >
            🔗
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="mb-4">
        <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
          {content || <span className="text-gray-400 italic">No content</span>}
        </div>
      </div>

      {/* Add Link Form */}
      {showAddLinkForm && (
        <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200" onClick={e => e.stopPropagation()}>
          <h4 className="text-sm font-medium text-gray-900 mb-2">Add Link</h4>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Target Node ID"
              value={linkTargetId}
              onChange={(e) => setLinkTargetId(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              onClick={e => e.stopPropagation()}
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={linkDescription}
              onChange={(e) => setLinkDescription(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              onClick={e => e.stopPropagation()}
            />
            <select
              value={linkType}
              onChange={(e) => setLinkType(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              onClick={e => e.stopPropagation()}
            >
              <option value="reference">Reference</option>
              <option value="dependency">Dependency</option>
              <option value="related">Related</option>
              <option value="parent">Parent</option>
              <option value="child">Child</option>
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleAddLinkSubmit}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                Add Link
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAddLinkForm(false);
                }}
                className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Links */}
      {(leftLinks.length > 0 || rightLinks.length > 0) && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center mb-2">
            <div className="text-xs font-medium text-gray-500">Links</div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowLinks(!showLinks);
              }}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              {showLinks ? 'Hide' : 'Show'} links
            </button>
          </div>
          
          {showLinks && (
            <div className="grid grid-cols-2 gap-2">
              {leftLinks.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Incoming Links</div>
                  <div className="space-y-1">
                    {leftLinks.map(link => renderLink(link, 'left'))}
                  </div>
                </div>
              )}
              {rightLinks.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Outgoing Links</div>
                  <div className="space-y-1">
                    {rightLinks.map(link => renderLink(link, 'right'))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}