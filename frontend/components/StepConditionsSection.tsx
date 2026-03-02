'use client';

interface Condition {
  id: string;
  flow_step_id: string;
  condition_type: string;
  condition_value: string;
  condition_operator?: string | null;
  next_step?: number | null;
  created_at?: string | number;
  updated_at?: string | number;
}

interface StepConditionsSectionProps {
  conditions?: Condition[];
  stepId?: string;
  isEditing?: boolean;
  onConditionsChange?: (conditions: Condition[]) => void;
  onAddCondition?: () => void;
  onRemoveCondition?: (id: string) => void;
}

export default function StepConditionsSection({
  conditions = [],
  stepId,
  isEditing = false,
  onConditionsChange,
  onAddCondition,
  onRemoveCondition
}: StepConditionsSectionProps) {
  const conditionTypeColors: Record<string, string> = {
    'equals': 'bg-green-100 text-green-800',
    'not_equals': 'bg-red-100 text-red-800',
    'contains': 'bg-blue-100 text-blue-800',
    'starts_with': 'bg-purple-100 text-purple-800',
    'ends_with': 'bg-pink-100 text-pink-800',
    'greater_than': 'bg-orange-100 text-orange-800',
    'less_than': 'bg-yellow-100 text-yellow-800',
    'exists': 'bg-indigo-100 text-indigo-800',
    'not_exists': 'bg-gray-100 text-gray-800',
    'default': 'bg-gray-100 text-gray-800'
  };

  const getConditionTypeColor = (type: string) => {
    return conditionTypeColors[type] || conditionTypeColors.default;
  };

  const getConditionTypeOptions = () => {
    const uniqueTypes = new Set<string>();
    conditions.forEach(cond => uniqueTypes.add(cond.condition_type));
    
    // Add common condition types
    const commonTypes = [
      'task_status', 'endpoint_status', 'task_type', 'auth_required', 'test_result',
      'equals', 'not_equals', 'contains', 'greater_than', 'less_than',
      'exists', 'not_exists', 'starts_with', 'ends_with'
    ];
    
    commonTypes.forEach(type => uniqueTypes.add(type));
    return Array.from(uniqueTypes).sort();
  };

  const handleConditionChange = (index: number, field: keyof Condition, value: string | number) => {
    if (!onConditionsChange) return;
    
    const updatedConditions = [...conditions];
    updatedConditions[index] = {
      ...updatedConditions[index],
      [field]: value
    };
    onConditionsChange(updatedConditions);
  };

  const handleAddCondition = () => {
    if (onAddCondition) {
      onAddCondition();
    } else if (onConditionsChange) {
      const newCondition: Condition = {
        id: `temp_${Date.now()}`, // Temporary ID
        flow_step_id: stepId || '',
        condition_type: 'equals',
        condition_value: '',
        condition_operator: 'AND',
        next_step: null
      };
      onConditionsChange([...conditions, newCondition]);
    }
  };

  const handleRemoveCondition = (id: string) => {
    if (onRemoveCondition) {
      onRemoveCondition(id);
    } else if (onConditionsChange) {
      onConditionsChange(conditions.filter(cond => cond.id !== id));
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">Conditions</h2>
        <div className="flex items-center space-x-2">
          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
            {conditions.length} condition{conditions.length !== 1 ? 's' : ''}
          </span>
          {isEditing && (
            <button
              onClick={handleAddCondition}
              className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
            >
              + Add Condition
            </button>
          )}
        </div>
      </div>

      {conditions.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-400 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-500 mb-4">No conditions defined for this step</p>
          <p className="text-sm text-gray-400">Conditions determine the flow path based on step results</p>
        </div>
      ) : (
        <div className="space-y-4">
          {conditions.map((condition, index) => (
            <div key={condition.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm font-medium">
                    #{index + 1}
                  </span>
                  {condition.condition_order && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                      Order: {condition.condition_order}
                    </span>
                  )}
                </div>
                {isEditing && (
                  <button
                    onClick={() => handleRemoveCondition(condition.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                    aria-label="Remove condition"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Condition Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Condition Type
                  </label>
                  {isEditing ? (
                    <select
                      value={condition.condition_type}
                      onChange={(e) => handleConditionChange(index, 'condition_type', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {getConditionTypeOptions().map(type => (
                        <option key={type} value={type}>{type.replace('_', ' ')}</option>
                      ))}
                    </select>
                  ) : (
                    <div className={`px-3 py-2 rounded-md text-sm font-medium ${getConditionTypeColor(condition.condition_type)}`}>
                      {condition.condition_type.replace('_', ' ')}
                    </div>
                  )}
                </div>

                {/* Condition Value */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Condition Value
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={condition.condition_value}
                      onChange={(e) => handleConditionChange(index, 'condition_value', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter value..."
                    />
                  ) : (
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm font-mono">
                      {condition.condition_value || 'Not specified'}
                    </div>
                  )}
                </div>

                {/* Condition Operator */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Operator
                  </label>
                  {isEditing ? (
                    <select
                      value={condition.condition_operator || 'AND'}
                      onChange={(e) => handleConditionChange(index, 'condition_operator', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="AND">AND</option>
                      <option value="OR">OR</option>
                      <option value="NOT">NOT</option>
                    </select>
                  ) : (
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm">
                      {condition.condition_operator || 'AND'}
                    </div>
                  )}
                </div>

                {/* Next Step */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Next Step
                  </label>
                  {isEditing ? (
                    <input
                      type="number"
                      value={condition.next_step || ''}
                      onChange={(e) => handleConditionChange(index, 'next_step', parseInt(e.target.value) || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Step order number..."
                    />
                  ) : (
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm">
                      {condition.next_step !== null && condition.next_step !== undefined ? `Go to step: ${condition.next_step}` : 'Continue to default'}
                    </div>
                  )}
                </div>

                {/* Step ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Step ID
                  </label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm font-mono">
                    {condition.flow_step_id}
                  </div>
                </div>
              </div>

              {/* Condition Description */}
              <div className="mt-3 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>
                    If <span className="font-medium">{condition.condition_type.replace('_', ' ')}</span>{' '}
                    <span className="font-mono">{condition.condition_value}</span>
                    {condition.condition_operator && condition.condition_operator !== 'AND' && (
                      <> (<span className="font-medium">{condition.condition_operator}</span>)</>
                    )}
                    {condition.next_step !== null && condition.next_step !== undefined ? (
                      <>, go to step <span className="font-medium">{condition.next_step}</span></>
                    ) : (
                      <>, continue to default next step</>
                    )}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}


    </div>
  );
}