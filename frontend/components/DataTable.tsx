'use client';

import { useState, useEffect } from 'react';
import { tasksApi, flowsApi, flowConditionsApi, flowStepsApi } from '@/lib/api';
import EditModal from './EditModal';

type TableType = 'tasks' | 'flows' | 'steps' | 'conditions' | 'flow-definitions';

interface DataTableProps {
  tableType: TableType;
}

interface TableColumn {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
}

export default function DataTable({ tableType }: DataTableProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingData, setEditingData] = useState<any>(null);
  
  // Define columns for each table type
  const getColumns = (): TableColumn[] => {
    switch (tableType) {
      case 'tasks':
        return [
          { key: 'id', label: 'ID' },
          { key: 'title', label: 'Title' },
          { key: 'description', label: 'Description' },
          { key: 'status', label: 'Status', render: (value) => (
            <span className={`px-2 py-1 rounded text-xs ${
              value === 'done' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }`}>
              {value}
            </span>
          )},
          { key: 'flow_id', label: 'Flow ID' },
          { key: 'order_index', label: 'Order' },
          { key: 'created_at', label: 'Created', render: (value) => new Date(value).toLocaleDateString() }
        ];
        
      case 'flows':
        return [
          { key: 'id', label: 'ID' },
          { key: 'name', label: 'Name' },
          { key: 'repo', label: 'Repository' },
          { key: 'branch', label: 'Branch' },
          { key: 'max_iterations', label: 'Max Iterations' },
          { key: 'created_at', label: 'Created', render: (value) => {
            // Handle both timestamp and date string
            const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
            return date.toLocaleDateString();
          }}
        ];
        
      case 'steps':
        return [
          { key: 'id', label: 'ID' },
          { key: 'flow_id', label: 'Flow ID' },
          { key: 'step_number', label: 'Step Number' },
          { key: 'prompt', label: 'Prompt', render: (value) => (
            <div className="max-w-xs truncate">{value}</div>
          )},
          { key: 'created_at', label: 'Created', render: (value) => new Date(value).toLocaleDateString() }
        ];
        
      case 'conditions':
        return [
          { key: 'id', label: 'ID' },
          { key: 'flow_id', label: 'Flow ID' },
          { key: 'step_id', label: 'Step ID' },
          { key: 'condition_type', label: 'Type' },
          { key: 'condition_value', label: 'Value' },
          { key: 'created_at', label: 'Created', render: (value) => new Date(value).toLocaleDateString() }
        ];
        
      case 'flow-definitions':
        return [
          { key: 'id', label: 'ID' },
          { key: 'name', label: 'Name' },
          { key: 'first_prompt', label: 'First Prompt', render: (value) => (
            <div className="max-w-xs truncate">{value}</div>
          )},
          { key: 'repo', label: 'Repository' },
          { key: 'branch', label: 'Branch' },
          { key: 'max_iterations', label: 'Max Iterations' },
          { key: 'created_at', label: 'Created', render: (value) => {
            const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
            return date.toLocaleDateString();
          }}
        ];
        
      default:
        return [];
    }
  };
  
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let response;
      switch (tableType) {
        case 'tasks':
          response = await tasksApi.getAll();
          break;
        case 'flows':
        case 'flow-definitions':
          response = await flowsApi.getAll();
          break;
        case 'conditions':
          response = await flowConditionsApi.getAll();
          break;
        case 'steps':
          response = await flowStepsApi.getAll();
          break;
        default:
          setData([]);
          setLoading(false);
          return;
      }
      
      setData(response.data || []);
    } catch (err: any) {
      setError(err.message || `Failed to fetch ${tableType}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handleEdit = (row: any) => {
    setEditingData(row);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setEditingData(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) {
      return;
    }

    try {
      switch (tableType) {
        case 'tasks':
          await tasksApi.delete(id);
          break;
        case 'flows':
        case 'flow-definitions':
          await flowsApi.delete(id);
          break;
        case 'conditions':
          await flowConditionsApi.delete(id);
          break;
        case 'steps':
          await flowStepsApi.delete(id);
          break;
      }
      
      // Refresh data
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete item');
    }
  };

  const handleSave = async (formData: any) => {
    try {
      if (formData.id && editingData) {
        // Update existing
        switch (tableType) {
          case 'tasks':
            await tasksApi.update(formData.id, formData);
            break;
          case 'flows':
          case 'flow-definitions':
            await flowsApi.update(formData.id, formData);
            break;
          case 'conditions':
            await flowConditionsApi.update(formData.id, formData);
            break;
          case 'steps':
            await flowStepsApi.update(formData.id, formData);
            break;
        }
      } else {
        // Create new
        switch (tableType) {
          case 'tasks':
            await tasksApi.create(formData);
            break;
          case 'flows':
          case 'flow-definitions':
            await flowsApi.create(formData);
            break;
          case 'conditions':
            await flowConditionsApi.create(formData);
            break;
          case 'steps':
            await flowStepsApi.create(formData);
            break;
        }
      }
      
      // Refresh data
      fetchData();
    } catch (err: any) {
      throw new Error(err.message || 'Failed to save data');
    }
  };

  useEffect(() => {
    fetchData();
  }, [tableType]);
  
  const columns = getColumns();
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700">{error}</p>
        <button 
          onClick={fetchData}
          className="mt-2 text-sm text-red-600 hover:text-red-800"
        >
          Retry
        </button>
      </div>
    );
  }
  
  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 capitalize">
            {tableType.replace('-', ' ')}
          </h2>
          <p className="text-sm text-gray-600">
            {data.length} {tableType.replace('-', ' ')} found
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="btn btn-primary"
        >
          + Create New
        </button>
      </div>
      
      {data.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-gray-500">No {tableType.replace('-', ' ')} found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table min-w-full">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {column.label}
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.map((row, rowIndex) => (
                <tr key={row.id || rowIndex} className="hover:bg-gray-50">
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-3 text-sm">
                      {column.render 
                        ? column.render(row[column.key], row)
                        : row[column.key] || '-'
                      }
                    </td>
                  ))}
                  <td className="px-4 py-3 text-sm">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(row)}
                        className="text-primary-600 hover:text-primary-800 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(row.id)}
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
      
      <EditModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        tableType={tableType}
        data={editingData}
        onSave={handleSave}
      />
    </div>
  );
}