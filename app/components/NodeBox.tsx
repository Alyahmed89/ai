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

interface NodeDependency {
  id: string;
  node_id: string;
  depends_on_id: string;
  type: string;
  metadata: string | null;
  created_at: number;
  updated_at: number;
}

interface NodeRelationship {
  id: string;
  source_id: string;
  target_id: string;
  type: string;
  metadata: string;
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
  dependencies?: NodeDependency[];
  relationships?: NodeRelationship[];
  level?: number;
  onNavigate: (nodeId: string) => void;
  onAddComment: (nodeId: string) => void;
  onAddLink: (targetId: string, description: string, linkType: string) => void;
}

// Alternative props for flowrun display
interface FlowRunNodeBoxProps {
  node: {
    id: string;
    name: string;
    type: 'project' | 'doc' | 'flow' | 'task' | 'step' | 'flow-run';
    description?: string;
    status?: string;
    created_at?: number;
    updated_at?: number;
    flow_id?: string;
    duration_ms?: number;
  };
  onNavigate: (nodeId: string) => void;
  onAddComment: (nodeId: string) => void;
  onAddLink: (targetId: string, description: string, linkType: string) => void;
  dependencies?: NodeDependency[];
  relationships?: NodeRelationship[];
}

type Props = NodeBoxProps | FlowRunNodeBoxProps;

export default function NodeBox(props: Props) {
  // Extract props based on which interface is used
  const isFlowRunProps = 'node' in props;
  
  const id = isFlowRunProps ? props.node.id : props.id;
  const title = isFlowRunProps ? props.node.name : props.title;
  const content = isFlowRunProps ? (props.node.description || '') : props.content;
  const type = isFlowRunProps ? props.node.type : props.type;
  const status = isFlowRunProps ? props.node.status : props.status;
  const commentCount = isFlowRunProps ? 0 : props.commentCount || 0;
  const leftLinks = isFlowRunProps ? [] : props.leftLinks || [];
  const rightLinks = isFlowRunProps ? [] : props.rightLinks || [];
  const dependencies = isFlowRunProps ? (props.dependencies || []) : (props.dependencies || []);
  const relationships = isFlowRunProps ? (props.relationships || []) : (props.relationships || []);
  const level = isFlowRunProps ? 0 : (props.level || 0);
  const onNavigate = isFlowRunProps ? props.onNavigate : props.onNavigate;
  const onAddComment = isFlowRunProps ? props.onAddComment : props.onAddComment;
  const onAddLink = isFlowRunProps ? props.onAddLink : props.onAddLink;
  
  // Additional flowrun data
  const flowRunData = isFlowRunProps ? props.node : null;
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

  const renderDependency = (dependency: NodeDependency) => (
    <button
      key={dependency.id}
      onClick={(e) => {
        e.stopPropagation();
        onNavigate(dependency.depends_on_id);
      }}
      className="flex items-center gap-2 px-3 py-1.5 text-sm rounded bg-white hover:bg-gray-100 transition-colors border border-gray-200"
    >
      <span className="text-xs opacity-60">📋</span>
      <div className="text-left">
        <div className="font-medium text-gray-900">Depends on</div>
        <div className="text-xs text-gray-500">{dependency.type} • Click to navigate</div>
      </div>
    </button>
  );

  const renderRelationship = (relationship: NodeRelationship) => (
    <button
      key={relationship.id}
      onClick={(e) => {
        e.stopPropagation();
        onNavigate(relationship.target_id);
      }}
      className="flex items-center gap-2 px-3 py-1.5 text-sm rounded bg-white hover:bg-gray-100 transition-colors border border-gray-200"
    >
      <span className="text-xs opacity-60">🔗</span>
      <div className="text-left">
        <div className="font-medium text-gray-900">{relationship.type}</div>
        <div className="text-xs text-gray-500">Relationship • Click to navigate</div>
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
                status === 'active' || status === 'running' ? 'bg-green-100 text-green-800' :
                status === 'completed' ? 'bg-blue-100 text-blue-800' :
                status === 'failed' ? 'bg-red-100 text-red-800' :
                status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {status}
              </span>
            )}
          </div>
        </div>
        

      </div>

      {/* Content */}
      <div className="mb-4">
        <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
          {content || <span className="text-gray-400 italic">No content</span>}
        </div>
        
        {/* Flowrun-specific information */}
        {type === 'flow-run' && flowRunData && (
          <div className="mt-3 space-y-2 text-xs">
            {flowRunData.flow_id && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Flow ID:</span>
                <span className="font-mono text-gray-700">{flowRunData.flow_id}</span>
              </div>
            )}
            {flowRunData.duration_ms !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Duration:</span>
                <span className="font-medium text-gray-700">
                  {(flowRunData.duration_ms / 1000).toFixed(2)}s
                </span>
              </div>
            )}
            {flowRunData.created_at && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Created:</span>
                <span className="text-gray-700">
                  {new Date(flowRunData.created_at * 1000).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}
      </div>



      {/* Links - Always visible */}
      {(leftLinks.length > 0 || rightLinks.length > 0) && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="text-xs font-medium text-gray-500 mb-2">Links</div>
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
        </div>
      )}

      {/* Dependencies - Always visible */}
      {dependencies.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="text-xs font-medium text-gray-500 mb-2">Dependencies</div>
          <div className="space-y-1">
            {dependencies.map(dep => renderDependency(dep))}
          </div>
        </div>
      )}

      {/* Relationships - Always visible */}
      {relationships.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="text-xs font-medium text-gray-500 mb-2">Relationships</div>
          <div className="space-y-1">
            {relationships.map(rel => renderRelationship(rel))}
          </div>
        </div>
      )}
    </div>
  );
}