'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

export default function FlowsPage() {
  const [flows, setFlows] = useState<any[]>([]);
  const [flowRuns, setFlowRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [startingFlow, setStartingFlow] = useState<string | null>(null);
  const [stoppingFlow, setStoppingFlow] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    repository: '',
    branch: 'main',
    priority: 0,
    max_iterations: 20,
    next_flow_id: ''
  });

  const fetchFlows = async () => {
    try {
      setLoading(true);
      const [flowsResponse, flowRunsResponse] = await Promise.all([
        apiClient.getFlowDefinitions(50),
        apiClient.getFlowRuns(100)
      ]);
      
      if (!flowsResponse.ok) {
        throw new Error(`API error for flows: ${flowsResponse.status}`);
      }
      
      if (!flowRunsResponse.ok) {
        console.warn(`API error for flow runs: ${flowRunsResponse.status}`);
      }
      
      const flowsData = await flowsResponse.json();
      const flowRunsData = flowRunsResponse.ok ? await flowRunsResponse.json() : [];
      
      if (flowsData.error) {
        setError(flowsData.error);
      } else {
        setFlows(flowsData);
      }
      
      if (!flowRunsData.error) {
        setFlowRuns(flowRunsData);
      }
    } catch (err) {
      console.error('Error fetching flows:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to load flows: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlows();
  }, []);

  const handleCreateFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    setCreateSuccess('');

    try {
      const response = await apiClient.createFlowDefinition(formData);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        setCreateError(data.error);
      } else {
        setCreateSuccess(`Flow created successfully! ID: ${data.id || 'N/A'}`);
        setShowCreateForm(false);
        setFormData({
          name: '',
          description: '',
          repository: '',
          branch: 'main',
          priority: 0,
          max_iterations: 20,
          next_flow_id: ''
        });
        // Refresh the flows list
        fetchFlows();
      }
    } catch (err) {
      console.error('Error creating flow:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setCreateError(`Failed to create flow: ${errorMessage}`);
    } finally {
      setCreating(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'priority' || name === 'max_iterations' ? parseInt(value) || 0 : value
    }));
  };

  const handleStartFlow = async (flowId: string) => {
    try {
      setStartingFlow(flowId);
      const response = await apiClient.startFlow({
        flow_id: flowId,
        repository: "owner/repo", // Default value, should be configurable
        branch: "main",
        initial_user_prompt: "",
        max_iterations: 10
      });

      if (!response.ok) {
        throw new Error(`Failed to start flow: ${response.status}`);
      }

      const data = await response.json();
      console.log('Flow started:', data);
      
      // Refresh the flows and flow runs list
      fetchFlows();
      
      alert(`Flow started successfully! Conversation ID: ${data.conversation_id}`);
    } catch (err) {
      console.error('Error starting flow:', err);
      alert(`Failed to start flow: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setStartingFlow(null);
    }
  };

  const handleStopFlow = async (flowRunId: string) => {
    try {
      setStoppingFlow(flowRunId);
      
      // First try to stop via the Durable Object endpoint
      // We need to get the conversation_id from the flow run
      const flowRun = flowRuns.find(fr => fr.id === flowRunId);
      if (flowRun && flowRun.conversation_id) {
        const response = await apiClient.stopFlow(flowRun.conversation_id);
        
        if (!response.ok) {
          throw new Error(`Failed to stop flow: ${response.status}`);
        }
        
        console.log('Flow stopped via Durable Object');
      } else {
        // Fallback: update flow run status
        const response = await apiClient.updateFlowRunStatus(flowRunId, {
          status: 'cancelled',
          completed_at: Math.floor(Date.now() / 1000)
        });
        
        if (!response.ok) {
          throw new Error(`Failed to update flow run status: ${response.status}`);
        }
        
        console.log('Flow run status updated to cancelled');
      }
      
      // Refresh the flows and flow runs list
      fetchFlows();
      
      alert('Flow stopped successfully!');
    } catch (err) {
      console.error('Error stopping flow:', err);
      alert(`Failed to stop flow: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setStoppingFlow(null);
    }
  };

  // Helper function to check if a flow has running instances
  const getRunningFlowRunsForFlow = (flowId: string) => {
    return flowRuns.filter(run => 
      run.flow_id === flowId && 
      (run.status === 'running' || run.status === 'pending')
    );
  };

  // Helper function to get all running flow runs
  const getAllRunningFlowRuns = () => {
    return flowRuns.filter(run => 
      run.status === 'running' || run.status === 'pending'
    );
  };

  // Helper function to stop all running flows
  const handleStopAllFlows = async () => {
    const runningFlows = getAllRunningFlowRuns();
    if (runningFlows.length === 0) {
      alert('No running flows to stop');
      return;
    }

    if (!confirm(`Are you sure you want to stop ${runningFlows.length} running flow(s)?`)) {
      return;
    }

    try {
      // Stop each running flow
      for (const flowRun of runningFlows) {
        if (flowRun.conversation_id) {
          await apiClient.stopFlow(flowRun.conversation_id);
        } else {
          await apiClient.updateFlowRunStatus(flowRun.id, {
            status: 'cancelled',
            completed_at: Math.floor(Date.now() / 1000)
          });
        }
      }
      
      // Refresh the flows and flow runs list
      fetchFlows();
      
      alert(`Successfully stopped ${runningFlows.length} flow(s)`);
    } catch (err) {
      console.error('Error stopping all flows:', err);
      alert(`Failed to stop all flows: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
            Loading flows...
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
            Error Loading Flows
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
              onClick={() => setShowCreateForm(true)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontWeight: '500',
                fontSize: '0.875rem'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#059669'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
            >
              + Create New Flow
            </button>
          </div>
          
          <h1 style={{
            fontSize: '2.25rem',
            fontWeight: 'bold',
            color: '#111827',
            marginBottom: '0.5rem'
          }}>
            All Flows
          </h1>
          <p style={{
            fontSize: '1.125rem',
            color: '#6b7280',
            marginBottom: '1rem'
          }}>
            {flows.length} flow{flows.length !== 1 ? 's' : ''} found
          </p>
          
          {/* Prominent Start/Stop buttons at the top */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            alignItems: 'center',
            marginBottom: '1rem',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => {
                if (flows.length === 0) {
                  alert('No flows available to start. Please create a flow first.');
                  return;
                }
                
                // Simple implementation: start the first flow
                // In a more complete implementation, this would open a dialog to select which flow to start
                const firstFlow = flows[0];
                if (confirm(`Start flow "${firstFlow.name || firstFlow.id}"?`)) {
                  handleStartFlow(firstFlow.id);
                }
              }}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#059669'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
            >
              <span>▶</span>
              Start Flow Run
            </button>
            
            <button
              onClick={handleStopAllFlows}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
            >
              <span>⏹</span>
              Stop All Running Flows
            </button>
            
            <div style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              marginLeft: 'auto'
            }}>
              {getAllRunningFlowRuns().length > 0 && (
                <span>
                  {getAllRunningFlowRuns().length} flow{getAllRunningFlowRuns().length !== 1 ? 's' : ''} currently running
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Flows List */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          overflow: 'hidden'
        }}>
          {flows.length === 0 ? (
            <div style={{
              padding: '3rem',
              textAlign: 'center'
            }}>
              <p style={{
                fontSize: '1.125rem',
                color: '#6b7280'
              }}>
                No flows found in the database.
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
                      Name
                    </th>
                    <th style={{
                      padding: '1rem',
                      textAlign: 'left',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      whiteSpace: 'nowrap'
                    }}>
                      Repository
                    </th>
                    <th style={{
                      padding: '1rem',
                      textAlign: 'left',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      whiteSpace: 'nowrap'
                    }}>
                      Branch
                    </th>
                    <th style={{
                      padding: '1rem',
                      textAlign: 'left',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      whiteSpace: 'nowrap'
                    }}>
                      Priority
                    </th>
                    <th style={{
                      padding: '1rem',
                      textAlign: 'left',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      whiteSpace: 'nowrap'
                    }}>
                      Max Iterations
                    </th>
                    <th style={{
                      padding: '1rem',
                      textAlign: 'left',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      whiteSpace: 'nowrap'
                    }}>
                      Created
                    </th>
                    <th style={{
                      padding: '1rem',
                      textAlign: 'left',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      whiteSpace: 'nowrap'
                    }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {flows.map((flow) => {
                    const runningFlowRuns = getRunningFlowRunsForFlow(flow.id);
                    const hasRunningInstances = runningFlowRuns.length > 0;
                    
                    return (
                    <tr 
                      key={flow.id}
                      style={{
                        borderBottom: '1px solid #e5e7eb',
                        transition: 'background-color 0.2s',
                        cursor: 'pointer'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      onClick={() => window.location.href = `/flow/${flow.id}`}
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
                          {flow.name || `Flow: ${flow.id.substring(0, 8)}...`}
                        </div>
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#6b7280',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '300px'
                        }}>
                          {flow.description?.substring(0, 100) || 'No description available'}
                          {flow.description && flow.description.length > 100 ? '...' : ''}
                        </div>
                      </td>
                      <td style={{
                        padding: '1rem',
                        fontSize: '0.875rem',
                        color: '#6b7280'
                      }}>
                        {flow.repository || 'Not specified'}
                      </td>
                      <td style={{
                        padding: '1rem',
                        fontSize: '0.875rem',
                        color: '#6b7280'
                      }}>
                        {flow.branch || 'main'}
                      </td>
                      <td style={{
                        padding: '1rem',
                        fontSize: '0.875rem'
                      }}>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          backgroundColor: flow.priority === 1 ? '#fee2e2' : 
                                          flow.priority === 2 ? '#fef3c7' : '#d1fae5',
                          color: flow.priority === 1 ? '#991b1b' : 
                                flow.priority === 2 ? '#92400e' : '#065f46',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          display: 'inline-block'
                        }}>
                          {flow.priority || 0}
                        </span>
                      </td>
                      <td style={{
                        padding: '1rem',
                        fontSize: '0.875rem',
                        color: '#6b7280'
                      }}>
                        {flow.max_iterations || 20}
                      </td>
                      <td style={{
                        padding: '1rem',
                        fontSize: '0.875rem',
                        color: '#6b7280',
                        whiteSpace: 'nowrap'
                      }}>
                        {new Date(flow.created_at).toLocaleDateString()}
                      </td>
                      <td style={{
                        padding: '1rem',
                        fontSize: '0.875rem',
                        color: '#6b7280',
                        whiteSpace: 'nowrap'
                      }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {/* Start button - show if no running instances or if user wants to start another */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartFlow(flow.id);
                            }}
                            disabled={startingFlow === flow.id}
                            style={{
                              padding: '0.25rem 0.75rem',
                              backgroundColor: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '0.375rem',
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              cursor: startingFlow === flow.id ? 'not-allowed' : 'pointer',
                              opacity: startingFlow === flow.id ? 0.7 : 1
                            }}
                          >
                            {startingFlow === flow.id ? 'Starting...' : 'Start'}
                          </button>
                          
                          {/* Stop buttons for each running instance */}
                          {hasRunningInstances && runningFlowRuns.map((flowRun) => (
                            <button
                              key={flowRun.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStopFlow(flowRun.id);
                              }}
                              disabled={stoppingFlow === flowRun.id}
                              style={{
                                padding: '0.25rem 0.75rem',
                                backgroundColor: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '0.375rem',
                                fontSize: '0.75rem',
                                fontWeight: '500',
                                cursor: stoppingFlow === flowRun.id ? 'not-allowed' : 'pointer',
                                opacity: stoppingFlow === flowRun.id ? 0.7 : 1
                              }}
                            >
                              {stoppingFlow === flowRun.id ? 'Stopping...' : `Stop (${runningFlowRuns.length})`}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          )}
        </div>

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
            Showing {flows.length} flow{flows.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Create Flow Modal */}
      {showCreateForm && (
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
            maxWidth: '600px',
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
                  fontWeight: '600',
                  color: '#111827'
                }}>
                  Create New Flow
                </h2>
                <button
                  onClick={() => setShowCreateForm(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '1.5rem',
                    color: '#6b7280',
                    cursor: 'pointer',
                    padding: '0.25rem'
                  }}
                >
                  ×
                </button>
              </div>
              
              {createError && (
                <div style={{
                  backgroundColor: '#fee2e2',
                  border: '1px solid #fca5a5',
                  color: '#dc2626',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  marginBottom: '1rem',
                  fontSize: '0.875rem'
                }}>
                  {createError}
                </div>
              )}
              
              {createSuccess && (
                <div style={{
                  backgroundColor: '#d1fae5',
                  border: '1px solid #a7f3d0',
                  color: '#065f46',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  marginBottom: '1rem',
                  fontSize: '0.875rem'
                }}>
                  {createSuccess}
                </div>
              )}
            </div>
            
            <form onSubmit={handleCreateFlow}>
              <div style={{
                padding: '1.5rem'
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1rem',
                  marginBottom: '1rem'
                }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem'
                      }}
                      placeholder="Flow name"
                    />
                  </div>
                  
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Priority
                    </label>
                    <input
                      type="number"
                      name="priority"
                      value={formData.priority}
                      onChange={handleInputChange}
                      min="0"
                      max="10"
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem'
                      }}
                    />
                  </div>
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      minHeight: '80px',
                      resize: 'vertical'
                    }}
                    placeholder="Flow description"
                  />
                </div>
                
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1rem',
                  marginBottom: '1rem'
                }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Repository
                    </label>
                    <input
                      type="text"
                      name="repository"
                      value={formData.repository}
                      onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem'
                      }}
                      placeholder="owner/repo"
                    />
                  </div>
                  
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Branch
                    </label>
                    <input
                      type="text"
                      name="branch"
                      value={formData.branch}
                      onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem'
                      }}
                      placeholder="main"
                    />
                  </div>
                </div>
                
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1rem',
                  marginBottom: '1rem'
                }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Max Iterations
                    </label>
                    <input
                      type="number"
                      name="max_iterations"
                      value={formData.max_iterations}
                      onChange={handleInputChange}
                      min="1"
                      max="100"
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem'
                      }}
                    />
                  </div>
                  
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Next Flow ID
                    </label>
                    <input
                      type="text"
                      name="next_flow_id"
                      value={formData.next_flow_id}
                      onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem'
                      }}
                      placeholder="Optional next flow ID"
                    />
                  </div>
                </div>
                

              </div>
              
              <div style={{
                padding: '1.5rem',
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.75rem'
              }}>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  disabled={creating}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    fontWeight: '500',
                    fontSize: '0.875rem',
                    opacity: creating ? 0.7 : 1
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    fontWeight: '500',
                    fontSize: '0.875rem',
                    opacity: creating ? 0.7 : 1
                  }}
                >
                  {creating ? 'Creating...' : 'Create Flow'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

