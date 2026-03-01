'use client';

import { useState, useEffect } from 'react';

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableType: string;
  data: any;
  onSave: (data: any) => Promise<void>;
}

export default function EditModal({ isOpen, onClose, tableType, data, onSave }: EditModalProps) {
  const [formData, setFormData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setFormData(data);
    }
  }, [data]);

  if (!isOpen) return null;

  const getFields = () => {
    switch (tableType) {
      case 'tasks':
        return [
          { key: 'id', label: 'ID', type: 'text', required: true },
          { key: 'title', label: 'Title', type: 'text', required: true },
          { key: 'description', label: 'Description', type: 'textarea' },
          { key: 'status', label: 'Status', type: 'select', options: ['pending', 'in_progress', 'done'] },
          { key: 'flow_id', label: 'Flow ID', type: 'text' },
          { key: 'order_index', label: 'Order', type: 'number' },
        ];
      case 'flows':
      case 'flow-definitions':
        return [
          { key: 'id', label: 'ID', type: 'text', required: true },
          { key: 'name', label: 'Name', type: 'text', required: true },
          { key: 'first_prompt', label: 'First Prompt', type: 'textarea' },
          { key: 'repo', label: 'Repository', type: 'text' },
          { key: 'branch', label: 'Branch', type: 'text' },
          { key: 'max_iterations', label: 'Max Iterations', type: 'number' },
        ];
      case 'steps':
        return [
          { key: 'id', label: 'ID', type: 'text', required: true },
          { key: 'flow_id', label: 'Flow ID', type: 'text', required: true },
          { key: 'step_number', label: 'Step Number', type: 'number', required: true },
          { key: 'prompt', label: 'Prompt', type: 'textarea', required: true },
        ];
      case 'conditions':
        return [
          { key: 'id', label: 'ID', type: 'text', required: true },
          { key: 'flow_id', label: 'Flow ID', type: 'text', required: true },
          { key: 'step_id', label: 'Step ID', type: 'text', required: true },
          { key: 'condition_type', label: 'Type', type: 'text', required: true },
          { key: 'condition_value', label: 'Value', type: 'text', required: true },
        ];
      default:
        return [];
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await onSave(formData);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save data');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      [key]: value,
    }));
  };

  const fields = getFields();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-800 capitalize">
              {data?.id ? 'Edit' : 'Create'} {tableType.replace('-', ' ').slice(0, -1)}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              {fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      value={formData[field.key] || ''}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      rows={3}
                      required={field.required}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      value={formData[field.key] || ''}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required={field.required}
                    >
                      <option value="">Select...</option>
                      {field.options?.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      value={formData[field.key] || ''}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required={field.required}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}