'use client';

interface StepHeaderProps {
  title: string;
  stepType: string;
  orderIndex: number;
  stepKey: string;
  flowId: string;
  isEditing?: boolean;
  onTitleChange?: (title: string) => void;
  onStepTypeChange?: (type: string) => void;
}

export default function StepHeader({
  title,
  stepType,
  orderIndex,
  stepKey,
  flowId,
  isEditing = false,
  onTitleChange,
  onStepTypeChange
}: StepHeaderProps) {
  const stepTypeColors: Record<string, string> = {
    'database': 'bg-blue-100 text-blue-800',
    'api': 'bg-green-100 text-green-800',
    'browser': 'bg-purple-100 text-purple-800',
    'script': 'bg-yellow-100 text-yellow-800',
    'default': 'bg-gray-100 text-gray-800'
  };

  const getStepTypeColor = (type: string) => {
    return stepTypeColors[type] || stepTypeColors.default;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1">
          {isEditing ? (
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange?.(e.target.value)}
              className="text-2xl font-bold text-gray-800 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Step title"
            />
          ) : (
            <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
          )}
          
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStepTypeColor(stepType)}`}>
              {stepType.charAt(0).toUpperCase() + stepType.slice(1)}
            </span>
            
            <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
              Order: {orderIndex}
            </span>
            
            <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
              Key: {stepKey}
            </span>
            
            <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
              Flow: {flowId}
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {isEditing && onStepTypeChange && (
            <select
              value={stepType}
              onChange={(e) => onStepTypeChange?.(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="database">Database</option>
              <option value="api">API</option>
              <option value="browser">Browser</option>
              <option value="script">Script</option>
              <option value="other">Other</option>
            </select>
          )}
          
          <div className="text-right">
            <div className="text-sm text-gray-500">Step ID</div>
            <div className="font-mono text-sm text-gray-700">{stepKey}</div>
          </div>
        </div>
      </div>
    </div>
  );
}