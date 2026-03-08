'use client';

import { useState } from 'react';
import { Node } from '@/app/types';

interface NodeItemProps {
  node: Node;
  onEdit: (node: Node) => void;
  onDelete: (nodeId: string) => void;
  onAddAbove: (nodeId: string) => void;
  onAddBelow: (nodeId: string) => void;
  onAddLeft: (nodeId: string) => void;
  onAddRight: (nodeId: string) => void;
  onNavigateHorizontal: (nodeId: string, direction: 'left' | 'right') => void;
  onSelect?: (nodeId: string) => void;
}

export default function NodeItem({
  node,
  onEdit,
  onDelete,
  onAddAbove,
  onAddBelow,
  onAddLeft,
  onAddRight,
  onNavigateHorizontal,
  onSelect,
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

  return (
    <div className="relative group">
      <div 
        className="bg-white border border-gray-200 rounded-md p-4 text-sm hover:border-gray-400 transition-colors max-w-md mx-auto w-full cursor-pointer"
        onClick={() => onSelect && onSelect(node.id)}
      >
        {isEditing ? (
          <div className="space-y-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Title"
              autoFocus
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Content"
              rows={3}
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={handleCancel}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-medium text-gray-900">{node.title}</h3>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-xs text-gray-500 hover:text-blue-600"
                  title="Edit"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(node.id)}
                  className="text-xs text-gray-500 hover:text-red-600"
                  title="Delete"
                >
                  Delete
                </button>
              </div>
            </div>
            <p className="text-gray-600 mb-3">{node.content}</p>
            
            {/* Conditions */}
            {node.conditions && node.conditions.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {node.conditions.map((condition, index) => (
                  <span
                    key={index}
                    className="text-xs bg-gray-100 text-gray-700 rounded px-2 py-1"
                  >
                    {condition}
                  </span>
                ))}
              </div>
            )}
            
            {/* Horizontal links */}
            <div className="flex justify-between items-center">
              {node.leftLinks && node.leftLinks.length > 0 && (
                <div className="flex flex-col items-start">
                  {node.leftLinks.map((link, index) => (
                    <button
                      key={index}
                      onClick={() => onNavigateHorizontal(link.targetId, 'left')}
                      className="text-xs text-gray-500 hover:text-blue-600 flex items-center mb-1"
                    >
                      <span className="mr-1">←</span>
                      {link.condition || 'Link'}
                    </button>
                  ))}
                </div>
              )}
              
              {node.rightLinks && node.rightLinks.length > 0 && (
                <div className="flex flex-col items-end">
                  {node.rightLinks.map((link, index) => (
                    <button
                      key={index}
                      onClick={() => onNavigateHorizontal(link.targetId, 'right')}
                      className="text-xs text-gray-500 hover:text-blue-600 flex items-center mb-1"
                    >
                      {link.condition || 'Link'}
                      <span className="ml-1">→</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      
      {/* Action buttons - visible on hover */}
      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-2">
        <button
          onClick={() => onAddAbove(node.id)}
          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full w-6 h-6 flex items-center justify-center"
          title="Add above"
        >
          ↑
        </button>
        <button
          onClick={() => onAddBelow(node.id)}
          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full w-6 h-6 flex items-center justify-center"
          title="Add below"
        >
          ↓
        </button>
        <button
          onClick={() => onAddLeft(node.id)}
          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full w-6 h-6 flex items-center justify-center"
          title="Add left"
        >
          ←
        </button>
        <button
          onClick={() => onAddRight(node.id)}
          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full w-6 h-6 flex items-center justify-center"
          title="Add right"
        >
          →
        </button>
      </div>
    </div>
  );
}