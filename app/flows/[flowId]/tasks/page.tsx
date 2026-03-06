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
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'done': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTaskTypeColor = (taskType: string) => {
    switch (taskType.toLowerCase()) {
      case 'implementation': return 'bg-purple-100 text-purple-800';
      case 'validation': return 'bg-indigo-100 text-indigo-800';
      case 'testing': return 'bg-pink-100 text-pink-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-lg text-gray-600">Loading tasks for flow {flowId}...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <h2 className="text-xl font-semibold text-red-800 mb-2">Error Loading Tasks</h2>
            <p className="text-red-600">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Tasks for Flow: {flowId}</h1>
          <p className="text-gray-600">
            {tasks.length === 0 ? 'No tasks found' : `Showing ${tasks.length} task${tasks.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {tasks.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 text-lg">No tasks found for this flow.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tasks.map((task) => (
              <div 
                key={task.id} 
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">{task.title}</h3>
                  <div className="flex flex-wrap gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                      {task.status}
                    </span>
                  </div>
                </div>
                
                {task.description && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3">{task.description}</p>
                )}
                
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTaskTypeColor(task.task_type)}`}>
                      {task.task_type}
                    </span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {task.estimated_complexity}
                    </span>
                  </div>
                  
                  {task.endpoint_path && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-700">Endpoint:</span>
                      <code className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                        {task.http_method} {task.endpoint_path}
                      </code>
                    </div>
                  )}
                  
                  <div className="text-xs text-gray-500">
                    Created: {new Date(task.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-sm text-gray-600">High Priority</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span className="text-sm text-gray-600">Medium Priority</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-sm text-gray-600">Low Priority</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-sm text-gray-600">In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500"></div>
              <span className="text-sm text-gray-600">Implementation</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
              <span className="text-sm text-gray-600">Validation</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}