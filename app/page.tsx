'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

export default function Home() {
  const [flowRuns, setFlowRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterFlowId, setFilterFlowId] = useState('');
  const [startingFlow, setStartingFlow] = useState<string | null>(null);
  const [stoppingFlow, setStoppingFlow] = useState<string | null>(null);

  const fetchFlowRuns = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getFlowRuns(50, filterFlowId || undefined);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setFlowRuns(data);
      }
    } catch (err) {
      console.error('Error fetching flow runs:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to load flow runs: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlowRuns();
  }, [filterFlowId]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilterFlowId(e.target.value);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const truncateText = (text: string, maxLength: number) => {
    if (!text) return 'N/A';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
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
      
      // Refresh the flow runs list
      fetchFlowRuns();
      
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
      
      // Refresh the flow runs list
      fetchFlowRuns();
      
      alert('Flow stopped successfully!');
    } catch (err) {
      console.error('Error stopping flow:', err);
      alert(`Failed to stop flow: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setStoppingFlow(null);
    }
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
      
      // Refresh the flow runs list
      fetchFlowRuns();
      
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
            Loading flow runs...
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
            Error Loading Flow Runs
          </h2>
          <p style={{
            color: '#6b7280',
            marginBottom: '1.5rem'
          }}>
            {error}
          </p>
          <button
            onClick={() => fetchFlowRuns()}
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              fontWeight: '500',
              transition: 'background-color 0.2s',
              border: 'none',
              cursor: 'pointer'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
          >
            Try Again
          </button>
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
        maxWidth: '1400px',
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
            <div style={{
              display: 'flex',
              gap: '1rem',
              alignItems: 'center'
            }}>
              <h1 style={{
                fontSize: '2.25rem',
                fontWeight: 'bold',
                color: '#111827',
                marginBottom: '0.5rem'
              }}>
                Flow Runs
              </h1>
              <a
                href="/flows"
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
              >
                View Flows
              </a>
              <a
                href="/tasks"
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
              >
                View Tasks
              </a>
              <a
                href="/api-test"
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
              >
                API Testing
              </a>
            </div>
          </div>
          
          <p style={{
            fontSize: '1.125rem',
            color: '#6b7280'
          }}>
            {flowRuns.length} flow run{flowRuns.length !== 1 ? 's' : ''} found
          </p>
          
          {/* Filter */}
          <div style={{
            marginTop: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <label htmlFor="filterFlowId" style={{
              fontSize: '0.875rem',
              color: '#374151',
              fontWeight: '500'
            }}>
              Filter by Flow ID:
            </label>
            <input
              type="text"
              id="filterFlowId"
              value={filterFlowId}
              onChange={handleFilterChange}
              placeholder="Enter flow ID..."
              style={{
                padding: '0.5rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                width: '300px'
              }}
            />
            {filterFlowId && (
              <button
                onClick={() => setFilterFlowId('')}
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                Clear Filter
              </button>
            )}
          </div>
          
          {/* Prominent Start/Stop buttons at the top */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            alignItems: 'center',
            marginTop: '1.5rem',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => {
                // Automatically start flow priority 1 without popup
                // Using "honoch" as the flow ID based on the step page
                handleStartFlow("honoch");
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
              Start Flow Priority 1 (honoch)
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

        {/* Flow Runs List */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          overflow: 'hidden'
        }}>
          {flowRuns.length === 0 ? (
            <div style={{
              padding: '3rem',
              textAlign: 'center'
            }}>
              <p style={{
                fontSize: '1.125rem',
                color: '#6b7280'
              }}>
                No flow runs found in the database.
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
                      ID
                    </th>
                    <th style={{
                      padding: '1rem',
                      textAlign: 'left',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      whiteSpace: 'nowrap'
                    }}>
                      Flow ID
                    </th>
                    <th style={{
                      padding: '1rem',
                      textAlign: 'left',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      whiteSpace: 'nowrap'
                    }}>
                      Prompt
                    </th>
                    <th style={{
                      padding: '1rem',
                      textAlign: 'left',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      whiteSpace: 'nowrap'
                    }}>
                      Response
                    </th>
                    <th style={{
                      padding: '1rem',
                      textAlign: 'left',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      whiteSpace: 'nowrap'
                    }}>
                      Status
                    </th>
                    <th style={{
                      padding: '1rem',
                      textAlign: 'left',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      whiteSpace: 'nowrap'
                    }}>
                      Condition
                    </th>
                    <th style={{
                      padding: '1rem',
                      textAlign: 'left',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      whiteSpace: 'nowrap'
                    }}>
                      Duration
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
                  </tr>
                </thead>
                <tbody>
                  {flowRuns.map((flowRun) => (
                    <tr 
                      key={flowRun.id}
                      style={{
                        borderBottom: '1px solid #e5e7eb',
                        transition: 'background-color 0.2s',
                        cursor: 'pointer'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      onClick={() => window.location.href = `/flow-run/${flowRun.id}`}
                    >
                      <td style={{
                        padding: '1rem',
                        fontSize: '0.875rem',
                        color: '#111827',
                        fontFamily: 'monospace'
                      }}>
                        {flowRun.id.substring(0, 12)}...
                      </td>
                      <td style={{
                        padding: '1rem',
                        fontSize: '0.875rem',
                        color: '#3b82f6'
                      }}>
                        <a 
                          href={`/flow/${flowRun.flow_id}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            color: '#3b82f6',
                            textDecoration: 'none'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                          onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                        >
                          {flowRun.flow_id}
                        </a>
                      </td>
                      <td style={{
                        padding: '1rem',
                        fontSize: '0.875rem',
                        color: '#6b7280',
                        maxWidth: '200px'
                      }}>
                        <div style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {truncateText(flowRun.input_prompt, 50)}
                        </div>
                      </td>
                      <td style={{
                        padding: '1rem',
                        fontSize: '0.875rem',
                        color: '#6b7280',
                        maxWidth: '200px'
                      }}>
                        <div style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {truncateText(flowRun.output_response, 50)}
                        </div>
                      </td>
                      <td style={{
                        padding: '1rem',
                        fontSize: '0.875rem'
                      }}>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          backgroundColor: flowRun.status === 'completed' ? '#d1fae5' : 
                                          flowRun.status === 'failed' ? '#fee2e2' : '#fef3c7',
                          color: flowRun.status === 'completed' ? '#065f46' : 
                                flowRun.status === 'failed' ? '#991b1b' : '#92400e',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          display: 'inline-block',
                          textTransform: 'capitalize'
                        }}>
                          {flowRun.status || 'pending'}
                        </span>
                      </td>
                      <td style={{
                        padding: '1rem',
                        fontSize: '0.875rem',
                        color: '#6b7280',
                        maxWidth: '150px'
                      }}>
                        <div style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {flowRun.condition ? truncateText(flowRun.condition, 30) : 'N/A'}
                        </div>
                      </td>
                      <td style={{
                        padding: '1rem',
                        fontSize: '0.875rem',
                        color: '#6b7280'
                      }}>
                        {flowRun.duration_ms ? `${(flowRun.duration_ms / 1000).toFixed(2)}s` : 'N/A'}
                      </td>
                      <td style={{
                        padding: '1rem',
                        fontSize: '0.875rem',
                        color: '#6b7280',
                        whiteSpace: 'nowrap'
                      }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {/* Start button - show for completed/failed/cancelled flows */}
                          {(flowRun.status === 'completed' || flowRun.status === 'failed' || flowRun.status === 'cancelled' || !flowRun.status) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartFlow(flowRun.flow_id);
                              }}
                              disabled={startingFlow === flowRun.flow_id}
                              style={{
                                padding: '0.25rem 0.75rem',
                                backgroundColor: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '0.375rem',
                                fontSize: '0.75rem',
                                fontWeight: '500',
                                cursor: startingFlow === flowRun.flow_id ? 'not-allowed' : 'pointer',
                                opacity: startingFlow === flowRun.flow_id ? 0.7 : 1
                              }}
                            >
                              {startingFlow === flowRun.flow_id ? 'Starting...' : 'Start'}
                            </button>
                          )}
                          
                          {/* Stop button - show for running/pending flows */}
                          {(flowRun.status === 'running' || flowRun.status === 'pending') && (
                            <button
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
                              {stoppingFlow === flowRun.id ? 'Stopping...' : 'Stop'}
                            </button>
                          )}
                        </div>
                      </td>
                      <td style={{
                        padding: '1rem',
                        fontSize: '0.875rem',
                        color: '#6b7280',
                        whiteSpace: 'nowrap'
                      }}>
                        {formatDate(flowRun.created_at)}
                      </td>
                    </tr>
                  ))}
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
            Showing {flowRuns.length} flow run{flowRuns.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </div>
  );
}