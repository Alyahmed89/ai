'use client';

import { Node } from '@/app/types';

interface HorizontalTransitionProps {
  nodes: Node[];
  currentNodeId: string;
  direction: 'left' | 'right';
  onNavigate: (nodeId: string) => void;
}

export default function HorizontalTransition({ 
  nodes, 
  currentNodeId, 
  direction, 
  onNavigate 
}: HorizontalTransitionProps) {
  const currentNode = nodes.find(node => node.id === currentNodeId);
  
  if (!currentNode) return null;

  const links = direction === 'left' ? currentNode.leftLinks : currentNode.rightLinks;
  
  if (links.length === 0) return null;

  return (
    <div className={`fixed top-1/2 transform -translate-y-1/2 ${direction === 'left' ? 'left-4' : 'right-4'} z-10`}>
      <div className="flex flex-col space-y-2">
        {links.map((link, index) => {
          const targetNode = nodes.find(node => node.id === link.targetId);
          if (!targetNode) return null;
          
          return (
            <div key={index} className="flex flex-col items-center">
              <button
                onClick={() => onNavigate(link.targetId)}
                className={`text-sm text-gray-600 hover:text-blue-600 px-3 py-2 rounded-lg border border-gray-200 hover:border-blue-300 transition-all duration-200 flex items-center ${
                  direction === 'left' ? 'flex-row-reverse' : ''
                }`}
              >
                {direction === 'left' ? (
                  <>
                    <span className="ml-2">←</span>
                    <span className="truncate max-w-[140px]">{targetNode.title}</span>
                  </>
                ) : (
                  <>
                    <span className="truncate max-w-[140px]">{targetNode.title}</span>
                    <span className="ml-2">→</span>
                  </>
                )}
              </button>
              
              {link.description && (
                <div className="text-xs text-gray-500 mt-1 px-2 py-1 bg-gray-50 rounded border border-gray-200">
                  {link.description}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}