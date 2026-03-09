'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import TopBar from '@/app/components/TopBar';
import MainCanvas from '@/app/components/MainCanvas';
import Sidebar from '@/app/components/Sidebar';

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

export default function Home() {
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
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      try {
        const response = await fetch('https://deepseek-agent.alghamdimo89.workers.dev/graph/projects?limit=50', {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
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
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        throw fetchErr;
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to load projects: ${errorMessage}. Showing sample data.`);
      
      // Fallback to mock data if API fails
      setProjects([
        {
          id: '1',
          name: 'Sample Project 1',
          status: 'active',
          metadata: '{"description": "This is a sample project for demonstration"}',
          created_at: Date.now() / 1000 - 86400 * 7, // 7 days ago
          updated_at: Date.now() / 1000 - 86400 * 2, // 2 days ago
          node_count: 5,
          flow_count: 2,
          task_count: 10,
          execution_count: 25
        },
        {
          id: '2',
          name: 'Sample Project 2',
          status: 'completed',
          metadata: '{"description": "A completed project example"}',
          created_at: Date.now() / 1000 - 86400 * 30, // 30 days ago
          updated_at: Date.now() / 1000 - 86400 * 5, // 5 days ago
          node_count: 3,
          flow_count: 1,
          task_count: 5,
          execution_count: 12
        },
        {
          id: '3',
          name: 'Archived Project',
          status: 'archived',
          metadata: '{"description": "An archived project"}',
          created_at: Date.now() / 1000 - 86400 * 60, // 60 days ago
          updated_at: Date.now() / 1000 - 86400 * 30, // 30 days ago
          node_count: 8,
          flow_count: 3,
          task_count: 15,
          execution_count: 40
        }
      ]);
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
      return new Date(dateValue * 1000).toLocaleDateString();
    }
    return new Date(dateValue).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'completed': return '#3b82f6';
      case 'archived': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const handleNewNode = () => {
    setShowCreateForm(true);
  };

  const handleNavigateBreadcrumb = () => {
    // Not used in this version, but kept for compatibility
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopBar
        projectName="Flowruns"
        breadcrumbs={[]}
        onNewNode={handleNewNode}
        onNavigateBreadcrumb={handleNavigateBreadcrumb}
      />
      
      <div className="flex flex-1">
        <Sidebar
          nodes={[]}
          currentNodeId=""
          onSelectNode={() => {}}
        />
        <MainCanvas>
          <div className="p-6">
            {/* Header */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Projects Dashboard</h1>
                  <p className="text-gray-600 mt-1">
                    {projects.length} project{projects.length !== 1 ? 's' : ''} found
                  </p>
                </div>
                <div className="flex gap-3">
                  <a
                    href="/flows"
                    className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md text-sm font-medium transition-colors"
                  >
                    View Flows
                  </a>
                  <a
                    href="/tasks"
                    className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md text-sm font-medium transition-colors"
                  >
                    View Tasks
                  </a>
                </div>
              </div>
              
              {/* Create Project Button */}
              <div className="mt-4">
                <button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-md text-sm font-medium flex items-center gap-2 transition-colors"
                >
                  <span>+</span>
                  Create New Project
                </button>
              </div>
            </div>

            {/* Create Project Form */}
            {showCreateForm && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Project</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Project Name
                    </label>
                    <input
                      type="text"
                      value={newProject.name}
                      onChange={(e) => setNewProject({...newProject, name: e.target.value})}
                      placeholder="Enter project name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      value={newProject.status}
                      onChange={(e) => setNewProject({...newProject, status: e.target.value as 'active' | 'archived' | 'completed'})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Metadata (JSON)
                    </label>
                    <textarea
                      value={newProject.metadata}
                      onChange={(e) => setNewProject({...newProject, metadata: e.target.value})}
                      placeholder='{"description": "Project description"}'
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    />
                  </div>
                  
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setShowCreateForm(false)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md text-sm font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateProject}
                      className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md text-sm font-medium"
                    >
                      Create Project
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                      <span className="text-red-600 font-bold">!</span>
                    </div>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error Loading Projects</h3>
                    <div className="mt-1 text-sm text-red-700">
                      {error}
                    </div>
                    <button
                      onClick={fetchProjects}
                      className="mt-2 px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded text-sm font-medium"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Projects Grid */}
            {projects.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
                <p className="text-gray-600 mb-4">Create your first project to get started</p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md text-sm font-medium"
                >
                  + Create Project
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((project) => {
                  const metadata = parseMetadata(project.metadata);
                  return (
                    <div
                      key={project.id}
                      className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                    >
                      <div className="p-5">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: getStatusColor(project.status) }}
                            />
                            <h3 className="font-semibold text-gray-900 truncate">
                              {project.name}
                            </h3>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleUpdateProject(project.id, { status: project.status === 'active' ? 'archived' : 'active' })}
                              className="p-1 text-gray-400 hover:text-gray-600"
                              title={project.status === 'active' ? 'Archive' : 'Activate'}
                            >
                              {project.status === 'active' ? '📁' : '↻'}
                            </button>
                            <button
                              onClick={() => handleDeleteProject(project.id)}
                              className="p-1 text-gray-400 hover:text-red-600"
                              title="Delete"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                        
                        {metadata.description && (
                          <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                            {metadata.description}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                          <span className="capitalize px-2 py-1 bg-gray-100 rounded">
                            {project.status}
                          </span>
                          <span>Created: {formatDate(project.created_at)}</span>
                        </div>
                        
                        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                          <div className="flex items-center gap-4">
                            <div className="text-sm text-gray-600">
                              <span className="font-medium">{project.node_count || 0}</span> nodes
                            </div>
                            {project.flow_count !== undefined && (
                              <div className="text-sm text-gray-600">
                                <span className="font-medium">{project.flow_count || 0}</span> flows
                              </div>
                            )}
                          </div>
                          <a
                            href={`/projects`}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                          >
                            View Details →
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </MainCanvas>
      </div>
    </div>
  );
}