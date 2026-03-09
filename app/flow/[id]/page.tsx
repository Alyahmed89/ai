'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

export const runtime = 'edge';

export default function FlowPage() {
  const params = useParams();
  const flowId = params.id as string;
  
  const [flow, setFlow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [editData, setEditData] = useState<any>(null);

  useEffect(() => {
    // Fetch real flow data from Cloudflare D1 database
    const fetchFlow = async () => {
      try {
        setLoading(true);
        
        // Make API call to Cloudflare Worker backend for flow data
        console.log('Fetching flow:', flowId);
        const flowResponse = await apiClient.getFlowDefinition(flowId);
        
        console.log('Flow response status:', flowResponse.status);
        if (!flowResponse.ok) {
          const errorText = await flowResponse.text();
          throw new Error(`API error: ${flowResponse.status} - ${errorText}`);
        }
        
        const flowData = await flowResponse.json();
        console.log('Flow response data:', flowData);
        
        if (flowData.error) {
          setError(flowData.error);
        } else {
          setFlow(flowData);
          setEditData(flowData);
        }
      } catch (err) {
        console.error('Error fetching flow:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(`Failed to load flow data: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    };

    if (flowId) {
      fetchFlow();
    }
  }, [flowId]);

  const handleEdit = () => {
    setEditing(true);
    setEditError('');
    setEditSuccess('');
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditData(flow);
    setEditError('');
    setEditSuccess('');
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    setEditError('');
    setEditSuccess('');

    try {
      const response = await apiClient.updateFlowDefinition(flowId, editData);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        setEditError(data.error);
      } else {
        setEditSuccess('Flow updated successfully!');
        setFlow(editData);
        setEditing(false);
      }
    } catch (err) {
      console.error('Error updating flow:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setEditError(`Failed to update flow: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditData((prev: any) => ({
      ...prev,
      [name]: name === 'priority' || name === 'max_iterations' ? parseInt(value) || 0 : value
    }));
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError('');

    try {
      const response = await apiClient.deleteFlowDefinition(flowId);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }
      
      // Redirect to flows page after successful deletion
      window.location.href = '/flows';
    } catch (err) {
      console.error('Error deleting flow:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setDeleteError(`Failed to delete flow: ${errorMessage}`);
      setDeleting(false);
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
            Loading flow details...
          </p>
        </div>
      </div>
    );
  }

  if (error || !flow) {
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
            {error || 'Flow not found'}
          </h2>
          <p style={{
            color: '#6b7280',
            marginBottom: '1.5rem'
          }}>
            The flow you're looking for doesn't exist or couldn't be loaded.
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
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        {/* Title Component */}
        <div style={{
          marginBottom: '2rem'
        }}>
          <a
            href="/flows"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              color: '#6b7280',
              textDecoration: 'none',
              marginBottom: '1rem',
              transition: 'color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.color = '#374151'}
            onMouseOut={(e) => e.currentTarget.style.color = '#6b7280'}
          >
            <span style={{ marginRight: '0.5rem' }}>←</span>
            Back to all flows
          </a>
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              {editing ? (
                <div style={{ marginBottom: '1rem' }}>
                  <input
                    type="text"
                    name="name"
                    value={editData?.name || ''}
                    onChange={handleInputChange}
                    style={{
                      fontSize: '2.25rem',
                      fontWeight: 'bold',
                      color: '#111827',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      padding: '0.5rem',
                      width: '100%',
                      maxWidth: '500px'
                    }}
                  />
                </div>
              ) : (
                <h1 style={{
                  fontSize: '2.25rem',
                  fontWeight: 'bold',
                  color: '#111827',
                  marginBottom: '0.5rem'
                }}>
                  {flow.name}
                </h1>
              )}
              <div style={{
                display: 'flex',
                gap: '1rem',
                alignItems: 'center',
                flexWrap: 'wrap'
              }}>
                <span style={{
                  padding: '0.25rem 0.75rem',
                  backgroundColor: '#dbeafe',
                  color: '#1e40af',
                  borderRadius: '9999px',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}>
                  Flow
                </span>
                {editing ? (
                  <input
                    type="number"
                    name="priority"
                    value={editData?.priority || 0}
                    onChange={handleInputChange}
                    min="0"
                    max="10"
                    style={{
                      padding: '0.25rem 0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      width: '80px'
                    }}
                  />
                ) : (
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    backgroundColor: flow.priority === 1 ? '#fee2e2' : 
                                    flow.priority === 2 ? '#fef3c7' : '#d1fae5',
                    color: flow.priority === 1 ? '#991b1b' : 
                          flow.priority === 2 ? '#92400e' : '#065f46',
                    borderRadius: '9999px',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}>
                    Priority: {flow.priority || 0}
                  </span>
                )}
                {editing ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.125rem', color: '#6b7280' }}>Max Iterations:</span>
                    <input
                      type="number"
                      name="max_iterations"
                      value={editData?.max_iterations || 20}
                      onChange={handleInputChange}
                      min="1"
                      max="100"
                      style={{
                        padding: '0.25rem 0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        width: '80px'
                      }}
                    />
                  </div>
                ) : (
                  <span style={{
                    fontSize: '1.125rem',
                    color: '#6b7280'
                  }}>
                    Max Iterations: {flow.max_iterations || 20}
                  </span>
                )}
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {editing ? (
                <>
                  <button
                    onClick={handleCancelEdit}
                    disabled={saving}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#f3f4f6',
                      color: '#374151',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontWeight: '500',
                      fontSize: '0.875rem',
                      opacity: saving ? 0.7 : 1
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontWeight: '500',
                      fontSize: '0.875rem',
                      opacity: saving ? 0.7 : 1
                    }}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => window.location.href = `/flows/${flowId}/steps`}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#8b5cf6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontWeight: '500',
                      fontSize: '0.875rem',
                      marginRight: '0.5rem'
                    }}
                  >
                    View Steps
                  </button>
                  <button
                    onClick={() => window.location.href = `/flows/${flowId}/tasks`}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontWeight: '500',
                      fontSize: '0.875rem',
                      marginRight: '0.5rem'
                    }}
                  >
                    View Tasks
                  </button>
                  <button
                    onClick={handleEdit}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontWeight: '500',
                      fontSize: '0.875rem'
                    }}
                  >
                    Edit
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Flow Details Section */}
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
            Flow Details
          </h2>
          
          {editError && (
            <div style={{
              backgroundColor: '#fee2e2',
              border: '1px solid #fca5a5',
              color: '#dc2626',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              marginBottom: '1rem',
              fontSize: '0.875rem'
            }}>
              {editError}
            </div>
          )}
          
          {editSuccess && (
            <div style={{
              backgroundColor: '#d1fae5',
              border: '1px solid #a7f3d0',
              color: '#065f46',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              marginBottom: '1rem',
              fontSize: '0.875rem'
            }}>
              {editSuccess}
            </div>
          )}
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            <div>
              <h3 style={{
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#6b7280',
                marginBottom: '0.5rem'
              }}>
                Repository
              </h3>
              {editing ? (
                <input
                  type="text"
                  name="repository"
                  value={editData?.repository || ''}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '1rem'
                  }}
                  placeholder="owner/repo"
                />
              ) : (
                <div style={{
                  padding: '0.75rem',
                  backgroundColor: '#f9fafb',
                  borderRadius: '0.5rem',
                  border: '1px solid #e5e7eb',
                  fontSize: '1rem',
                  color: '#111827'
                }}>
                  {flow.repository || 'Not specified'}
                </div>
              )}
            </div>
            
            <div>
              <h3 style={{
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#6b7280',
                marginBottom: '0.5rem'
              }}>
                Branch
              </h3>
              {editing ? (
                <input
                  type="text"
                  name="branch"
                  value={editData?.branch || ''}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '1rem'
                  }}
                  placeholder="main"
                />
              ) : (
                <div style={{
                  padding: '0.75rem',
                  backgroundColor: '#f9fafb',
                  borderRadius: '0.5rem',
                  border: '1px solid #e5e7eb',
                  fontSize: '1rem',
                  color: '#111827'
                }}>
                  {flow.branch || 'main'}
                </div>
              )}
            </div>
            
            <div>
              <h3 style={{
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#6b7280',
                marginBottom: '0.5rem'
              }}>
                Next Flow ID
              </h3>
              {editing ? (
                <input
                  type="text"
                  name="next_flow_id"
                  value={editData?.next_flow_id || ''}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '1rem'
                  }}
                  placeholder="Optional next flow ID"
                />
              ) : (
                <div style={{
                  padding: '0.75rem',
                  backgroundColor: '#f9fafb',
                  borderRadius: '0.5rem',
                  border: '1px solid #e5e7eb',
                  fontSize: '1rem',
                  color: '#111827'
                }}>
                  {flow.next_flow_id || 'None'}
                </div>
              )}
            </div>
          </div>

          {/* Description Text Box Component */}
          <div style={{
            marginBottom: '2rem'
          }}>
            <h3 style={{
              fontSize: '1.125rem',
              fontWeight: '600',
              color: '#111827',
              marginBottom: '1rem'
            }}>
              Description
            </h3>
            {editing ? (
              <textarea
                name="description"
                value={editData?.description || ''}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  minHeight: '200px',
                  padding: '1rem',
                  fontSize: '1rem',
                  color: '#4b5563',
                  lineHeight: '1.5',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  backgroundColor: '#f9fafb',
                  fontFamily: 'monospace',
                  resize: 'vertical'
                }}
                placeholder="Flow description"
              />
            ) : (
              <textarea
                style={{
                  width: '100%',
                  minHeight: '200px',
                  padding: '1rem',
                  fontSize: '1rem',
                  color: '#4b5563',
                  lineHeight: '1.5',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  backgroundColor: '#f9fafb',
                  fontFamily: 'monospace',
                  resize: 'vertical'
                }}
                value={flow.description || 'No description provided'}
                readOnly
              />
            )}
          </div>

          {/* First Prompt */}
          {editing && (
            <div style={{
              marginBottom: '2rem'
            }}>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: '600',
                color: '#111827',
                marginBottom: '1rem'
              }}>
                First Prompt
              </h3>
              <textarea
                name="first_prompt"
                value={editData?.first_prompt || ''}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  minHeight: '150px',
                  padding: '1rem',
                  fontSize: '1rem',
                  color: '#4b5563',
                  lineHeight: '1.5',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  backgroundColor: '#f9fafb',
                  fontFamily: 'monospace',
                  resize: 'vertical'
                }}
                placeholder="Initial prompt for the flow"
              />
            </div>
          )}

          {/* DeepSeek System Instructions */}
          {editing && (
            <div style={{
              marginBottom: '2rem'
            }}>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: '600',
                color: '#111827',
                marginBottom: '1rem'
              }}>
                DeepSeek System Instructions
              </h3>
              <textarea
                name="deepseek_system"
                value={editData?.deepseek_system || ''}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  minHeight: '150px',
                  padding: '1rem',
                  fontSize: '1rem',
                  color: '#4b5563',
                  lineHeight: '1.5',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  backgroundColor: '#f9fafb',
                  fontFamily: 'monospace',
                  resize: 'vertical'
                }}
                placeholder="System instructions for DeepSeek"
              />
            </div>
          )}

          {/* Metadata */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '1rem',
            borderTop: '1px solid #e5e7eb',
            fontSize: '0.875rem',
            color: '#6b7280'
          }}>
            <div>
              Flow ID: {flow.id}
            </div>
            <div>
              Created: {new Date(flow.created_at).toLocaleDateString()} • Updated: {new Date(flow.updated_at).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: '500',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
          >
            Delete Flow
          </button>
          <a
            href={`/api/flow-definitions/${flowId}/steps`}
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
            View Steps
          </a>
          {flow.next_flow_id && (
            <a
              href={`/flow/${flow.next_flow_id}`}
              style={{
                display: 'inline-block',
                padding: '0.75rem 1.5rem',
                backgroundColor: '#10b981',
                color: 'white',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                fontWeight: '500',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#059669'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
            >
              Go to Next Flow
            </a>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
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
            width: '100%'
          }}>
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: '600',
                color: '#111827',
                marginBottom: '0.5rem'
              }}>
                Delete Flow
              </h2>
              <p style={{
                color: '#6b7280',
                fontSize: '0.875rem'
              }}>
                Are you sure you want to delete "{flow.name}"? This action cannot be undone.
              </p>
              
              {deleteError && (
                <div style={{
                  backgroundColor: '#fee2e2',
                  border: '1px solid #fca5a5',
                  color: '#dc2626',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  marginTop: '1rem',
                  fontSize: '0.875rem'
                }}>
                  {deleteError}
                </div>
              )}
            </div>
            
            <div style={{
              padding: '1.5rem',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem'
            }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontWeight: '500',
                  fontSize: '0.875rem',
                  opacity: deleting ? 0.7 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontWeight: '500',
                  fontSize: '0.875rem',
                  opacity: deleting ? 0.7 : 1
                }}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}





export const runtime = 'edge';
