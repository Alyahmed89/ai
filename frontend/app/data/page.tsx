'use client';

import { useState } from 'react';
import DataTable from '@/components/DataTable';

type TableType = 'tasks' | 'flows' | 'steps' | 'conditions' | 'flow-definitions';

const tableOptions: { value: TableType; label: string }[] = [
  { value: 'tasks', label: 'Tasks' },
  { value: 'flows', label: 'Flows' },
  { value: 'steps', label: 'Steps' },
  { value: 'conditions', label: 'Conditions' },
  { value: 'flow-definitions', label: 'Flow Definitions' },
];

export default function DataPage() {
  const [selectedTable, setSelectedTable] = useState<TableType>('tasks');

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Data Tables</h1>
        <p className="text-gray-600 mt-2">View and manage all data tables</p>
      </div>

      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          {tableOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedTable(option.value)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                selectedTable === option.value
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <DataTable tableType={selectedTable} />
    </div>
  );
}