'use client';

import { useState, useEffect } from 'react';
import { flowsApi } from '@/lib/api';

interface Flow {
  id: string;
  name: string;
  first_prompt: string;
  deepseek_system: string;
  repo: string;
  branch: string;
  max_iterations: number;
  steps: string;
  created_at: number;
}

export default function FlowsList() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentFlow, setCurrentFlow] = useState<Flow | null>(null);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    first_prompt: '',
    deepseek_system: '',
    repo: '',
    branch: 'main',
    max_iterations: 20,
    steps: '[]'
  });

  useEffect(() => {
    fetchFlows();
  }, []);

  const fetchFlows = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await flowsApi.getAll();
      setFlows(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch flows');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await flowsApi.create(formData);
      setShowCreateModal(false);
      resetForm();
      fetchFlows();
    } catch (err: any) {
      setError(err.message || 'Failed to create flow');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFlow) return;
    
    try {
      await flowsApi.update(currentFlow.id, formData);
      setShowEditModal(false);
      resetForm();
      fetchFlows();
    } catch (err: any) {
      setError(err.message || 'Failed to update flow');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this flow?')) return;
    
    try {
      await flowsApi.delete(id);
      fetchFlows();
    } catch (err: any) {
      setError(err.message || 'Failed to delete flow');
    }
  };

  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      first_prompt: '',
      deepseek_system: '',
      repo: '',
      branch: 'main',
      max_iterations: 20,
      steps: '[]'
    });
    setCurrentFlow(null);
  };

  const openEditModal = (flow: Flow) => {
    setCurrentFlow(flow);
    setFormData({
      id: flow.id,
      name: flow.name,
      first_prompt: flow.first_prompt,
      deepseek_system: flow.deepseek_system || '',
      repo: flow.repo,
      branch: flow.branch,
      max_iterations: flow.max_iterations,
      steps: flow.steps
    });
    setShowEditModal(true);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Flows</h1>
          <p className="text-gray-600">Manage your flow definitions</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          + Create Flow
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
          <button 
            onClick={fetchFlows}
            className="mt-2 text-sm text-red-600 hover:text-red-800"
          >
            Retry
          </button>
        </div>
      )}

      {flows.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-4">No flows found</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            Create your first flow
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Repository</th>
                <th>Branch</th>
                <th>Max Iterations</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {flows.map((flow) => (
                <tr key={flow.id}>
                  <td>
                    <div>
                      <p className="font-medium text-gray-800">{flow.name}</p>
                      <p className="text-xs text-gray-500 truncate max-w-xs">
                        {flow.first_prompt.substring(0, 50)}...
                      </p>
                    </div>
                  </td>
                  <td className="font-mono text-sm">{flow.repo}</td>
                  <td>{flow.branch}</td>
                  <td>{flow.max_iterations}</td>
                  <td>{formatDate(flow.created_at)}</td>
                  <td>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => openEditModal(flow)}
                        className="text-primary-600 hover:text-primary-800 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(flow.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Create New Flow</h2>
              <form onSubmit={handleCreate}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Flow ID
                    </label>
                    <input
                      type="text"
                      required
                      className="input"
                      value={formData.id}
                      onChange={(e) => setFormData({...formData, id: e.target.value})}
                      placeholder="e.g., test_flow_001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Flow Name
                    </label>
                    <input
                      type="text"
                      required
                      className="input"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="e.g., Test Flow"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Prompt
                    </label>
                    <textarea
                      required
                      className="input min-h-[100px]"
                      value={formData.first_prompt}
                      onChange={(e) => setFormData({...formData, first_prompt: e.target.value})}
                      placeholder="Enter the initial prompt for the flow"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Repository
                      </label>
                      <input
                        type="text"
                        required
                        className="input"
                        value={formData.repo}
                        onChange={(e) => setFormData({...formData, repo: e.target.value})}
                        placeholder="e.g., owner/repo"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Branch
                      </label>
                      <input
                        type="text"
                        className="input"
                        value={formData.branch}
                        onChange={(e) => setFormData({...formData, branch: e.target.value})}
                        placeholder="main"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Iterations
                    </label>
                    <input
                      type="number"
                      className="input"
                      value={formData.max_iterations}
                      onChange={(e) => setFormData({...formData, max_iterations: parseInt(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Steps (JSON)
                    </label>
                    <textarea
                      className="input min-h-[100px] font-mono text-sm"
                      value={formData.steps}
                      onChange={(e) => setFormData({...formData, steps: e.target.value})}
                      placeholder='[{"step": 1, "prompt": "..."}]'
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                  >
                    Create Flow
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && currentFlow && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Edit Flow</h2>
              <form onSubmit={handleUpdate}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Flow ID
                    </label>
                    <input
                      type="text"
                      required
                      disabled
                      className="input bg-gray-50"
                      value={formData.id}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Flow Name
                    </label>
                    <input
                      type="text"
                      required
                      className="input"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Prompt
                    </label>
                    <textarea
                      required
                      className="input min-h-[100px]"
                      value={formData.first_prompt}
                      onChange={(e) => setFormData({...formData, first_prompt: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Repository
                      </label>
                      <input
                        type="text"
                        required
                        className="input"
                        value={formData.repo}
                        onChange={(e) => setFormData({...formData, repo: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Branch
                      </label>
                      <input
                        type="text"
                        className="input"
                        value={formData.branch}
                        onChange={(e) => setFormData({...formData, branch: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Iterations
                    </label>
                    <input
                      type="number"
                      className="input"
                      value={formData.max_iterations}
                      onChange={(e) => setFormData({...formData, max_iterations: parseInt(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Steps (JSON)
                    </label>
                    <textarea
                      className="input min-h-[100px] font-mono text-sm"
                      value={formData.steps}
                      onChange={(e) => setFormData({...formData, steps: e.target.value})}
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                  >
                    Update Flow
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}