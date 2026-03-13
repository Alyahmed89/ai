'use client';

import { useState, useEffect } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface Project {
  id: string;
  name: string;
  status: string;
  created_at: number;
  updated_at: number;
  metadata: string;
  deleted_at: number | null;
}

function ProjectsContent() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only fetch on client side
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/projects');
      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.status} ${response.statusText}`);
      }
      const result = await response.json();
      // The API returns {success: true, data: [...], error: null, statusCode: 200}
      if (result.success && result.data) {
        setProjects(result.data);
      } else {
        throw new Error(result.error || 'Invalid response format');
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const startDocCommentFlowWithForm = async () => {
    try {
      const button = document.getElementById('start-doc-comment-flow-btn') as HTMLButtonElement;
      if (button) {
        button.disabled = true;
        button.textContent = 'Starting Flow...';
      }
      
      const comment = (document.getElementById('comment') as HTMLTextAreaElement)?.value;
      const scope = (document.getElementById('scope') as HTMLInputElement)?.value;
      const tags = (document.getElementById('tags') as HTMLInputElement)?.value.split(',').map(t => t.trim()).filter(t => t);
      
      const response = await fetch('/api/start-flow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flow_id: 'doc-comment',
          comment: {
            text: comment,
            scope: scope,
            tags: tags
          }
        }),
      });
      
      if (response.ok) {
        alert('Flow started successfully! Check Flow Runs for progress.');
      } else {
        throw new Error('Failed to start flow');
      }
    } catch (err) {
      alert('Error starting flow: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      const button = document.getElementById('start-doc-comment-flow-btn') as HTMLButtonElement;
      if (button) {
        button.disabled = false;
        button.textContent = 'Start doc-comment Flow';
      }
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
            <h3 className="text-sm font-medium text-red-800">Error loading projects</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
        <button
          onClick={fetchProjects}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Refresh
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No projects</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new project.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <div key={project.id} className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-md bg-blue-500 flex items-center justify-center">
                      <span className="text-white font-bold">{project.name.charAt(0)}</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">{project.name}</h3>
                    <p className="text-sm text-gray-500">ID: {project.id}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex items-center">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      project.status === 'active' ? 'bg-green-100 text-green-800' :
                      project.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {project.status}
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex justify-between text-sm text-gray-500">
                  <span>Created: {new Date(project.created_at * 1000).toLocaleDateString()}</span>
                  <span>Updated: {new Date(project.updated_at * 1000).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="bg-gray-50 px-5 py-3">
                <div className="text-sm">
                  <a href={`/projects/${project.id}`} className="font-medium text-blue-600 hover:text-blue-500">
                    View details
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Start Documentation Comment Box */}
      <div className="mt-12 bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Start Documentation Comment Flow</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="comment" className="block text-sm font-medium text-gray-700">
              Comment
            </label>
            <textarea
              id="comment"
              name="comment"
              rows={3}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Enter your documentation comment here..."
              defaultValue="Add proper JSDoc comments to all functions in the utils module"
            />
          </div>
          <div>
            <label htmlFor="scope" className="block text-sm font-medium text-gray-700">
              Scope
            </label>
            <input
              type="text"
              id="scope"
              name="scope"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="e.g., utils, api, components"
              defaultValue="utils"
            />
          </div>
          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-gray-700">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              id="tags"
              name="tags"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="e.g., documentation, jsdoc, refactor"
              defaultValue="documentation,jsdoc"
            />
          </div>
          <div className="flex justify-end">
            <button
              id="start-doc-comment-flow-btn"
              type="button"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={startDocCommentFlowWithForm}
            >
              Start doc-comment Flow
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  return <ProjectsContent />;
}