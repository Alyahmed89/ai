'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

export default function StepsPage() {
  const [steps, setSteps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    step_type: 'input',
    order_index: 0,
    step_key: '',
    flow_id: '',
    description: ''
  });

  useEffect(() => {
    const fetchSteps = async () => {
      try {
        setLoading(true);
        const response = await apiClient.getFlowStepsList(50);
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
          setError(data.error);
        } else {
          setSteps(data);
        }
      } catch (err) {
        console.error('Error fetching steps:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(`Failed to load steps: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    };

    fetchSteps();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'order_index' ? parseInt(value) || 0 : value
    }));
  };

  const handleCreateStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');

    try {
      const response = await apiClient.createFlowStep(formData);
      
      if (!response.ok) {
        throw new Error(`Failed to create step: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }

      // Refresh the steps list
      const refreshResponse = await apiClient.getFlowStepsList(50);
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        if (!refreshData.error) {
          setSteps(refreshData);
        }
      }

      // Reset form and close modal
      setFormData({
        title: '',
        step_type: 'input',
        order_index: 0,
        step_key: '',
        flow_id: '',
        description: ''
      });
      setShowCreateModal(false);
      
    } catch (err) {
      console.error('Error creating step:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setCreateError(`Failed to create step: ${errorMessage}`);
    } finally {
      setCreating(false);
    }
  };

  const refreshSteps = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getFlowStepsList(50);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setSteps(data);
      }
    } catch (err) {
      console.error('Error refreshing steps:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to refresh steps: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9fafb'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '2rem'
        }}>
          <div style={{
            width: '3rem',
            height: '3rem',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }}></div>
          <p style={{
            fontSize: '1.125rem',
            color: '#6b7280'
          }}>
            Loading steps...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9fafb'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          maxWidth: '500px',
          width: '100%'
        }}>
          <div style={{
            width: '3rem',
            height: '3rem',
            backgroundColor: '#fee2e2',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem'
          }}>
            <span style={{
              fontSize: '1.5rem',
              color: '#dc2626'
            }}>
              !
            </span>
          </div>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            color: '#111827',
            marginBottom: '0.5rem'
          }}>
            Error Loading Steps
          </h2>
          <p style={{
            color: '#6b7280',
            marginBottom: '1.5rem'
          }}>
            {error}
          </p>
          <a
            href="/"
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              fontWeight: '500',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
          >
            Go back home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f9fafb',
      padding: '2rem'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          marginBottom: '2rem'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '1rem'
          }}>
            <a
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                color: '#6b7280',
                textDecoration: 'none',
                transition: 'color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.color = '#374151'}
              onMouseOut={(e) => e.currentTarget.style.color = '#6b7280'}
            >
              <span style={{ marginRight: '0.5rem' }}>←</span>
              Back to home
            </a>
            
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
            >
              <span>+</span>
              Create New Step
            </button>
          </div>
          
          <h1 style={{
            fontSize: '2.25rem',
            fontWeight: 'bold',
            color: '#111827',
            marginBottom: '0.5rem'
          }}>
            All Steps
          </h1>
          <p style={{
            fontSize: '1.125rem',
            color: '#6b7280'
          }}>
            {steps.length} step{steps.length !== 1 ? 's' : ''} found
          </p>
        </div>

        {/* Steps List */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          overflow: 'hidden'
        }}>
          {steps.length === 0 ? (
            <div style={{
              padding: '3rem',
              textAlign: 'center'
            }}>
              <p style={{
                fontSize: '1.125rem',
                color: '#6b7280'
              }}>
                No steps found in the database.
              </p>
            </div>
          ) : (
            <div style={{
              overflowX: 'auto'
            }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse'
              }}>
                <thead>
                  <tr style={{
                    backgroundColor: '#f9fafb',
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    <th style={{
                      padding: '1rem',
                      textAlign: 'left',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      whiteSpace: 'nowrap'
                    }}>
                      Title
                    </th>
                    <th style={{
                      padding: '1rem',
                      textAlign: 'left',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      whiteSpace: 'nowrap'
                    }}>
                      Step Type
                    </th>
                    <th style={{
                      padding: '1rem',
                      textAlign: 'left',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      whiteSpace: 'nowrap'
                    }}>
                      Order
                    </th>
                    <th style={{
                      padding: '1rem',
                      textAlign: 'left',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      whiteSpace: 'nowrap'
                    }}>
                      ID
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {steps.map((step) => (
                    <tr 
                      key={step.id}
                      style={{
                        borderBottom: '1px solid #e5e7eb',
                        transition: 'background-color 0.2s',
                        cursor: 'pointer'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      onClick={() => window.location.href = `/step/${step.id}`}
                    >
                      <td style={{
                        padding: '1rem',
                        fontSize: '0.875rem',
                        color: '#111827'
                      }}>
                        <div style={{
                          fontWeight: '500',
                          marginBottom: '0.25rem'
                        }}>
                          {step.title || `Step: ${step.id.substring(0, 8)}...`}
                        </div>
                      </td>
                      <td style={{
                        padding: '1rem',
                        fontSize: '0.875rem'
                      }}>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          backgroundColor: step.step_type === 'input' ? '#dbeafe' : 
                                          step.step_type === 'output' ? '#d1fae5' : '#f3f4f6',
                          color: step.step_type === 'input' ? '#1e40af' : 
                                step.step_type === 'output' ? '#065f46' : '#374151',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          display: 'inline-block'
                        }}>
                          {step.step_type || 'unknown'}
                        </span>
                      </td>
                      <td style={{
                        padding: '1rem',
                        fontSize: '0.875rem',
                        color: '#6b7280'
                      }}>
                        {step.order_index || 0}
                      </td>
                      <td style={{
                        padding: '1rem',
                        fontSize: '0.875rem',
                        color: '#6b7280',
                        whiteSpace: 'nowrap'
                      }}>
                        {step.id.substring(0, 8)}...
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create Step Modal */}
        {showCreateModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '1rem'
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '0.75rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}>
              <div style={{
                padding: '1.5rem',
                borderBottom: '1px solid #e5e7eb'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem'
                }}>
                  <h2 style={{
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    color: '#111827'
                  }}>
                    Create New Step
                  </h2>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '1.5rem',
                      color: '#6b7280',
                      cursor: 'pointer',
                      padding: '0.25rem',
                      borderRadius: '0.25rem',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    ×
                  </button>
                </div>
                
                {createError && (
                  <div style={{
                    padding: '0.75rem',
                    backgroundColor: '#fee2e2',
                    border: '1px solid #fecaca',
                    borderRadius: '0.375rem',
                    marginBottom: '1rem'
                  }}>
                    <p style={{
                      color: '#dc2626',
                      fontSize: '0.875rem',
                      margin: 0
                    }}>
                      {createError}
                    </p>
                  </div>
                )}
                
                <form onSubmit={handleCreateStep}>
                  <div style={{
                    marginBottom: '1rem'
                  }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.25rem'
                    }}>
                      Title *
                    </label>
                    <input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                      required
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                    />
                  </div>
                  
                  <div style={{
                    marginBottom: '1rem'
                  }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.25rem'
                    }}>
                      Step Type *
                    </label>
                    <select
                      name="step_type"
                      value={formData.step_type}
                      onChange={handleInputChange}
                      required
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        backgroundColor: 'white',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                    >
                      <option value="input">Input</option>
                      <option value="output">Output</option>
                      <option value="analysis">Analysis</option>
                      <option value="optimization">Optimization</option>
                      <option value="design">Design</option>
                      <option value="planning">Planning</option>
                      <option value="processing">Processing</option>
                      <option value="validation">Validation</option>
                    </select>
                  </div>
                  
                  <div style={{
                    marginBottom: '1rem'
                  }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.25rem'
                    }}>
                      Order Index
                    </label>
                    <input
                      type="number"
                      name="order_index"
                      value={formData.order_index}
                      onChange={handleInputChange}
                      min="0"
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                    />
                  </div>
                  
                  <div style={{
                    marginBottom: '1rem'
                  }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.25rem'
                    }}>
                      Step Key (Optional)
                    </label>
                    <input
                      type="text"
                      name="step_key"
                      value={formData.step_key}
                      onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                    />
                  </div>
                  
                  <div style={{
                    marginBottom: '1rem'
                  }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.25rem'
                    }}>
                      Flow ID (Optional)
                    </label>
                    <input
                      type="text"
                      name="flow_id"
                      value={formData.flow_id}
                      onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                    />
                  </div>
                  
                  <div style={{
                    marginBottom: '1.5rem'
                  }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.25rem'
                    }}>
                      Description (Optional)
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        transition: 'border-color 0.2s',
                        resize: 'vertical'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                    />
                  </div>
                  
                  <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.75rem'
                  }}>
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      disabled={creating}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: 'white',
                        color: '#374151',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creating}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: creating ? '#93c5fd' : '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        cursor: creating ? 'not-allowed' : 'pointer',
                        transition: 'background-color 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                      onMouseOver={(e) => {
                        if (!creating) {
                          e.currentTarget.style.backgroundColor = '#2563eb';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!creating) {
                          e.currentTarget.style.backgroundColor = '#3b82f6';
                        }
                      }}
                    >
                      {creating ? (
                        <>
                          <div style={{
                            width: '1rem',
                            height: '1rem',
                            border: '2px solid rgba(255, 255, 255, 0.3)',
                            borderTop: '2px solid white',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                          }}></div>
                          Creating...
                        </>
                      ) : (
                        'Create Step'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: '2rem',
          paddingTop: '1rem',
          borderTop: '1px solid #e5e7eb',
          color: '#6b7280',
          fontSize: '0.875rem',
          textAlign: 'center'
        }}>
          <p>
            Showing {steps.length} step{steps.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </div>
  );
}

