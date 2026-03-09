'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';


export default function TaskPage() {
  const params = useParams();
  const taskId = params.id as string;
  
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Fetch real task data from Cloudflare D1 database
    const fetchTask = async () => {
      try {
        setLoading(true);
        
        // Make API call to Cloudflare Worker backend for task data
        console.log('Fetching task:', taskId);
        const taskResponse = await apiClient.getTask(taskId);
        
        console.log('Task response status:', taskResponse.status);
        if (!taskResponse.ok) {
          const errorText = await taskResponse.text();
          throw new Error(`API error: ${taskResponse.status} - ${errorText}`);
        }
        
        const taskData = await taskResponse.json();
        console.log('Task response data:', taskData);
        
        if (taskData.error) {
          setError(taskData.error);
        } else {
          setTask(taskData);
        }
      } catch (err) {
        console.error('Error fetching task:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(`Failed to load task data: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    };

    if (taskId) {
      fetchTask();
    }
  }, [taskId]);

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
            Loading task details...
          </p>
        </div>
      </div>
    );
  }

  if (error || !task) {
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
            {error || 'Task not found'}
          </h2>
          <p style={{
            color: '#6b7280',
            marginBottom: '1.5rem'
          }}>
            The task you're looking for doesn't exist or couldn't be loaded.
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
            href="/"
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
            Back to all tasks
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
                {task.title || 'Untitled Task'}
              </h1>
              <div style={{
                display: 'flex',
                gap: '1rem',
                alignItems: 'center',
                flexWrap: 'wrap'
              }}>
                <span style={{
                  padding: '0.25rem 0.75rem',
                  backgroundColor: task.status === 'done' ? '#d1fae5' : 
                                  task.status === 'in_progress' ? '#fef3c7' : '#f3f4f6',
                  color: task.status === 'done' ? '#065f46' : 
                        task.status === 'in_progress' ? '#92400e' : '#374151',
                  borderRadius: '9999px',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}>
                  {task.status || 'pending'}
                </span>
                <span style={{
                  padding: '0.25rem 0.75rem',
                  backgroundColor: task.priority === 'high' ? '#fee2e2' : 
                                  task.priority === 'medium' ? '#fef3c7' : '#d1fae5',
                  color: task.priority === 'high' ? '#991b1b' : 
                        task.priority === 'medium' ? '#92400e' : '#065f46',
                  borderRadius: '9999px',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}>
                  {task.priority || 'medium'} priority
                </span>
                <span style={{
                  fontSize: '1.125rem',
                  color: '#6b7280'
                }}>
                  {task.task_type || 'Task'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Description Text Box Component */}
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
            Description
          </h2>
          <textarea
            style={{
              width: '100%',
              minHeight: '300px',
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
            value={task.description}
            readOnly
          />
          <div style={{
            marginTop: '1rem',
            fontSize: '0.875rem',
            color: '#6b7280'
          }}>
            Task ID: {task.id} • Created: {task.created_at ? new Date(task.created_at).toLocaleDateString() : 'N/A'}
          </div>
        </div>
      </div>
    </div>
  );
}



