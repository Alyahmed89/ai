'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
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
  const searchParams = useSearchParams();
  const [selectedTable, setSelectedTable] = useState<TableType>('tasks');

  useEffect(() => {
    const tableParam = searchParams.get('table') as TableType;
    if (tableParam && tableOptions.some(option => option.value === tableParam)) {
      setSelectedTable(tableParam);
    }
  }, [searchParams]);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Data Tables</h1>
      
      <div className="mb-4">
        <div className="flex flex-wrap gap-1">
          {tableOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedTable(option.value)}
              className={`px-3 py-1 rounded text-sm ${
                selectedTable === option.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
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