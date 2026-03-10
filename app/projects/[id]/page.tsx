'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import NodeHierarchy from '@/app/components/NodeHierarchy';

interface Project {
  id: string;
  name: string;
  status: string;
  metadata: string | null;
  created_at: number;
  updated_at: number;
}

interface Node {
  id: string;
  project_id: string;
  type: string;
  title: string;
  content: string;
  status: string;
  metadata: string;
  created_at: string;
  updated_at: string;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  
  const [project, setProject] = useState<Project | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'list' | 'details'>('hierarchy');

  const fetchProject = async () => {
    try {
      const response = await apiClient.getProject(projectId);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch project: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.data) {
        setProject(data.data);
      } else {
        throw new Error('Project not found');
      }
    } catch (err) {
      console.error('Error fetching project:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const fetchNodes = async () => {
    try {
      const response = await apiClient.getNodes(100, projectId);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch nodes: ${response.status}`);
      }
      
      const result = await response.json();
      // Our API returns {success: true, data: [...]}
      setNodes(result.success && result.data ? result.data : []);
    } catch (err) {
      console.error('Error fetching nodes:', err);
    }
  };

  useEffect(() => {
    if (projectId) {
      Promise.all([fetchProject(), fetchNodes()]).finally(() => {
        setLoading(false);
      });
    }
  }, [projectId]);

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
            Loading project...
          </p>
        </div>
      </div>
    );
  }

  if (error || !project) {
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
            {error ? 'Error Loading Project' : 'Project Not Found'}
          </h2>
          <p style={{
            color: '#6b7280',
            marginBottom: '1.5rem'
          }}>
            {error || 'The project you are looking for does not exist.'}
          </p>
          <button
            onClick={() => router.push('/projects')}
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
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  const parseMetadata = (metadata: string | null) => {
    if (!metadata) return {};
    try {
      return JSON.parse(metadata);
    } catch {
      return {};
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'completed': return '#3b82f6';
      case 'archived': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const handleNodeSelect = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    // You could navigate to the node detail page here
    // router.push(`/nodes/${nodeId}`);
  };

  const handleCreateNode = () => {
    // Navigate to node creation page or show modal
    router.push(`/nodes/new?projectId=${projectId}`);
  };

  const metadata = parseMetadata(project.metadata);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f9fafb',
      padding: '2rem'
    }}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
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
              <button
                onClick={() => router.push('/projects')}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  transition: 'background-color 0.2s',
                  border: 'none',
                  cursor: 'pointer'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
              >
                ← Back to Projects
              </button>
              <h1 style={{
                fontSize: '2.25rem',
                fontWeight: 'bold',
                color: '#111827',
                marginBottom: '0.5rem'
              }}>
                {project.name}
              </h1>
            </div>
            
            <div style={{
              display: 'flex',
              gap: '1rem'
            }}>
              <button
                onClick={handleCreateNode}
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
                Add Node
              </button>
            </div>
          </div>
          
          <div style={{
            display: 'flex',
            gap: '2rem',
            alignItems: 'center',
            marginBottom: '1.5rem'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span style={{
                display: 'inline-block',
                width: '0.75rem',
                height: '0.75rem',
                borderRadius: '50%',
                backgroundColor: getStatusColor(project.status)
              }}></span>
              <span style={{
                fontSize: '1rem',
                color: '#6b7280',
                textTransform: 'capitalize'
              }}>
                {project.status}
              </span>
            </div>
            
            <div style={{
              fontSize: '1rem',
              color: '#6b7280'
            }}>
              Created: {formatDate(project.created_at)}
            </div>
            
            <div style={{
              fontSize: '1rem',
              color: '#6b7280'
            }}>
              Updated: {formatDate(project.updated_at)}
            </div>
            
            <div style={{
              fontSize: '1rem',
              color: '#6b7280'
            }}>
              {nodes.length} node{nodes.length !== 1 ? 's' : ''}
            </div>
          </div>
          
          {metadata.description && (
            <p style={{
              fontSize: '1.125rem',
              color: '#6b7280',
              marginBottom: '1.5rem',
              maxWidth: '800px'
            }}>
              {metadata.description}
            </p>
          )}
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e5e7eb',
          marginBottom: '2rem'
        }}>
          <button
            onClick={() => setActiveTab('hierarchy')}
            style={{
              padding: '1rem 1.5rem',
              backgroundColor: activeTab === 'hierarchy' ? 'white' : 'transparent',
              color: activeTab === 'hierarchy' ? '#111827' : '#6b7280',
              border: 'none',
              borderBottom: activeTab === 'hierarchy' ? '2px solid #3b82f6' : 'none',
              cursor: 'pointer',
              fontWeight: activeTab === 'hierarchy' ? '600' : '500',
              fontSize: '1rem'
            }}
          >
            Hierarchy View
          </button>
          <button
            onClick={() => setActiveTab('list')}
            style={{
              padding: '1rem 1.5rem',
              backgroundColor: activeTab === 'list' ? 'white' : 'transparent',
              color: activeTab === 'list' ? '#111827' : '#6b7280',
              border: 'none',
              borderBottom: activeTab === 'list' ? '2px solid #3b82f6' : 'none',
              cursor: 'pointer',
              fontWeight: activeTab === 'list' ? '600' : '500',
              fontSize: '1rem'
            }}
          >
            List View
          </button>
          <button
            onClick={() => setActiveTab('details')}
            style={{
              padding: '1rem 1.5rem',
              backgroundColor: activeTab === 'details' ? 'white' : 'transparent',
              color: activeTab === 'details' ? '#111827' : '#6b7280',
              border: 'none',
              borderBottom: activeTab === 'details' ? '2px solid #3b82f6' : 'none',
              cursor: 'pointer',
              fontWeight: activeTab === 'details' ? '600' : '500',
              fontSize: '1rem'
            }}
          >
            Project Details
          </button>
        </div>

        {/* Tab Content */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          padding: '2rem',
          minHeight: '400px'
        }}>
          {activeTab === 'hierarchy' && (
            <div>
              <NodeHierarchy 
                projectId={projectId}
                onNodeSelect={handleNodeSelect}
                selectedNodeId={selectedNodeId}
              />
            </div>
          )}
          
          {activeTab === 'list' && (
            <div>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: '#111827',
                marginBottom: '1.5rem'
              }}>
                All Nodes ({nodes.length})
              </h3>
              
              {nodes.length === 0 ? (
                <div style={{
                  padding: '3rem',
                  textAlign: 'center'
                }}>
                  <p style={{
                    fontSize: '1.125rem',
                    color: '#6b7280'
                  }}>
                    No nodes found in this project.
                  </p>
                  <button
                    onClick={handleCreateNode}
                    style={{
                      marginTop: '1rem',
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    Create First Node
                  </button>
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
                          Title
                        </th>
                        <th style={{
                          padding: '1rem',
                          textAlign: 'left',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          color: '#374151'
                        }}>
                          Type
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
                          Created
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {nodes.map((node) => (
                        <tr key={node.id} style={{
                          borderBottom: '1px solid #e5e7eb',
                          cursor: 'pointer'
                        }}
                        onClick={() => handleNodeSelect(node.id)}
                        >
                          <td style={{
                            padding: '1rem',
                            fontSize: '0.875rem',
                            color: '#111827',
                            fontWeight: '500'
                          }}>
                            {node.title}
                          </td>
                          <td style={{
                            padding: '1rem'
                          }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '0.25rem 0.75rem',
                              backgroundColor: node.type === 'task' ? '#3b82f6' : 
                                            node.type === 'note' ? '#10b981' : 
                                            node.type === 'issue' ? '#ef4444' : '#8b5cf6',
                              color: 'white',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: '500'
                            }}>
                              {node.type}
                            </span>
                          </td>
                          <td style={{
                            padding: '1rem'
                          }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '0.25rem 0.75rem',
                              backgroundColor: node.status === 'active' ? '#10b981' :
                                            node.status === 'completed' ? '#3b82f6' :
                                            node.status === 'pending' ? '#f59e0b' :
                                            '#6b7280',
                              color: 'white',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: '500'
                            }}>
                              {node.status}
                            </span>
                          </td>
                          <td style={{
                            padding: '1rem',
                            fontSize: '0.875rem',
                            color: '#6b7280'
                          }}>
                            {new Date(node.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'details' && (
            <div>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: '#111827',
                marginBottom: '1.5rem'
              }}>
                Project Details
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '1.5rem'
              }}>
                <div style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  padding: '1.5rem',
                  backgroundColor: '#f9fafb'
                }}>
                  <h4 style={{
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Basic Information
                  </h4>
                  <div style={{
                    fontSize: '0.875rem',
                    color: '#6b7280'
                  }}>
                    <div style={{ marginBottom: '0.5rem' }}>
                      <strong>ID:</strong> {project.id}
                    </div>
                    <div style={{ marginBottom: '0.5rem' }}>
                      <strong>Name:</strong> {project.name}
                    </div>
                    <div style={{ marginBottom: '0.5rem' }}>
                      <strong>Status:</strong> {project.status}
                    </div>
                    <div style={{ marginBottom: '0.5rem' }}>
                      <strong>Created:</strong> {formatDate(project.created_at)}
                    </div>
                    <div>
                      <strong>Updated:</strong> {formatDate(project.updated_at)}
                    </div>
                  </div>
                </div>
                
                {metadata && Object.keys(metadata).length > 0 && (
                  <div style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    padding: '1.5rem',
                    backgroundColor: '#f9fafb'
                  }}>
                    <h4 style={{
                      fontSize: '1rem',
                      fontWeight: '600',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Metadata
                    </h4>
                    <div style={{
                      fontSize: '0.875rem',
                      color: '#6b7280'
                    }}>
                      {Object.entries(metadata).map(([key, value]) => (
                        <div key={key} style={{ marginBottom: '0.5rem' }}>
                          <strong>{key}:</strong> {String(value)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
