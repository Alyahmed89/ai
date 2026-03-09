'use client';

import { useState } from 'react';
import { Node } from '@/app/types';

interface NodeItemProps {
  node: Node;
  nodes: Node[];
  onEdit: (node: Node) => void;
  onDelete: (nodeId: string) => void;
  onAddAbove: (nodeId: string) => void;
  onAddBelow: (nodeId: string) => void;
  onAddLeft: (nodeId: string) => void;
  onAddRight: (nodeId: string) => void;
  onNavigateHorizontal: (nodeId: string, direction: 'left' | 'right') => void;
}

export default function NodeItem({
  node,
  nodes,
  onEdit,
  onDelete,
  onAddAbove,
  onAddBelow,
  onAddLeft,
  onAddRight,
  onNavigateHorizontal,
}: NodeItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(node.title);
  const [content, setContent] = useState(node.content);

  const handleSave = () => {
    onEdit({ ...node, title, content });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTitle(node.title);
    setContent(node.content);
    setIsEditing(false);
  };

  // Helper function to get node title by ID
  const getNodeTitle = (nodeId: string) => {
    const targetNode = nodes.find(n => n.id === nodeId);
    return targetNode ? targetNode.title : 'Unknown Node';
  };

  // Get child nodes with their conditions
  const childNodes = node.children.map(child => {
    const childNode = nodes.find(n => n.id === child.nodeId);
    return {
      node: childNode,
      condition: child.condition
    };
  }).filter(item => item.node);

  return (
    <div className="relative group w-full">
      <div 
        className="border-b border-gray-200 p-6 text-sm animate-fade-in w-full"
      >
        {isEditing ? (
          <div className="space-y-4 animate-slide-in-up">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="Enter node title"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Content</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="Enter node content"
                rows={4}
              />
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-300 transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-lg shadow-sm hover:shadow transition-all duration-200"
              >
                Save Changes
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold text-gray-900 text-lg bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">{node.title}</h3>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex space-x-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-xs text-blue-600 hover:text-blue-800 px-3 py-1.5 font-medium"
                  title="Edit"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(node.id)}
                  className="text-xs text-red-600 hover:text-red-800 px-3 py-1.5 font-medium"
                  title="Delete"
                >
                  Delete
                </button>
              </div>
            </div>
            <p className="text-gray-600 mb-3">{node.content}</p>
            
            {/* Child nodes with conditions */}
            {childNodes.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-medium text-gray-500 mb-2">Child Nodes:</div>
                <div className="flex flex-wrap gap-2">
                  {childNodes.map((child, index) => (
                    <div key={index} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg">
                      <div className="font-medium text-gray-700">{child.node?.title}</div>
                      {child.condition && (
                        <div className="text-gray-500 mt-1">{child.condition}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Horizontal links with conditions displayed on arrows */}
            <div className="flex justify-between items-center relative">
              {node.leftLinks && node.leftLinks.length > 0 && (
                <div className="flex flex-col items-start space-y-2">
                  {node.leftLinks.map((link, index) => (
                    <div key={index} className="relative">
                      <button
                        onClick={() => onNavigateHorizontal(link.targetId, 'left')}
                        className="text-xs text-gray-600 hover:text-blue-600 flex items-center px-2 py-1 group"
                        title={link.description}
                      >
                        <span className="mr-1 text-gray-400 group-hover:text-blue-500">←</span>
                        <span className="font-medium truncate max-w-[120px]">{getNodeTitle(link.targetId)}</span>
                      </button>
                      {link.description && (
                        <div className="text-xs text-gray-500 mt-1 px-2 py-0.5 border border-gray-200 rounded">
                          {link.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {node.rightLinks && node.rightLinks.length > 0 && (
                <div className="flex flex-col items-end space-y-2">
                  {node.rightLinks.map((link, index) => (
                    <div key={index} className="relative">
                      <button
                        onClick={() => onNavigateHorizontal(link.targetId, 'right')}
                        className="text-xs text-gray-600 hover:text-blue-600 flex items-center px-2 py-1 group"
                        title={link.description}
                      >
                        <span className="font-medium truncate max-w-[120px]">{getNodeTitle(link.targetId)}</span>
                        <span className="ml-1 text-gray-400 group-hover:text-blue-500">→</span>
                      </button>
                      {link.description && (
                        <div className="text-xs text-gray-500 mt-1 px-2 py-0.5 border border-gray-200 rounded">
                          {link.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      
      {/* Action buttons - visible on hover */}
      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 flex space-x-2">
        <button
          onClick={() => onAddAbove(node.id)}
          className="text-xs text-gray-500 hover:text-blue-600 rounded-full w-8 h-8 flex items-center justify-center hover:scale-110 transition-transform duration-200"
          title="Add above"
        >
          <span className="font-bold">↑</span>
        </button>
        <button
          onClick={() => onAddBelow(node.id)}
          className="text-xs text-gray-500 hover:text-green-600 rounded-full w-8 h-8 flex items-center justify-center hover:scale-110 transition-transform duration-200"
          title="Add below"
        >
          <span className="font-bold">↓</span>
        </button>
        <button
          onClick={() => onAddLeft(node.id)}
          className="text-xs text-gray-500 hover:text-purple-600 rounded-full w-8 h-8 flex items-center justify-center hover:scale-110 transition-transform duration-200"
          title="Add left"
        >
          <span className="font-bold">←</span>
        </button>
        <button
          onClick={() => onAddRight(node.id)}
          className="text-xs text-gray-500 hover:text-amber-600 rounded-full w-8 h-8 flex items-center justify-center hover:scale-110 transition-transform duration-200"
          title="Add right"
        >
          <span className="font-bold">→</span>
        </button>
      </div>
    </div>
  );
}