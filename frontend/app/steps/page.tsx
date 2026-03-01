'use client';

import DataTable from '@/components/DataTable';

export default function StepsPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Flow Steps Table</h1>
      <DataTable tableType="steps" />
    </div>
  );
}