'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

export default function FlowRunPage() {
  const params = useParams();
  const flowRunId = params.id as string;
  
  const [flowRun, setFlowRun] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchFlowRun = async () => {
      try {
        setLoading(true);
        
        // First try to get all flow runs and filter
        console.log('Fetching flow run:', flowRunId);
        const allResponse = await apiClient.getFlowRuns();
        
        if (!allResponse.ok) {
          throw new Error(`API error: ${allResponse.status}`);
        }
        
        const allData = await allResponse.json();
        const foundFlowRun = allData.find((run: any) => run.id === flowRunId);
        
        if (!foundFlowRun) {
          throw new Error('Flow run not found');
        }
        
        setFlowRun(foundFlowRun);
      } catch (err) {
        console.error('Error fetching flow run:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(`Failed to load flow run data: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    };

    if (flowRunId) {
      fetchFlowRun();
    }
  }, [flowRunId]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatDuration = (ms: number) => {
    if (!ms) return 'N/A';
    return `${(ms / 1000).toFixed(2)} seconds`;
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
            Loading flow run details...
          </p>
        </div>
      </div>
    );
  }

  if (error || !flowRun) {
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
            {error || 'Flow Run not found'}
          </h2>
          <p style={{
            color: '#6b7280',
            marginBottom: '1.5rem'
          }}>
            The flow run you're looking for doesn't exist or couldn't be loaded.
          </p>
          <a
            href="/flow-runs"
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
            Back to Flow Runs
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
        {/* Title Component */}
        <div style={{
          marginBottom: '2rem'
        }}>
          <a
            href="/flow-runs"
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
            Back to all flow runs
          </a>
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              <h1 style={{
                fontSize: '2.25rem',
                fontWeight: 'bold',
                color: '#111827',
                marginBottom: '0.5rem'
              }}>
                Flow Run: {flowRun.id.substring(0, 20)}...
              </h1>
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
                  Flow Run
                </span>
                <span style={{
                  padding: '0.25rem 0.75rem',
                  backgroundColor: flowRun.status === 'completed' ? '#d1fae5' : 
                                  flowRun.status === 'failed' ? '#fee2e2' : '#fef3c7',
                  color: flowRun.status === 'completed' ? '#065f46' : 
                        flowRun.status === 'failed' ? '#991b1b' : '#92400e',
                  borderRadius: '9999px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  textTransform: 'capitalize'
                }}>
                  Status: {flowRun.status || 'pending'}
                </span>
                <span style={{
                  fontSize: '1.125rem',
                  color: '#6b7280'
                }}>
                  Duration: {formatDuration(flowRun.duration_ms)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Flow Run Details Section */}
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
            Flow Run Details
          </h2>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            <div>
              <h3 style={{
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#6b7280',
                marginBottom: '0.5rem',
                textTransform: 'uppercase'
              }}>
                Flow ID
              </h3>
              <p style={{
                fontSize: '1rem',
                color: '#111827'
              }}>
                <a 
                  href={`/flow/${flowRun.flow_id}`}
                  style={{
                    color: '#3b82f6',
                    textDecoration: 'none'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                  onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                >
                  {flowRun.flow_id}
                </a>
              </p>
            </div>
            
            <div>
              <h3 style={{
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#6b7280',
                marginBottom: '0.5rem',
                textTransform: 'uppercase'
              }}>
                Conversation ID
              </h3>
              <p style={{
                fontSize: '0.875rem',
                color: '#6b7280',
                fontFamily: 'monospace',
                wordBreak: 'break-all'
              }}>
                {flowRun.conversation_id || 'N/A'}
              </p>
            </div>
            
            <div>
              <h3 style={{
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#6b7280',
                marginBottom: '0.5rem',
                textTransform: 'uppercase'
              }}>
                Step ID
              </h3>
              <p style={{
                fontSize: '1rem',
                color: '#111827'
              }}>
                {flowRun.step_id || 'N/A'}
              </p>
            </div>
            
            <div>
              <h3 style={{
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#6b7280',
                marginBottom: '0.5rem',
                textTransform: 'uppercase'
              }}>
                Created At
              </h3>
              <p style={{
                fontSize: '1rem',
                color: '#111827'
              }}>
                {formatDate(flowRun.created_at)}
              </p>
            </div>
            
            {flowRun.next_flow_id && (
              <div>
                <h3 style={{
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#6b7280',
                  marginBottom: '0.5rem',
                  textTransform: 'uppercase'
                }}>
                  Next Flow ID
                </h3>
                <p style={{
                  fontSize: '1rem',
                  color: '#111827'
                }}>
                  <a 
                    href={`/flow/${flowRun.next_flow_id}`}
                    style={{
                      color: '#3b82f6',
                      textDecoration: 'none'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                    onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                  >
                    {flowRun.next_flow_id}
                  </a>
                </p>
              </div>
            )}
          </div>

          {/* Prompt and Response Section */}
          <div style={{
            marginTop: '2rem'
          }}>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: '#111827',
              marginBottom: '1rem'
            }}>
              Prompt & Response
            </h3>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1.5rem'
            }}>
              {/* Prompt */}
              <div style={{
                backgroundColor: '#f9fafb',
                borderRadius: '0.5rem',
                padding: '1.5rem',
                border: '1px solid #e5e7eb'
              }}>
                <h4 style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: '#111827',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span style={{
                    width: '0.5rem',
                    height: '0.5rem',
                    backgroundColor: '#3b82f6',
                    borderRadius: '50%'
                  }}></span>
                  Input Prompt
                </h4>
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '0.375rem',
                  padding: '1rem',
                  border: '1px solid #e5e7eb',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {flowRun.input_prompt || 'No prompt available'}
                </div>
              </div>
              
              {/* Response */}
              <div style={{
                backgroundColor: '#f9fafb',
                borderRadius: '0.5rem',
                padding: '1.5rem',
                border: '1px solid #e5e7eb'
              }}>
                <h4 style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: '#111827',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span style={{
                    width: '0.5rem',
                    height: '0.5rem',
                    backgroundColor: '#10b981',
                    borderRadius: '50%'
                  }}></span>
                  Output Response
                </h4>
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '0.375rem',
                  padding: '1rem',
                  border: '1px solid #e5e7eb',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {flowRun.output_response || 'No response available'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


export const dynamic = 'force-static';
