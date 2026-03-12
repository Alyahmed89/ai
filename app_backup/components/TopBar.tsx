'use client';

import { BreadcrumbItem } from '@/app/types';

interface TopBarProps {
  projectName: string;
  breadcrumbs: BreadcrumbItem[];
  onNewNode: () => void;
  onNavigateBreadcrumb?: (nodeId: string) => void;
}

export default function TopBar({ projectName, breadcrumbs, onNewNode, onNavigateBreadcrumb }: TopBarProps) {
  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-lg font-semibold text-gray-900">{projectName}</h1>
            
            {/* Breadcrumb */}
            <div className="ml-6 flex items-center space-x-2">
              {breadcrumbs.map((item, index) => (
                <div key={item.id} className="flex items-center">
                  {index > 0 && (
                    <span className="mx-2 text-gray-400">/</span>
                  )}
                  <button 
                    onClick={() => onNavigateBreadcrumb?.(item.id)}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    {item.title}
                  </button>
                </div>
              ))}
            </div>
          </div>
          
          <button
            onClick={onNewNode}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            + New
          </button>
        </div>
      </div>
    </div>
  );
}