'use client';

import { useState, useEffect, use } from 'react';
import { apiClient } from '@/lib/api-client';

export default function FlowStepsPage({ params }: { params: Promise<{ flowId: string }> }) {
  const { flowId } = use(params);
  
  const [steps, setSteps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flowInfo, setFlowInfo] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch flow info first
        const flowResponse = await apiClient.getFlowDefinition(flowId);
        if (!flowResponse.ok) {
          throw new Error(`Failed to fetch flow: ${flowResponse.status}`);
        }
        const flowData = await flowResponse.json();
        if (flowData.error) {
          setError(flowData.error);
        } else {
          setFlowInfo(flowData);
        }
        
        // Fetch steps for this flow
        const stepsResponse = await apiClient.getFlowSpecificSteps(flowId);
        
        if (!stepsResponse.ok) {
          throw new Error(`API error: ${stepsResponse.status}`);
        }
        
        const stepsData = await stepsResponse.json();
        
        if (stepsData.error) {
          setError(stepsData.error);
        } else {
          setSteps(stepsData);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(`Failed to load steps: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    };

    if (flowId) {
      fetchData();
    }
  }, [flowId]);

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
            Loading steps for flow...
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
          <a
            href={`/flow/${flowId}`}
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
            Back to flow
          </a>
          
          <h1 style={{
            fontSize: '2.25rem',
            fontWeight: 'bold',
            color: '#111827',
            marginBottom: '0.5rem'
          }}>
            {flowInfo?.name || `Flow: ${flowId.substring(0, 8)}...`}
          </h1>
          <p style={{
            fontSize: '1.125rem',
            color: '#6b7280'
          }}>
            {steps.length} step{steps.length !== 1 ? 's' : ''} found
          </p>
        </div>

        {/* Steps List - Simple table showing only titles for now */}
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
                No steps found for this flow.
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
                      Step Title
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
                      Type
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
                        {step.step_key && (
                          <div style={{
                            fontSize: '0.75rem',
                            color: '#6b7280'
                          }}>
                            Key: {step.step_key}
                          </div>
                        )}
                      </td>
                      <td style={{
                        padding: '1rem',
                        fontSize: '0.875rem',
                        color: '#6b7280'
                      }}>
                        {step.order_index || step.step_number || 0}
                      </td>
                      <td style={{
                        padding: '1rem',
                        fontSize: '0.875rem'
                      }}>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          backgroundColor: step.step_type === 'analysis' ? '#dbeafe' : 
                                          step.step_type === 'optimization' ? '#fef3c7' :
                                          step.step_type === 'design' ? '#d1fae5' :
                                          step.step_type === 'planning' ? '#f3e8ff' : '#f3f4f6',
                          color: step.step_type === 'analysis' ? '#1e40af' : 
                                step.step_type === 'optimization' ? '#92400e' :
                                step.step_type === 'design' ? '#065f46' :
                                step.step_type === 'planning' ? '#6b21a8' : '#374151',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          display: 'inline-block'
                        }}>
                          {step.step_type || 'unknown'}
                        </span>
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
            Showing {steps.length} step{steps.length !== 1 ? 's' : ''} for flow: {flowId.substring(0, 8)}...
          </p>
        </div>
      </div>
    </div>
  );
}

export const runtime = 'edge';