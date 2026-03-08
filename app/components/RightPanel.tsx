'use client';

import { Node } from '@/app/types';
import { useState } from 'react';

interface RightPanelProps {
  node: Node | null;
  onUpdateNode: (node: Node) => void;
  onClose: () => void;
}

export default function RightPanel({ node, onUpdateNode, onClose }: RightPanelProps) {
  const [conditions, setConditions] = useState<string[]>(node?.conditions || []);
  const [newCondition, setNewCondition] = useState('');

  if (!node) {
    return (
      <div className="w-80 border-l border-gray-200 bg-white p-6">
        <div className="text-center text-gray-500">
          Select a node to edit
        </div>
      </div>
    );
  }

  const handleAddCondition = () => {
    if (newCondition.trim()) {
      const updatedConditions = [...conditions, newCondition.trim()];
      setConditions(updatedConditions);
      onUpdateNode({ ...node, conditions: updatedConditions });
      setNewCondition('');
    }
  };

  const handleRemoveCondition = (index: number) => {
    const updatedConditions = conditions.filter((_, i) => i !== index);
    setConditions(updatedConditions);
    onUpdateNode({ ...node, conditions: updatedConditions });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddCondition();
    }
  };

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
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Conditions
          </label>
          <div className="flex mb-2">
            <input
              type="text"
              value={newCondition}
              onChange={(e) => setNewCondition(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Add condition..."
            />
            <button
              onClick={handleAddCondition}
              className="px-4 py-2 bg-blue-500 text-white rounded-r-md hover:bg-blue-600"
            >
              Add
            </button>
          </div>
          
          <div className="space-y-2">
            {conditions.map((condition, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded"
              >
                <span className="text-sm text-gray-700">{condition}</span>
                <button
                  onClick={() => handleRemoveCondition(index)}
                  className="text-gray-400 hover:text-red-500"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
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