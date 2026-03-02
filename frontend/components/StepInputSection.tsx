'use client';

interface StepInputSectionProps {
  inputKeys?: string[];
  payloadTemplate?: string | null;
  isEditing?: boolean;
  onInputKeysChange?: (keys: string[]) => void;
  onPayloadTemplateChange?: (template: string) => void;
}

export default function StepInputSection({
  inputKeys = [],
  payloadTemplate = '',
  isEditing = false,
  onInputKeysChange,
  onPayloadTemplateChange
}: StepInputSectionProps) {
  const variableColors: Record<string, string> = {
    'account_id': 'bg-red-100 text-red-800',
    'api_token': 'bg-orange-100 text-orange-800',
    'database_id': 'bg-yellow-100 text-yellow-800',
    'sql_query': 'bg-green-100 text-green-800',
    'url': 'bg-blue-100 text-blue-800',
    'method': 'bg-indigo-100 text-indigo-800',
    'headers': 'bg-purple-100 text-purple-800',
    'body': 'bg-pink-100 text-pink-800',
    'default': 'bg-gray-100 text-gray-800'
  };

  const getVariableColor = (key: string) => {
    if (!key) return variableColors.default;
    for (const [pattern, color] of Object.entries(variableColors)) {
      if (key.includes && key.includes(pattern)) return color;
    }
    return variableColors.default;
  };

  const handleAddInputKey = () => {
    const newKey = prompt('Enter new input key:');
    if (newKey && newKey.trim()) {
      onInputKeysChange?.([...inputKeys, newKey.trim()]);
    }
  };

  const handleRemoveInputKey = (index: number) => {
    const newKeys = [...inputKeys];
    newKeys.splice(index, 1);
    onInputKeysChange?.(newKeys);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Input</h2>
        <div className="flex items-center space-x-2">
          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
            {inputKeys.length} variable{inputKeys.length !== 1 ? 's' : ''}
          </span>
          {isEditing && (
            <button
              onClick={handleAddInputKey}
              className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
            >
              + Add Variable
            </button>
          )}
        </div>
      </div>

      {/* Input Variables */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Input Variables</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {inputKeys.length > 0 ? (
            inputKeys.map((key, index) => (
              <div
                key={index}
                className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 ${getVariableColor(key)}`}
              >
                <span>{key}</span>
                {isEditing && (
                  <button
                    onClick={() => handleRemoveInputKey(index)}
                    className="text-xs opacity-70 hover:opacity-100"
                    aria-label={`Remove ${key}`}
                  >
                    ×
                  </button>
                )}
              </div>
            ))
          ) : (
            <div className="text-gray-500 text-sm italic">No input variables defined</div>
          )}
        </div>
      </div>

      {/* Request Payload */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Request Payload</h3>
        {isEditing ? (
          <textarea
            value={payloadTemplate}
            onChange={(e) => onPayloadTemplateChange?.(e.target.value)}
            className="w-full h-40 font-mono text-sm p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter request payload template..."
          />
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
            <div className="font-mono text-sm text-gray-800 whitespace-pre-wrap">
              {payloadTemplate || 'No payload template defined'}
            </div>
          </div>
        )}
        
        {payloadTemplate && (
          <div className="mt-3 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Template variables will be replaced at runtime</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}