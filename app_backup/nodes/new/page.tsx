'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

// Inner component that uses useSearchParams
function NewNodePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');

  const [formData, setFormData] = useState({
    project_id: projectId || '',
    type: 'task',
    title: '',
    content: JSON.stringify({ description: '' }),
    status: 'pending',
    metadata: JSON.stringify({})
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (projectId) {
      setFormData(prev => ({ ...prev, project_id: projectId }));
    }
  }, [projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.createNode(formData);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Redirect to project page
      if (formData.project_id) {
        router.push(`/projects/${formData.project_id}`);
      } else {
        router.push('/nodes');
      }
    } catch (err) {
      console.error('Error creating node:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to create node: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'content') {
      try {
        const contentObj = JSON.parse(value);
        setFormData(prev => ({ ...prev, [name]: JSON.stringify(contentObj) }));
      } catch {
        // If invalid JSON, store as plain text
        setFormData(prev => ({ ...prev, [name]: JSON.stringify({ description: value }) }));
      }
    } else if (name === 'metadata') {
      try {
        const metadataObj = JSON.parse(value);
        setFormData(prev => ({ ...prev, [name]: JSON.stringify(metadataObj) }));
      } catch {
        // If invalid JSON, store as plain text
        setFormData(prev => ({ ...prev, [name]: JSON.stringify({}) }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

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
                Create New Node
              </h1>
              <a
                href={projectId ? `/projects/${projectId}` : '/nodes'}
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
                {projectId ? 'Back to Project' : 'Back to Nodes'}
              </a>
            </div>
          </div>
          
          <p style={{
            fontSize: '1.125rem',
            color: '#6b7280'
          }}>
            {projectId ? `Creating node for project: ${projectId}` : 'Create a new node'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '1rem',
            backgroundColor: '#fee2e2',
            color: '#dc2626',
            borderRadius: '0.5rem',
            marginBottom: '1.5rem'
          }}>
            {error}
          </div>
        )}

        {/* Form */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          padding: '2rem'
        }}>
          <form onSubmit={handleSubmit}>
            <div style={{
              display: 'grid',
              gap: '1.5rem'
            }}>
              {/* Project ID */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Project ID
                </label>
                <input
                  type="text"
                  name="project_id"
                  value={formData.project_id}
                  onChange={handleChange}
                  placeholder="Enter project ID"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    color: '#111827'
                  }}
                  required
                />
              </div>

              {/* Title */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Title
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="Enter node title"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    color: '#111827'
                  }}
                  required
                />
              </div>

              {/* Type */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Type
                </label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    color: '#111827',
                    backgroundColor: 'white'
                  }}
                >
                  <option value="task">Task</option>
                  <option value="note">Note</option>
                  <option value="issue">Issue</option>
                  <option value="feature">Feature</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    color: '#111827',
                    backgroundColor: 'white'
                  }}
                >
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>

              {/* Content */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Content (JSON)
                </label>
                <textarea
                  name="content"
                  value={formData.content}
                  onChange={handleChange}
                  placeholder='{"description": "Enter description here"}'
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    color: '#111827',
                    fontFamily: 'monospace'
                  }}
                />
              </div>

              {/* Metadata */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Metadata (JSON)
                </label>
                <textarea
                  name="metadata"
                  value={formData.metadata}
                  onChange={handleChange}
                  placeholder='{"key": "value"}'
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    color: '#111827',
                    fontFamily: 'monospace'
                  }}
                />
              </div>

              {/* Submit Button */}
              <div style={{
                display: 'flex',
                gap: '1rem',
                justifyContent: 'flex-end'
              }}>
                <button
                  type="button"
                  onClick={() => router.back()}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    borderRadius: '0.5rem',
                    textDecoration: 'none',
                    fontWeight: '500',
                    transition: 'background-color 0.2s',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: loading ? '#9ca3af' : '#3b82f6',
                    color: 'white',
                    borderRadius: '0.5rem',
                    textDecoration: 'none',
                    fontWeight: '500',
                    transition: 'background-color 0.2s',
                    border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                  onMouseOver={(e) => {
                    if (!loading) e.currentTarget.style.backgroundColor = '#2563eb';
                  }}
                  onMouseOut={(e) => {
                    if (!loading) e.currentTarget.style.backgroundColor = '#3b82f6';
                  }}
                >
                  {loading ? 'Creating...' : 'Create Node'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Main component with Suspense boundary
export default function NewNodePage() {
  return (
    <>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <Suspense fallback={
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#f9fafb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
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
              Loading...
            </p>
          </div>
        </div>
      }>
        <NewNodePageContent />
      </Suspense>
    </>
  );
}