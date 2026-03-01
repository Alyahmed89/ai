'use client';

import DataTable from '@/components/DataTable';

export default function FlowsPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Flows Table</h1>
      <DataTable tableType="flows" />
    </div>
  );
}