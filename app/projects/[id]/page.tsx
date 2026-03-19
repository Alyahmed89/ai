'use client';

export const runtime = 'edge';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface Project {
  id: string;
  name: string;
  status: string;
  created_at: number;
  updated_at: number;
  metadata: string;
  deleted_at: number | null;
}

interface Command {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, any>;
  created_at: number;
  updated_at: number;
}

function ProjectDetailsContent() {
  const params = useParams();
  const projectId = params.id as string;
  
  const [project, setProject] = useState<Project | null>(null);
  const [commands, setCommands] = useState<Command[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projectId) {
      fetchProjectDetails();
      fetchProjectCommands();
    }
  }, [projectId]);

  const fetchProjectDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/proxy/graph/projects/${projectId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch project: ${response.status} ${response.statusText}`);
      }
      const result = await response.json();
      if (result.success && result.data) {
        setProject(result.data);
      } else {
        throw new Error(result.error || 'Invalid response format');
      }
    } catch (err) {
      console.error('Error fetching project:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectCommands = async () => {
    try {
      const response = await fetch(`/api/proxy/api/commands?project_id=${projectId}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data && result.data.commands) {
          setCommands(result.data.commands);
        }
      }
    } catch (err) {
      console.error('Error fetching commands:', err);
      // Don't set error for commands - they might not exist yet
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading project</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">Project not found</h3>
        <p className="mt-1 text-sm text-gray-500">The project you're looking for doesn't exist.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <a href="/projects" className="inline-flex items-center text-blue-600 hover:text-blue-500 mb-4">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Projects
        </a>
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
          <div className="flex space-x-3">
            <button
              onClick={fetchProjectDetails}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Project Details</h2>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Project ID</dt>
                <dd className="mt-1 text-sm text-gray-900 font-mono">{project.id}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    project.status === 'active' ? 'bg-green-100 text-green-800' :
                    project.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {project.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Created</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(project.created_at * 1000).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(project.updated_at * 1000).toLocaleString()}
                </dd>
              </div>
              {project.metadata && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Metadata</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    <pre className="bg-gray-50 p-3 rounded-md overflow-auto text-xs">
                      {JSON.stringify(JSON.parse(project.metadata), null, 2)}
                    </pre>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Commands Section */}
          <div className="mt-6 bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Commands</h2>
              <button
                onClick={fetchProjectCommands}
                className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Refresh Commands
              </button>
            </div>
            
            {commands.length === 0 ? (
              <div className="text-center py-8">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No commands found</h3>
                <p className="mt-1 text-sm text-gray-500">This project doesn't have any commands yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {commands.map((command) => (
                  <div key={command.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          <a href={`/commands/${command.name}`} className="text-blue-600 hover:text-blue-500">
                            {command.name}
                          </a>
                        </h3>
                        <p className="mt-1 text-sm text-gray-600">{command.description}</p>
                      </div>
                      <a
                        href={`/commands/${command.name}`}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
                      >
                        View Details
                      </a>
                    </div>
                    {command.parameters && Object.keys(command.parameters).length > 0 && (
                      <div className="mt-3">
                        <h4 className="text-sm font-medium text-gray-700 mb-1">Parameters:</h4>
                        <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto">
                          {JSON.stringify(command.parameters, null, 2)}
                        </pre>
                      </div>
                    )}
                    <div className="mt-3 text-xs text-gray-500">
                      Created: {new Date(command.created_at * 1000).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <a
                href="/chat"
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Go to Chat
              </a>
              <button
                onClick={() => alert('This feature is not implemented yet')}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add New Command
              </button>
              <button
                onClick={() => alert('This feature is not implemented yet')}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Project
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProjectDetailsPage() {
  return <ProjectDetailsContent />;
}