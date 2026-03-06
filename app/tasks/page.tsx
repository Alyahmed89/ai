'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'pending',
    priority: 'medium',
    task_type: 'Task',
    flow_id: ''
  });

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getTasks(50);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setTasks(data);
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to load tasks: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    setCreateSuccess('');

    try {
      const response = await apiClient.createTask(formData);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        setCreateError(data.error);
      } else {
        setCreateSuccess(`Task created successfully! ID: ${data.id || 'N/A'}`);
        setShowCreateForm(false);
        setFormData({
          title: '',
          description: '',
          status: 'pending',
          priority: 'medium',
          task_type: 'Task',
          flow_id: ''
        });
        // Refresh the tasks list
        fetchTasks();
      }
    } catch (err) {
      console.error('Error creating task:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setCreateError(`Failed to create task: ${errorMessage}`);
    } finally {
      setCreating(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
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
            Loading tasks...
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
            Error Loading Tasks
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
              + Create New Task
            </button>
          </div>
          
          <h1 style={{
            fontSize: '2.25rem',
            fontWeight: 'bold',
            color: '#111827',
            marginBottom: '0.5rem'
          }}>
            All Tasks
          </h1>
          <p style={{
            fontSize: '1.125rem',
            color: '#6b7280'
          }}>
            {tasks.length} task{tasks.length !== 1 ? 's' : ''} found
          </p>
        </div>

        {/* Tasks List */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          overflow: 'hidden'
        }}>
          {tasks.length === 0 ? (
            <div style={{
              padding: '3rem',
              textAlign: 'center'
            }}>
              <p style={{
                fontSize: '1.125rem',
                color: '#6b7280'
              }}>
                No tasks found in the database.
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
                      Type
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
                  {tasks.map((task) => (
                    <tr 
                      key={task.id}
                      style={{
                        borderBottom: '1px solid #e5e7eb',
                        transition: 'background-color 0.2s',
                        cursor: 'pointer'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      onClick={() => window.location.href = `/task/${task.id}`}
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
                          {task.title}
                        </div>
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#6b7280',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '300px'
                        }}>
                          {task.description.substring(0, 100)}
                          {task.description.length > 100 ? '...' : ''}
                        </div>
                      </td>
                      <td style={{
                        padding: '1rem',
                        fontSize: '0.875rem'
                      }}>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          backgroundColor: task.status === 'done' ? '#d1fae5' : 
                                          task.status === 'in_progress' ? '#fef3c7' : '#f3f4f6',
                          color: task.status === 'done' ? '#065f46' : 
                                task.status === 'in_progress' ? '#92400e' : '#374151',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          display: 'inline-block'
                        }}>
                          {task.status || 'pending'}
                        </span>
                      </td>
                      <td style={{
                        padding: '1rem',
                        fontSize: '0.875rem'
                      }}>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          backgroundColor: task.priority === 'high' ? '#fee2e2' : 
                                          task.priority === 'medium' ? '#fef3c7' : '#d1fae5',
                          color: task.priority === 'high' ? '#991b1b' : 
                                task.priority === 'medium' ? '#92400e' : '#065f46',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          display: 'inline-block'
                        }}>
                          {task.priority || 'medium'}
                        </span>
                      </td>
                      <td style={{
                        padding: '1rem',
                        fontSize: '0.875rem',
                        color: '#6b7280'
                      }}>
                        {task.task_type || 'Task'}
                      </td>
                      <td style={{
                        padding: '1rem',
                        fontSize: '0.875rem',
                        color: '#6b7280',
                        whiteSpace: 'nowrap'
                      }}>
                        {new Date(task.created_at).toLocaleDateString()}
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
            Showing {tasks.length} task{tasks.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </div>
  );
}

export const runtime = 'edge';