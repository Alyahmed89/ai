'use client';

import { useParams } from 'next/navigation';

export default function StepPage() {
  const params = useParams();
  const stepId = params.id as string;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">
            Step {stepId === 'new' ? 'Create New' : `ID: ${stepId}`}
          </h1>
          <p className="text-gray-600 mt-2">Step detail page - empty state</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-gray-500 mb-4">Step detail component will be added here</p>
          <p className="text-sm text-gray-400">Components will be built one at a time</p>
        </div>
      </div>
    </div>
  );
}