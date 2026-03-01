'use client';

import { useState, useEffect } from 'react';
import { tasksApi, flowsApi } from '@/lib/api';

interface Task {
  id: string;
  flow_id: string;
  title: string;
  description: string;
  status: 'pending' | 'done';
  order_index: number;
  created_at: string;
}

interface Flow {
  id: string;
  name: string;
}

export default function TasksList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState({
    id: '',
    flow_id: '',
    title: '',
    description: '',
    status: 'pending' as 'pending' | 'done',
    order_index: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [tasksResponse, flowsResponse] = await Promise.all([
        tasksApi.getAll(),
        flowsApi.getAll()
      ]);
      
      setTasks(tasksResponse.data);
      setFlows(flowsResponse.data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await tasksApi.create(formData);
      setShowCreateModal(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to create task');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTask) return;
    
    try {
      await tasksApi.update(currentTask.id, formData);
      setShowEditModal(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to update task');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
      await tasksApi.delete(id);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete task');
    }
  };

  const handleStatusToggle = async (task: Task) => {
    try {
      const newStatus = task.status === 'pending' ? 'done' : 'pending';
      await tasksApi.update(task.id, { ...task, status: newStatus });
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to update task status');
    }
  };

  const resetForm = () => {
    setFormData({
      id: '',
      flow_id: '',
      title: '',
      description: '',
      status: 'pending',
      order_index: 0
    });
    setCurrentTask(null);
  };

  const openEditModal = (task: Task) => {
    setCurrentTask(task);
    setFormData({
      id: task.id,
      flow_id: task.flow_id,
      title: task.title,
      description: task.description || '',
      status: task.status,
      order_index: task.order_index
    });
    setShowEditModal(true);
  };

  const getFlowName = (flowId: string) => {
    const flow = flows.find(f => f.id === flowId);
    return flow ? flow.name : flowId;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
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
          <h1 className="text-2xl font-bold text-gray-800">Tasks</h1>
          <p className="text-gray-600">Manage your tasks</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          + Create Task
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
          <button 
            onClick={fetchData}
            className="mt-2 text-sm text-red-600 hover:text-red-800"
          >
            Retry
          </button>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-4">No tasks found</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            Create your first task
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Title</th>
                <th>Flow</th>
                <th>Order</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    <button
                      onClick={() => handleStatusToggle(task)}
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        task.status === 'done' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {task.status === 'done' ? '✅ Done' : '⏳ Pending'}
                    </button>
                  </td>
                  <td>
                    <div>
                      <p className="font-medium text-gray-800">{task.title}</p>
                      {task.description && (
                        <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                      )}
                    </div>
                  </td>
                  <td>{getFlowName(task.flow_id)}</td>
                  <td>{task.order_index}</td>
                  <td>{formatDate(task.created_at)}</td>
                  <td>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => openEditModal(task)}
                        className="text-primary-600 hover:text-primary-800 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(task.id)}
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
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Create New Task</h2>
              <form onSubmit={handleCreate}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Task ID
                    </label>
                    <input
                      type="text"
                      required
                      className="input"
                      value={formData.id}
                      onChange={(e) => setFormData({...formData, id: e.target.value})}
                      placeholder="e.g., task_001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Flow
                    </label>
                    <select
                      required
                      className="input"
                      value={formData.flow_id}
                      onChange={(e) => setFormData({...formData, flow_id: e.target.value})}
                    >
                      <option value="">Select a flow</option>
                      {flows.map((flow) => (
                        <option key={flow.id} value={flow.id}>
                          {flow.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      required
                      className="input"
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      placeholder="e.g., Initialize System"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      className="input min-h-[100px]"
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      placeholder="Task description..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Status
                      </label>
                      <select
                        className="input"
                        value={formData.status}
                        onChange={(e) => setFormData({...formData, status: e.target.value as 'pending' | 'done'})}
                      >
                        <option value="pending">Pending</option>
                        <option value="done">Done</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Order Index
                      </label>
                      <input
                        type="number"
                        className="input"
                        value={formData.order_index}
                        onChange={(e) => setFormData({...formData, order_index: parseInt(e.target.value)})}
                      />
                    </div>
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
                    Create Task
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && currentTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Edit Task</h2>
              <form onSubmit={handleUpdate}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Task ID
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
                      Flow
                    </label>
                    <select
                      required
                      className="input"
                      value={formData.flow_id}
                      onChange={(e) => setFormData({...formData, flow_id: e.target.value})}
                    >
                      <option value="">Select a flow</option>
                      {flows.map((flow) => (
                        <option key={flow.id} value={flow.id}>
                          {flow.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      required
                      className="input"
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      className="input min-h-[100px]"
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Status
                      </label>
                      <select
                        className="input"
                        value={formData.status}
                        onChange={(e) => setFormData({...formData, status: e.target.value as 'pending' | 'done'})}
                      >
                        <option value="pending">Pending</option>
                        <option value="done">Done</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Order Index
                      </label>
                      <input
                        type="number"
                        className="input"
                        value={formData.order_index}
                        onChange={(e) => setFormData({...formData, order_index: parseInt(e.target.value)})}
                      />
                    </div>
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
                    Update Task
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