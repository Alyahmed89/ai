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

interface SidebarProps {
  nodes: any[];
  currentNodeId: string;
  onSelectNode: (nodeId: string) => void;
}

export default function Sidebar({ nodes, currentNodeId, onSelectNode }: SidebarProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
          created_at: Date.now() / 1000 - 86400 * 7,
          updated_at: Date.now() / 1000 - 86400 * 2,
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
          created_at: Date.now() / 1000 - 86400 * 30,
          updated_at: Date.now() / 1000 - 86400 * 5,
          node_count: 3,
          flow_count: 1,
          task_count: 5,
          execution_count: 12
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'completed': return '#3b82f6';
      case 'archived': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const formatDate = (dateValue: string | number) => {
    if (typeof dateValue === 'number') {
      return new Date(dateValue * 1000).toLocaleDateString();
    }
    return new Date(dateValue).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="w-64 border-r border-gray-200 bg-white overflow-y-auto h-full">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Projects</h2>
          <p className="text-xs text-gray-500 mt-1">Loading projects...</p>
        </div>
        <div className="p-4 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-64 border-r border-gray-200 bg-white overflow-y-auto h-full">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Projects</h2>
          <p className="text-xs text-gray-500 mt-1">Error loading projects</p>
        </div>
        <div className="p-4">
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
            {error}
          </div>
          <button
            onClick={fetchProjects}
            className="mt-3 w-full px-3 py-2 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 border-r border-gray-200 bg-white overflow-y-auto h-full">
      <div className="p-4 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900">Projects</h2>
        <p className="text-xs text-gray-500 mt-1">{projects.length} project{projects.length !== 1 ? 's' : ''} available</p>
      </div>
      
      <div className="py-2">
        {projects.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No projects found. Create your first project!
          </div>
        ) : (
          projects.map((project) => (
            <div
              key={project.id}
              className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              onClick={() => {
                // For now, we'll navigate to the project details page
                // In the future, this could select the project and show its content
                window.location.href = `/projects`;
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: getStatusColor(project.status) }}
                    />
                    <h3 className="font-medium text-gray-900 truncate">
                      {project.name}
                    </h3>
                  </div>
                  
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
                    <span className="capitalize">{project.status}</span>
                    <span>•</span>
                    <span>{formatDate(project.created_at)}</span>
                  </div>
                  
                  {project.node_count !== undefined && (
                    <div className="flex items-center gap-4 mt-2">
                      <div className="text-xs text-gray-500">
                        <span className="font-medium">{project.node_count || 0}</span> nodes
                      </div>
                      {project.flow_count !== undefined && (
                        <div className="text-xs text-gray-500">
                          <span className="font-medium">{project.flow_count || 0}</span> flows
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="p-4 border-t border-gray-200">
        <a
          href="/projects"
          className="block w-full text-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
        >
          View All Projects
        </a>
        <a
          href="/projects"
          className="block w-full text-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors mt-2"
        >
          + Create New Project
        </a>
      </div>
    </div>
  );
}