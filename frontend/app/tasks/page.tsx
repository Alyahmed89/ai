'use client';

import DataTable from '@/components/DataTable';

export default function TasksPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Tasks Table</h1>
      <DataTable tableType="tasks" />
    </div>
  );
}