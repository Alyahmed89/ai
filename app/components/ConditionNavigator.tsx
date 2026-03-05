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

interface ConditionNavigatorProps {
  stepId: string;
  currentStepOrder: number;
}

export default function ConditionNavigator({ stepId, currentStepOrder }: ConditionNavigatorProps) {
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCondition, setSelectedCondition] = useState<Condition | null>(null);
  const [selectedValue, setSelectedValue] = useState('');

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
          
          // Set default selected condition if conditions exist
          if (data.length > 0) {
            setSelectedCondition(data[0]);
            setSelectedValue(data[0].condition_value);
          }
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

  const handleConditionChange = (conditionId: string) => {
    const condition = conditions.find(c => c.id === conditionId);
    if (condition) {
      setSelectedCondition(condition);
      setSelectedValue(condition.condition_value);
    }
  };

  const handleNavigate = () => {
    if (selectedCondition && selectedCondition.next_step_id) {
      // Navigate to the actual step ID (found by order_index within same flow)
      window.location.href = `/step/${selectedCondition.next_step_id}`;
    } else if (selectedCondition && selectedCondition.next_step === -1) {
      // End flow - go back to home
      window.location.href = '/';
    } else if (selectedCondition) {
      // No next_step_id found (step not found in flow)
      alert(`Cannot navigate: Step ${selectedCondition.next_step} not found in this flow`);
    }
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
          Condition Navigation
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
          Condition Navigation
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
          Condition Navigation
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
        Condition Navigation
      </h2>
      
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{
          display: 'block',
          fontSize: '0.875rem',
          fontWeight: '500',
          color: '#374151',
          marginBottom: '0.5rem'
        }}>
          Select Condition
        </label>
        <select
          value={selectedCondition?.id || ''}
          onChange={(e) => handleConditionChange(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            fontSize: '1rem',
            backgroundColor: 'white',
            cursor: 'pointer'
          }}
        >
          {conditions.map((condition) => (
            <option key={condition.id} value={condition.id}>
              {condition.condition_type} {condition.condition_operator} "{condition.condition_value}"
            </option>
          ))}
        </select>
      </div>

      {selectedCondition && (
        <>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Condition Value
            </label>
            <input
              type="text"
              value={selectedValue}
              onChange={(e) => setSelectedValue(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem'
              }}
              placeholder="Enter condition value"
            />
            <div style={{
              fontSize: '0.75rem',
              color: '#6b7280',
              marginTop: '0.25rem'
            }}>
              Current: {selectedCondition.condition_value}
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem',
            backgroundColor: '#f9fafb',
            borderRadius: '0.5rem',
            marginBottom: '1.5rem'
          }}>
            <div>
              <div style={{
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '0.25rem'
              }}>
                Next Step
              </div>
              <div style={{
                fontSize: '1rem',
                color: '#111827'
              }}>
                {selectedCondition.next_step_title || `Step ${selectedCondition.next_step}`}
              </div>
            </div>
            <div style={{
              fontSize: '0.875rem',
              color: '#6b7280'
            }}>
              Current: Step {currentStepOrder}
            </div>
          </div>

          <button
            onClick={handleNavigate}
            style={{
              width: '100%',
              padding: '0.75rem 1.5rem',
              backgroundColor: selectedCondition.next_step_id || selectedCondition.next_step === -1 ? '#3b82f6' : '#9ca3af',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: selectedCondition.next_step_id || selectedCondition.next_step === -1 ? 'pointer' : 'not-allowed',
              transition: 'background-color 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseOver={(e) => {
              if (selectedCondition.next_step_id || selectedCondition.next_step === -1) {
                e.currentTarget.style.backgroundColor = '#2563eb';
              }
            }}
            onMouseOut={(e) => {
              if (selectedCondition.next_step_id || selectedCondition.next_step === -1) {
                e.currentTarget.style.backgroundColor = '#3b82f6';
              }
            }}
            disabled={!selectedCondition.next_step_id && selectedCondition.next_step !== -1}
          >
            <span style={{ marginRight: '0.5rem' }}>→</span>
            Go to {selectedCondition.next_step === -1 ? 'End Flow' : (selectedCondition.next_step_title || `Step ${selectedCondition.next_step}`)}
          </button>
        </>
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}