'use client';

interface BreadcrumbItem {
  id: string;
  title: string;
  type: 'project' | 'doc' | 'flow' | 'task' | 'step' | 'flow-run';
}

interface UnifiedTopBarProps {
  breadcrumbs: BreadcrumbItem[];
  onNavigateBreadcrumb: (nodeId: string) => void;
}

export default function UnifiedTopBar({ breadcrumbs, onNavigateBreadcrumb }: UnifiedTopBarProps) {
  const getTypeIcon = (type: string) => {
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

  return (
    <div className="bg-gray-50 border-b border-gray-200">
      <div className="px-6">
        <div className="flex items-center h-12">
          {/* App Name */}
          <div className="flex-shrink-0 mr-6">
            <h1 className="text-lg font-semibold text-gray-900">Flowruns</h1>
          </div>
          
          {/* Breadcrumbs */}
          <div className="flex items-center space-x-1">
            {breadcrumbs.length === 0 ? (
              <span className="text-sm text-gray-500">Select a project</span>
            ) : (
              breadcrumbs.map((item, index) => (
                <div key={item.id} className="flex items-center">
                  {index > 0 && (
                    <span className="mx-1 text-gray-300">/</span>
                  )}
                  <button
                    onClick={() => onNavigateBreadcrumb(item.id)}
                    className={`px-2 py-1 text-sm transition-colors ${
                      index === breadcrumbs.length - 1 
                        ? 'text-gray-900 font-medium' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    <span className="truncate max-w-[120px]">{item.title}</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}