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
        className="bg-white border border-gray-200 rounded-xl p-6 text-sm hover:border-blue-300 hover:shadow-lg transition-all duration-300 max-w-md mx-auto w-full cursor-pointer animate-fade-in"
        onClick={() => onSelect && onSelect(node.id)}
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
                  className="text-xs bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 text-blue-700 hover:text-blue-800 px-3 py-1.5 rounded-lg border border-blue-200 hover:border-blue-300 transition-all duration-200 hover:shadow-sm font-medium"
                  title="Edit"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(node.id)}
                  className="text-xs bg-gradient-to-r from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 text-red-700 hover:text-red-800 px-3 py-1.5 rounded-lg border border-red-200 hover:border-red-300 transition-all duration-200 hover:shadow-sm font-medium"
                  title="Delete"
                >
                  Delete
                </button>
              </div>
            </div>
            <p className="text-gray-600 mb-3">{node.content}</p>
            
            {/* Horizontal links with conditions displayed on arrows */}
            <div className="flex justify-between items-center relative">
              {node.leftLinks && node.leftLinks.length > 0 && (
                <div className="flex flex-col items-start space-y-2">
                  {node.leftLinks.map((link, index) => (
                    <div key={index} className="relative arrow-connector arrow-connector-left">
                      <button
                        onClick={() => onNavigateHorizontal(link.targetId, 'left')}
                        className="text-xs text-gray-700 hover:text-blue-600 flex items-center px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-all duration-200 hover:shadow-sm group"
                        title={link.description || link.condition}
                      >
                        <span className="mr-2 text-gray-400 group-hover:text-blue-500">←</span>
                        <span className="font-medium">Left Link</span>
                      </button>
                      {link.condition && (
                        <div className="condition-badge condition-badge-left">
                          <span className="text-gray-700 font-medium">{link.condition}</span>
                          {link.description && (
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-20">
                              {link.description}
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-800"></div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {node.rightLinks && node.rightLinks.length > 0 && (
                <div className="flex flex-col items-end space-y-2">
                  {node.rightLinks.map((link, index) => (
                    <div key={index} className="relative arrow-connector arrow-connector-right">
                      <button
                        onClick={() => onNavigateHorizontal(link.targetId, 'right')}
                        className="text-xs text-gray-700 hover:text-blue-600 flex items-center px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-all duration-200 hover:shadow-sm group"
                        title={link.description || link.condition}
                      >
                        <span className="font-medium">Right Link</span>
                        <span className="ml-2 text-gray-400 group-hover:text-blue-500">→</span>
                      </button>
                      {link.condition && (
                        <div className="condition-badge condition-badge-right">
                          <span className="text-gray-700 font-medium">{link.condition}</span>
                          {link.description && (
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-20">
                              {link.description}
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-800"></div>
                            </div>
                          )}
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
      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 flex space-x-2 bg-white/90 backdrop-blur-sm rounded-full p-1 shadow-lg border border-gray-200">
        <button
          onClick={() => onAddAbove(node.id)}
          className="text-xs bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 text-blue-700 rounded-full w-8 h-8 flex items-center justify-center hover:scale-110 transition-transform duration-200 shadow-sm"
          title="Add above"
        >
          <span className="font-bold">↑</span>
        </button>
        <button
          onClick={() => onAddBelow(node.id)}
          className="text-xs bg-gradient-to-br from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 text-green-700 rounded-full w-8 h-8 flex items-center justify-center hover:scale-110 transition-transform duration-200 shadow-sm"
          title="Add below"
        >
          <span className="font-bold">↓</span>
        </button>
        <button
          onClick={() => onAddLeft(node.id)}
          className="text-xs bg-gradient-to-br from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 text-purple-700 rounded-full w-8 h-8 flex items-center justify-center hover:scale-110 transition-transform duration-200 shadow-sm"
          title="Add left"
        >
          <span className="font-bold">←</span>
        </button>
        <button
          onClick={() => onAddRight(node.id)}
          className="text-xs bg-gradient-to-br from-amber-50 to-amber-100 hover:from-amber-100 hover:to-amber-200 text-amber-700 rounded-full w-8 h-8 flex items-center justify-center hover:scale-110 transition-transform duration-200 shadow-sm"
          title="Add right"
        >
          <span className="font-bold">→</span>
        </button>
      </div>
    </div>
  );
}