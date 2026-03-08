'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface Project {
  id: string;
  name: string;
  status: string;
  metadata: string | null;
  created_at: number;
  updated_at: number;
  node_count?: number;
  flow_count?: number;
  task_count?: number;
  execution_count?: number;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    status: 'active' as 'active' | 'archived' | 'completed',
    metadata: '{}'
  });

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getProjects(50);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else if (data.success && data.data) {
        setProjects(data.data);
      } else {
        setProjects(data);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to load projects: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async () => {
    try {
      const response = await apiClient.createProject({
        name: newProject.name,
        status: newProject.status,
        metadata: newProject.metadata
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create project: ${response.status}`);
      }
      
      const createdProject = await response.json();
      console.log('Project created:', createdProject);
      
      // Refresh projects list
      fetchProjects();
      
      // Reset form
      setNewProject({
        name: '',
        status: 'active',
        metadata: '{}'
      });
      setShowCreateForm(false);
      
    } catch (err) {
      console.error('Error creating project:', err);
      alert(`Failed to create project: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleUpdateProject = async (projectId: string, updates: { status?: string; metadata?: string }) => {
    try {
      const response = await apiClient.updateProject(projectId, updates);
      
      if (!response.ok) {
        throw new Error(`Failed to update project: ${response.status}`);
      }
      
      console.log('Project updated');
      
      // Refresh projects list
      fetchProjects();
      
    } catch (err) {
      console.error('Error updating project:', err);
      alert(`Failed to update project: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project?')) {
      return;
    }
    
    try {
      const response = await apiClient.deleteProject(projectId);
      
      if (!response.ok) {
        throw new Error(`Failed to delete project: ${response.status}`);
      }
      
      console.log('Project deleted');
      
      // Refresh projects list
      fetchProjects();
      
    } catch (err) {
      console.error('Error deleting project:', err);
      alert(`Failed to delete project: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const parseMetadata = (metadata: string | null) => {
    if (!metadata) return {};
    try {
      return JSON.parse(metadata);
    } catch {
      return {};
    }
  };

  const formatDate = (dateValue: string | number) => {
    if (typeof dateValue === 'number') {
      return new Date(dateValue * 1000).toLocaleString();
    }
    return new Date(dateValue).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'completed': return '#3b82f6';
      case 'archived': return '#6b7280';
      default: return '#6b7280';
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
            Loading projects...
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
            Error Loading Projects
          </h2>
          <p style={{
            color: '#6b7280',
            marginBottom: '1.5rem'
          }}>
            {error}
          </p>
          <button
            onClick={() => fetchProjects()}
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
                Projects
              </h1>
              <a
                href="/"
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
                Back to Home
              </a>
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
            </div>
          </div>
          
          <p style={{
            fontSize: '1.125rem',
            color: '#6b7280'
          }}>
            {projects.length} project{projects.length !== 1 ? 's' : ''} found
          </p>
          
          {/* Create Project Button */}
          <div style={{
            marginTop: '1.5rem'
          }}>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
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
              <span>+</span>
              Create New Project
            </button>
          </div>
        </div>
        {/* Create Project Form */}
        {showCreateForm && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
            padding: '2rem',
            marginBottom: '2rem'
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: '#111827',
              marginBottom: '1.5rem'
            }}>
              Create New Project
            </h2>
            
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Project Name
                </label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({...newProject, name: e.target.value})}
                  placeholder="Enter project name"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '1rem'
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
                  Status
                </label>
                <select
                  value={newProject.status}
                  onChange={(e) => setNewProject({...newProject, status: e.target.value as 'active' | 'archived' | 'completed'})}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    backgroundColor: 'white'
                  }}
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              
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
                  value={newProject.metadata}
                  onChange={(e) => setNewProject({...newProject, metadata: e.target.value})}
                  placeholder='{"description": "Project description"}'
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    fontFamily: 'monospace'
                  }}
                />
              </div>
              
              <div style={{
                display: 'flex',
                gap: '1rem',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => setShowCreateForm(false)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateProject}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Create Project
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Projects List */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          overflow: 'hidden'
        }}>
          {projects.length === 0 ? (
            <div style={{
              padding: '3rem',
              textAlign: 'center'
            }}>
              <p style={{
                fontSize: '1.125rem',
                color: '#6b7280'
              }}>
                No projects found. Create your first project!
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
                      fontWeight: '600',
                      color: '#374151'
                    }}>
                      Name
                    </th>
                    <th style={{
                      padding: '1rem',
                      textAlign: 'left',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: '#374151'
                    }}>
                      Status
                    </th>
                    <th style={{
                      padding: '1rem',
                      textAlign: 'left',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: '#374151'
                    }}>
                      Description
                    </th>
                    <th style={{
                      padding: '1rem',
                      textAlign: 'left',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: '#374151'
                    }}>
                      Created
                    </th>
                    <th style={{
                      padding: '1rem',
                      textAlign: 'left',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: '#374151'
                    }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => {
                    const metadata = parseMetadata(project.metadata);
                    const description = metadata.description || 'No description';
                    
                    return (
                      <tr key={project.id} style={{
                        borderBottom: '1px solid #e5e7eb'
                      }}>
                        <td style={{
                          padding: '1rem',
                          fontSize: '0.875rem',
                          color: '#111827'
                        }}>
                          {project.name}
                        </td>
                        <td style={{
                          padding: '1rem'
                        }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.25rem 0.75rem',
                            backgroundColor: getStatusColor(project.status),
                            color: 'white',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: '500'
                          }}>
                            {project.status}
                          </span>
                        </td>
                        <td style={{
                          padding: '1rem',
                          fontSize: '0.875rem',
                          color: '#6b7280',
                          maxWidth: '300px'
                        }}>
                          {description}
                        </td>
                        <td style={{
                          padding: '1rem',
                          fontSize: '0.875rem',
                          color: '#6b7280'
                        }}>
                          {formatDate(project.created_at)}
                        </td>
                        <td style={{
                          padding: '1rem',
                          display: 'flex',
                          gap: '0.5rem'
                        }}>
                          <button
                            onClick={() => handleUpdateProject(project.id, { status: 'archived' })}
                            style={{
                              padding: '0.5rem 1rem',
                              backgroundColor: '#f3f4f6',
                              color: '#374151',
                              border: 'none',
                              borderRadius: '0.375rem',
                              cursor: 'pointer',
                              fontSize: '0.875rem'
                            }}
                          >
                            Archive
                          </button>
                          <button
                            onClick={() => handleDeleteProject(project.id)}
                            style={{
                              padding: '0.5rem 1rem',
                              backgroundColor: '#fee2e2',
                              color: '#dc2626',
                              border: 'none',
                              borderRadius: '0.375rem',
                              cursor: 'pointer',
                              fontSize: '0.875rem'
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
