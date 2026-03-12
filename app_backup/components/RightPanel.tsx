'use client';

import { Node } from '@/app/types';

interface RightPanelProps {
  node: Node | null;
  onUpdateNode: (node: Node) => void;
  onClose: () => void;
}

export default function RightPanel({ node, onUpdateNode, onClose }: RightPanelProps) {
  if (!node) {
    return (
      <div className="w-80 border-l border-gray-200 bg-white p-6">
        <div className="text-center text-gray-500">
          Select a node to edit
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 border-l border-gray-200 bg-white p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-medium text-gray-900">Edit Node</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-500"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Title
          </label>
          <input
            type="text"
            value={node.title}
            onChange={(e) => onUpdateNode({ ...node, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Content
          </label>
          <textarea
            value={node.content}
            onChange={(e) => onUpdateNode({ ...node, content: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={4}
          />
        </div>
        
        <div className="pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Node Info</h4>
          <div className="text-sm text-gray-500 space-y-1">
            <div>ID: {node.id.substring(0, 8)}...</div>
            <div>Created: {new Date(node.createdAt).toLocaleDateString()}</div>
            <div>Updated: {new Date(node.updatedAt).toLocaleDateString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}