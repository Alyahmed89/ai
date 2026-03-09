'use client';

import { useState, useEffect, use } from 'react';
import { apiClient } from '@/lib/api-client';


interface Task {
  id: string;
  title: string;
  description: string | null;
  task_type: string;
  priority: string;
  status: string;
  flow_id: string;
  created_at: string;
  estimated_complexity: string;
  endpoint_path: string;
  http_method: string;
}

export default function FlowTasksPage({ params }: { params: Promise<{ flowId: string }> }) {
  const { flowId } = use(params);
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoading(true);
        setError('');
        
        const response = await apiClient.getTasksByFlowId(flowId);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch tasks: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        setTasks(data);
      } catch (err) {
        console.error('Error fetching tasks:', err);
        setError(err instanceof Error ? err.message : 'Failed to load tasks');
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [flowId]);

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high': return { backgroundColor: '#fee2e2', color: '#991b1b' };
      case 'medium': return { backgroundColor: '#fef3c7', color: '#92400e' };
      case 'low': return { backgroundColor: '#d1fae5', color: '#065f46' };
      default: return { backgroundColor: '#f3f4f6', color: '#374151' };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'done': return { backgroundColor: '#d1fae5', color: '#065f46' };
      case 'in_progress': return { backgroundColor: '#dbeafe', color: '#1e40af' };
      case 'pending': return { backgroundColor: '#fef3c7', color: '#92400e' };
      default: return { backgroundColor: '#f3f4f6', color: '#374151' };
    }
  };

  const getTaskTypeColor = (taskType: string) => {
    switch (taskType.toLowerCase()) {
      case 'implementation': return { backgroundColor: '#f3e8ff', color: '#6b21a8' };
      case 'validation': return { backgroundColor: '#e0e7ff', color: '#3730a3' };
      case 'testing': return { backgroundColor: '#fce7f3', color: '#9d174d' };
      default: return { backgroundColor: '#f3f4f6', color: '#374151' };
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        padding: '1rem'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          <div style={{
            textAlign: 'center',
            padding: '3rem 0'
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
              Loading tasks for flow {flowId}...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        padding: '1rem'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '0.5rem',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: '#991b1b',
              marginBottom: '0.5rem'
            }}>
              Error Loading Tasks
            </h2>
            <p style={{
              color: '#dc2626',
              marginBottom: '1rem'
            }}>
              {error}
            </p>
            <button 
              onClick={() => window.location.reload()}
              style={{
                marginTop: '1rem',
                padding: '0.5rem 1rem',
                backgroundColor: '#dc2626',
                color: 'white',
                borderRadius: '0.375rem',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '500',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f9fafb',
      padding: '1rem'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div style={{
          marginBottom: '2rem'
        }}>
          <h1 style={{
            fontSize: '1.875rem',
            fontWeight: 'bold',
            color: '#111827',
            marginBottom: '0.5rem'
          }}>
            Tasks for Flow: {flowId}
          </h1>
          <p style={{
            color: '#6b7280'
          }}>
            {tasks.length === 0 ? 'No tasks found' : `Showing ${tasks.length} task${tasks.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {tasks.length === 0 ? (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
            padding: '2rem',
            textAlign: 'center'
          }}>
            <p style={{
              color: '#6b7280',
              fontSize: '1.125rem'
            }}>
              No tasks found for this flow.
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(1, 1fr)',
            gap: '1.5rem'
          }}>
            {tasks.map((task) => {
              const priorityColor = getPriorityColor(task.priority);
              const statusColor = getStatusColor(task.status);
              const taskTypeColor = getTaskTypeColor(task.task_type);
              
              return (
                <div 
                  key={task.id} 
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '0.5rem',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                    padding: '1.5rem',
                    transition: 'box-shadow 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'}
                  onMouseOut={(e) => e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '1rem'
                  }}>
                    <h3 style={{
                      fontSize: '1.125rem',
                      fontWeight: '600',
                      color: '#111827',
                      margin: 0,
                      flex: 1
                    }}>
                      {task.title}
                    </h3>
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.5rem'
                    }}>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        ...priorityColor
                      }}>
                        {task.priority}
                      </span>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        ...statusColor
                      }}>
                        {task.status}
                      </span>
                    </div>
                  </div>
                  
                  {task.description && (
                    <p style={{
                      color: '#6b7280',
                      fontSize: '0.875rem',
                      marginBottom: '1rem'
                    }}>
                      {task.description}
                    </p>
                  )}
                  
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        ...taskTypeColor
                      }}>
                        {task.task_type}
                      </span>
                      <span style={{
                        fontSize: '0.75rem',
                        color: '#6b7280',
                        backgroundColor: '#f3f4f6',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.25rem'
                      }}>
                        {task.estimated_complexity}
                      </span>
                    </div>
                    
                    {task.endpoint_path && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          color: '#374151'
                        }}>
                          Endpoint:
                        </span>
                        <code style={{
                          fontSize: '0.75rem',
                          backgroundColor: '#f3f4f6',
                          color: '#1f2937',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '0.25rem',
                          fontFamily: 'monospace'
                        }}>
                          {task.http_method} {task.endpoint_path}
                        </code>
                      </div>
                    )}
                    
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#6b7280'
                    }}>
                      Created: {new Date(task.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{
          marginTop: '2rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid #e5e7eb'
        }}>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <div style={{
                width: '0.75rem',
                height: '0.75rem',
                borderRadius: '50%',
                backgroundColor: '#dc2626'
              }}></div>
              <span style={{
                fontSize: '0.875rem',
                color: '#6b7280'
              }}>
                High Priority
              </span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <div style={{
                width: '0.75rem',
                height: '0.75rem',
                borderRadius: '50%',
                backgroundColor: '#f59e0b'
              }}></div>
              <span style={{
                fontSize: '0.875rem',
                color: '#6b7280'
              }}>
                Medium Priority
              </span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <div style={{
                width: '0.75rem',
                height: '0.75rem',
                borderRadius: '50%',
                backgroundColor: '#10b981'
              }}></div>
              <span style={{
                fontSize: '0.875rem',
                color: '#6b7280'
              }}>
                Low Priority
              </span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <div style={{
                width: '0.75rem',
                height: '0.75rem',
                borderRadius: '50%',
                backgroundColor: '#3b82f6'
              }}></div>
              <span style={{
                fontSize: '0.875rem',
                color: '#6b7280'
              }}>
                In Progress
              </span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <div style={{
                width: '0.75rem',
                height: '0.75rem',
                borderRadius: '50%',
                backgroundColor: '#8b5cf6'
              }}></div>
              <span style={{
                fontSize: '0.875rem',
                color: '#6b7280'
              }}>
                Implementation
              </span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <div style={{
                width: '0.75rem',
                height: '0.75rem',
                borderRadius: '50%',
                backgroundColor: '#4f46e5'
              }}></div>
              <span style={{
                fontSize: '0.875rem',
                color: '#6b7280'
              }}>
                Validation
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

