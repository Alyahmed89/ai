'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface Condition {
  id: string;
  flow_step_id: string;
  condition_type: string;
  condition_value: string;
  condition_operator: string;
  next_step: number;
  next_step_title: string;
  next_step_id: string | null;
  created_at: number;
  updated_at: number;
}

interface EditableConditionListProps {
  stepId: string;
  currentStepOrder: number;
  flowId?: string;
}

export default function EditableConditionList({ stepId, currentStepOrder, flowId }: EditableConditionListProps) {
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, { type: string; operator: string; value: string; nextStep: number }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Available operators for conditions
  const availableOperators = [
    { value: 'equals', label: 'Equals (=)' },
    { value: 'not_equals', label: 'Not Equals (!=)' },
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Not Contains' },
    { value: 'greater_than', label: 'Greater Than (>)' },
    { value: 'less_than', label: 'Less Than (<)' },
    { value: 'greater_than_equal', label: 'Greater Than or Equal (>=)' },
    { value: 'less_than_equal', label: 'Less Than or Equal (<=)' },
    { value: 'starts_with', label: 'Starts With' },
    { value: 'ends_with', label: 'Ends With' },
    { value: 'is_empty', label: 'Is Empty' },
    { value: 'is_not_empty', label: 'Is Not Empty' }
  ];

  useEffect(() => {
    const fetchConditions = async () => {
      try {
        setLoading(true);
        setError('');
        
        const response = await apiClient.getStepConditions(stepId);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch conditions: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (Array.isArray(data)) {
          setConditions(data);
          
          // Initialize edit values
          const initialEditValues: Record<string, { type: string; operator: string; value: string; nextStep: number }> = {};
          data.forEach(condition => {
            initialEditValues[condition.id] = {
              type: condition.condition_type,
              operator: condition.condition_operator,
              value: condition.condition_value,
              nextStep: condition.next_step
            };
          });
          setEditValues(initialEditValues);
        } else {
          setConditions([]);
        }
      } catch (err) {
        console.error('Error fetching conditions:', err);
        setError(err instanceof Error ? err.message : 'Failed to load conditions');
      } finally {
        setLoading(false);
      }
    };

    if (stepId) {
      fetchConditions();
    }
  }, [stepId]);

  const handleEdit = (conditionId: string) => {
    setEditingId(conditionId);
    setSaveError(null);
    setSaveSuccess(null);
  };

  const handleCancel = () => {
    setEditingId(null);
    setSaveError(null);
    setSaveSuccess(null);
  };

  const handleSave = async (conditionId: string) => {
    const condition = conditions.find(c => c.id === conditionId);
    if (!condition) return;

    const editValue = editValues[conditionId];
    if (!editValue) return;

    try {
      setSaving(conditionId);
      setSaveError(null);
      setSaveSuccess(null);

      // Update condition via API
      const response = await apiClient.updateFlowStep(conditionId, {
        condition_type: editValue.type,
        condition_operator: editValue.operator,
        condition_value: editValue.value,
        next_step: editValue.nextStep
      });

      if (!response.ok) {
        throw new Error(`Failed to update condition: ${response.status}`);
      }

      // Update local state
      setConditions(prev => prev.map(c => 
        c.id === conditionId 
          ? { 
              ...c, 
              condition_type: editValue.type,
              condition_operator: editValue.operator,
              condition_value: editValue.value,
              next_step: editValue.nextStep
            }
          : c
      ));

      setSaveSuccess('Condition updated successfully!');
      setTimeout(() => {
        setEditingId(null);
        setSaveSuccess(null);
      }, 2000);
    } catch (err) {
      console.error('Error saving condition:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save condition');
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (conditionId: string) => {
    if (!confirm('Are you sure you want to delete this condition?')) {
      return;
    }

    try {
      setSaving(conditionId);
      setSaveError(null);

      const response = await apiClient.deleteFlowStep(conditionId);
      
      if (!response.ok) {
        throw new Error(`Failed to delete condition: ${response.status}`);
      }

      // Remove from local state
      setConditions(prev => prev.filter(c => c.id !== conditionId));
      
      // Remove from edit values
      setEditValues(prev => {
        const newValues = { ...prev };
        delete newValues[conditionId];
        return newValues;
      });

      setSaveSuccess('Condition deleted successfully!');
      setTimeout(() => setSaveSuccess(null), 2000);
    } catch (err) {
      console.error('Error deleting condition:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to delete condition');
    } finally {
      setSaving(null);
    }
  };

  const handleNavigate = (condition: Condition) => {
    if (condition.next_step_id) {
      window.location.href = `/step/${condition.next_step_id}`;
    } else if (condition.next_step === -1) {
      window.location.href = '/';
    } else {
      alert(`Cannot navigate: Step ${condition.next_step} not found in this flow`);
    }
  };

  const handleEditValueChange = (conditionId: string, field: string, value: string | number) => {
    setEditValues(prev => ({
      ...prev,
      [conditionId]: {
        ...prev[conditionId],
        [field]: value
      }
    }));
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  if (loading) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '0.75rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        padding: '2rem',
        marginBottom: '2rem'
      }}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: '600',
          color: '#111827',
          marginBottom: '1rem'
        }}>
          Step Conditions
        </h2>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem'
        }}>
          <div style={{
            width: '2rem',
            height: '2rem',
            border: '3px solid #e5e7eb',
            borderTop: '3px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginRight: '1rem'
          }}></div>
          <span style={{ color: '#6b7280' }}>Loading conditions...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '0.75rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        padding: '2rem',
        marginBottom: '2rem'
      }}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: '600',
          color: '#111827',
          marginBottom: '1rem'
        }}>
          Step Conditions
        </h2>
        <div style={{
          backgroundColor: '#fee2e2',
          border: '1px solid #fca5a5',
          color: '#dc2626',
          padding: '1rem',
          borderRadius: '0.5rem'
        }}>
          Error: {error}
        </div>
      </div>
    );
  }

  if (conditions.length === 0) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '0.75rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        padding: '2rem',
        marginBottom: '2rem'
      }}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: '600',
          color: '#111827',
          marginBottom: '1rem'
        }}>
          Step Conditions
        </h2>
        <div style={{
          backgroundColor: '#f3f4f6',
          border: '1px solid #d1d5db',
          color: '#6b7280',
          padding: '1rem',
          borderRadius: '0.5rem',
          textAlign: 'center'
        }}>
          No conditions defined for this step
        </div>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '0.75rem',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      padding: '2rem',
      marginBottom: '2rem'
    }}>
      <h2 style={{
        fontSize: '1.5rem',
        fontWeight: '600',
        color: '#111827',
        marginBottom: '1.5rem'
      }}>
        Step Conditions
      </h2>

      {saveSuccess && (
        <div style={{
          backgroundColor: '#d1fae5',
          border: '1px solid #a7f3d0',
          color: '#065f46',
          padding: '1rem',
          borderRadius: '0.5rem',
          marginBottom: '1.5rem'
        }}>
          {saveSuccess}
        </div>
      )}

      {saveError && (
        <div style={{
          backgroundColor: '#fee2e2',
          border: '1px solid #fca5a5',
          color: '#dc2626',
          padding: '1rem',
          borderRadius: '0.5rem',
          marginBottom: '1.5rem'
        }}>
          Error: {saveError}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {conditions.map((condition) => {
          const isEditing = editingId === condition.id;
          const editValue = editValues[condition.id] || {
            type: condition.condition_type,
            operator: condition.condition_operator,
            value: condition.condition_value,
            nextStep: condition.next_step
          };

          return (
            <div key={condition.id} style={{
              border: '1px solid #e5e7eb',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              backgroundColor: isEditing ? '#f9fafb' : 'white',
              transition: 'all 0.2s'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '1rem'
              }}>
                <div>
                  <div style={{
                    fontSize: '0.875rem',
                    color: '#6b7280',
                    marginBottom: '0.25rem'
                  }}>
                    Condition ID: {condition.id.substring(0, 8)}...
                  </div>
                  <div style={{
                    fontSize: '1.125rem',
                    fontWeight: '600',
                    color: '#111827'
                  }}>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editValue.type}
                        onChange={(e) => handleEditValueChange(condition.id, 'type', e.target.value)}
                        style={{
                          padding: '0.5rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.375rem',
                          fontSize: '1rem',
                          width: '100%'
                        }}
                        placeholder="Condition type (e.g., task_status)"
                      />
                    ) : (
                      condition.condition_type
                    )}
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {!isEditing ? (
                    <>
                      <button
                        onClick={() => handleEdit(condition.id)}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                          fontSize: '0.875rem'
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(condition.id)}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                          fontSize: '0.875rem'
                        }}
                        disabled={saving === condition.id}
                      >
                        {saving === condition.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleSave(condition.id)}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                          fontSize: '0.875rem'
                        }}
                        disabled={saving === condition.id}
                      >
                        {saving === condition.id ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={handleCancel}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#6b7280',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                          fontSize: '0.875rem'
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                marginBottom: '1rem'
              }}>
                <div>
                  <div style={{
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Operator
                  </div>
                  {isEditing ? (
                    <select
                      value={editValue.operator}
                      onChange={(e) => handleEditValueChange(condition.id, 'operator', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem'
                      }}
                    >
                      {availableOperators.map(op => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div style={{
                      padding: '0.5rem',
                      backgroundColor: '#f3f4f6',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem'
                    }}>
                      {availableOperators.find(op => op.value === condition.condition_operator)?.label || condition.condition_operator}
                    </div>
                  )}
                </div>

                <div>
                  <div style={{
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Value
                  </div>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editValue.value}
                      onChange={(e) => handleEditValueChange(condition.id, 'value', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem'
                      }}
                      placeholder="Condition value"
                    />
                  ) : (
                    <div style={{
                      padding: '0.5rem',
                      backgroundColor: '#f3f4f6',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem'
                    }}>
                      {condition.condition_value}
                    </div>
                  )}
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                marginBottom: '1.5rem'
              }}>
                <div>
                  <div style={{
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Next Step
                  </div>
                  {isEditing ? (
                    <input
                      type="number"
                      value={editValue.nextStep}
                      onChange={(e) => handleEditValueChange(condition.id, 'nextStep', parseInt(e.target.value) || 0)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem'
                      }}
                      placeholder="Next step number"
                    />
                  ) : (
                    <div style={{
                      padding: '0.5rem',
                      backgroundColor: '#f3f4f6',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem'
                    }}>
                      {condition.next_step === -1 ? 'End Flow' : `Step ${condition.next_step}`}
                      {condition.next_step_title && ` (${condition.next_step_title})`}
                    </div>
                  )}
                </div>

                <div>
                  <div style={{
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Navigation
                  </div>
                  <button
                    onClick={() => handleNavigate(condition)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      backgroundColor: condition.next_step_id || condition.next_step === -1 ? '#3b82f6' : '#9ca3af',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      cursor: condition.next_step_id || condition.next_step === -1 ? 'pointer' : 'not-allowed',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => {
                      if (condition.next_step_id || condition.next_step === -1) {
                        e.currentTarget.style.backgroundColor = '#2563eb';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (condition.next_step_id || condition.next_step === -1) {
                        e.currentTarget.style.backgroundColor = '#3b82f6';
                      }
                    }}
                    disabled={!condition.next_step_id && condition.next_step !== -1}
                  >
                    {condition.next_step === -1 ? 'End Flow' : `Go to Step ${condition.next_step}`}
                  </button>
                </div>
              </div>

              <div style={{
                fontSize: '0.75rem',
                color: '#6b7280',
                display: 'flex',
                justifyContent: 'space-between',
                borderTop: '1px solid #e5e7eb',
                paddingTop: '0.75rem'
              }}>
                <span>Created: {formatDate(condition.created_at)}</span>
                <span>Updated: {formatDate(condition.updated_at)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}