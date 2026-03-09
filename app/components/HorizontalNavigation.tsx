'use client';

import { Node } from '@/app/types';

interface HorizontalNavigationProps {
  nodes: Node[];
  currentNodeId: string;
  onNavigate: (nodeId: string) => void;
}

export default function HorizontalNavigation({ 
  nodes, 
  currentNodeId, 
  onNavigate 
}: HorizontalNavigationProps) {
  const currentNode = nodes.find(node => node.id === currentNodeId);
  
  if (!currentNode) return null;

  // Get all horizontal links (left and right combined)
  const allHorizontalLinks = [
    ...currentNode.leftLinks.map(link => ({ ...link, direction: 'left' as const })),
    ...currentNode.rightLinks.map(link => ({ ...link, direction: 'right' as const }))
  ];

  if (allHorizontalLinks.length === 0) return null;

  // Group links by direction for simpler navigation
  const leftLinks = currentNode.leftLinks;
  const rightLinks = currentNode.rightLinks;

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-10">
      <div className="flex items-center space-x-4 bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg border border-gray-200">
        {leftLinks.length > 0 && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                // Navigate to the first left link
                if (leftLinks[0]) {
                  onNavigate(leftLinks[0].targetId);
                }
              }}
              className="text-gray-600 hover:text-blue-600 p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
              title={`Navigate to ${leftLinks.length} left node${leftLinks.length > 1 ? 's' : ''}`}
            >
              <span className="text-lg">←</span>
              {leftLinks.length > 1 && (
                <span className="text-xs bg-blue-100 text-blue-600 rounded-full w-5 h-5 flex items-center justify-center ml-1">
                  {leftLinks.length}
                </span>
              )}
            </button>
            <div className="text-xs text-gray-500">
              {leftLinks.length} left
            </div>
          </div>
        )}
        
        {rightLinks.length > 0 && (
          <div className="flex items-center space-x-2">
            <div className="text-xs text-gray-500">
              {rightLinks.length} right
            </div>
            <button
              onClick={() => {
                // Navigate to the first right link
                if (rightLinks[0]) {
                  onNavigate(rightLinks[0].targetId);
                }
              }}
              className="text-gray-600 hover:text-blue-600 p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
              title={`Navigate to ${rightLinks.length} right node${rightLinks.length > 1 ? 's' : ''}`}
            >
              <span className="text-lg">→</span>
              {rightLinks.length > 1 && (
                <span className="text-xs bg-blue-100 text-blue-600 rounded-full w-5 h-5 flex items-center justify-center mr-1">
                  {rightLinks.length}
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}