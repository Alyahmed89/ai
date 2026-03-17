'use client';

import { useState, useEffect } from 'react';

interface Task {
  id: string;
  title: string | null;
  description: string | null;
  task_type: string | null;
  priority: string | null;
  status: string;
  flow_id: string | null;
  created_at: string;
  action: string | null;
}

interface TaskDetailsModalProps {
  task: Task | null;
  onClose: () => void;
}

export default function TaskDetailsModal({ task, onClose }: TaskDetailsModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskDetails, setTaskDetails] = useState<Task | null>(task);

  useEffect(() => {
    if (task) {
      setTaskDetails(task);
    }
  }, [task]);

  if (!taskDetails) {
    return null;
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'active':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'completed':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'failed':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getPriorityColor = (priority: string | null) => {
    if (!priority) return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    
    switch (priority.toLowerCase()) {
      case 'high':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'low':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-gray-800">
        {/* Modal header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-blue-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-200">Task Details</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal content */}
        <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-8rem)]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400">{error}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Task ID */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Task ID</label>
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 font-mono text-sm text-gray-300">
                  {taskDetails.id}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Title</label>
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-gray-200">
                  {taskDetails.title || 'No title'}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-gray-200 whitespace-pre-wrap">
                  {taskDetails.description || 'No description'}
                </div>
              </div>

              {/* Status and Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Status</label>
                  <div className={`px-3 py-2 rounded-lg border text-center font-medium ${getStatusColor(taskDetails.status)}`}>
                    {taskDetails.status || 'Unknown'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Priority</label>
                  <div className={`px-3 py-2 rounded-lg border text-center font-medium ${getPriorityColor(taskDetails.priority)}`}>
                    {taskDetails.priority || 'Not set'}
                  </div>
                </div>
              </div>

              {/* Task Type and Flow ID */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Task Type</label>
                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-gray-200">
                    {taskDetails.task_type || 'Not specified'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Flow ID</label>
                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-gray-200 font-mono text-sm">
                    {taskDetails.flow_id || 'No flow assigned'}
                  </div>
                </div>
              </div>

              {/* Action */}
              {taskDetails.action && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Action</label>
                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-gray-200 font-mono text-sm whitespace-pre-wrap">
                    {taskDetails.action}
                  </div>
                </div>
              )}

              {/* Created At */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Created At</label>
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-gray-200">
                  {formatDate(taskDetails.created_at)}
                </div>
              </div>

              {/* Raw JSON (for debugging) */}
              <div>
                <details className="border border-gray-800 rounded-lg overflow-hidden">
                  <summary className="px-4 py-3 bg-gray-800/50 text-gray-300 font-medium cursor-pointer hover:bg-gray-800/70 transition-colors">
                    Raw Task Data
                  </summary>
                  <div className="p-4 bg-gray-950">
                    <pre className="text-xs text-gray-400 overflow-x-auto">
                      {JSON.stringify(taskDetails, null, 2)}
                    </pre>
                  </div>
                </details>
              </div>
            </div>
          )}
        </div>

        {/* Modal footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}