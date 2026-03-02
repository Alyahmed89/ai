'use client';

import { useEffect, useState } from 'react';
import StepHeader from '@/components/StepHeader';
import StepInputSection from '@/components/StepInputSection';
import StepConditionsSection from '@/components/StepConditionsSection';
import { flowStepsApi } from '@/lib/api';

interface FlowStep {
  id: string;
  flow_id: string;
  step_key: string;
  title: string;
  step_type: string;
  order_index: number;
  input_keys: string | null;
  payload_template: string | null;
  created_at: string;
  updated_at: string;
  instructions?: string;
  page_key?: string | null;
  blocking?: number;
  auto_fail_on_error?: number;
  retryable?: number;
  task_id?: string | null;
  output_keys?: string | null;
  output_url?: string | null;
  output_payload_template?: string | null;
  default_next_step?: number | null;
  output_auth_token?: string | null;
  output?: number;
}

interface Condition {
  id: string;
  flow_step_id: string;
  condition_type: string;
  condition_value: string;
  condition_operator?: string | null;
  next_step?: number | null;
  created_at?: string | number;
  updated_at?: string | number;
}

export default function StepsPage() {
  const [steps, setSteps] = useState<FlowStep[]>([]);
  const [conditions, setConditions] = useState<Record<string, Condition[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSteps();
  }, []);

  const fetchSteps = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await flowStepsApi.getAll();
      const stepsData = response.data;
      setSteps(stepsData);

      // Fetch conditions for each step
      const conditionsMap: Record<string, Condition[]> = {};
      for (const step of stepsData) {
        try {
          const conditionsResponse = await fetch(`/api/step-conditions?stepId=${step.id}`);
          if (conditionsResponse.ok) {
            const data = await conditionsResponse.json();
            conditionsMap[step.id] = data.data || [];
          }
        } catch (err) {
          console.error(`Error fetching conditions for step ${step.id}:`, err);
          conditionsMap[step.id] = [];
        }
      }
      setConditions(conditionsMap);
    } catch (err) {
      console.error('Error fetching steps:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch steps');
    } finally {
      setLoading(false);
    }
  };

  const parseInputKeys = (inputKeysString: string | null): string[] => {
    try {
      if (!inputKeysString) return [];
      
      // Try to parse as JSON
      const parsed = JSON.parse(inputKeysString);
      
      // If it's an array of objects with 'key' property
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0].key) {
        return parsed.map(item => item.key).filter(Boolean);
      }
      
      // If it's an array of strings
      if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
        return parsed;
      }
      
      // If it's a single string or other format
      return [];
    } catch {
      // If not valid JSON, try comma-separated
      if (typeof inputKeysString === 'string') {
        return inputKeysString.split(',').map(key => key.trim()).filter(Boolean);
      }
      return [];
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Steps</h1>
          <p className="text-gray-600 mt-2">Manage and view all flow steps</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mx-auto mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Steps</h1>
          <p className="text-gray-600 mt-2">Manage and view all flow steps</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Steps</h3>
          <p className="text-red-700">{error}</p>
          <button
            onClick={fetchSteps}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Steps</h1>
        <p className="text-gray-600 mt-2">Manage and view all flow steps</p>
        <div className="mt-4 flex items-center gap-4">
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
            {steps.length} step{steps.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={fetchSteps}
            className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {steps.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-gray-500 mb-4">No steps found in the database</p>
          <p className="text-sm text-gray-400">Add steps to see them here</p>
        </div>
      ) : (
        <div className="space-y-8">
          {steps.map((step) => (
            <div key={step.id} className="border border-gray-200 rounded-lg p-6 bg-white">
              {/* COMPONENT 1: Step Header */}
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">
                  Step: {step.step_key}
                </h2>
                <StepHeader
                  title={step.title}
                  stepType={step.step_type}
                  orderIndex={step.order_index}
                  stepKey={step.step_key}
                  flowId={step.flow_id}
                />
              </div>

              {/* COMPONENT 2: Input Section */}
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">
                  Input Section
                </h2>
                <StepInputSection
                  inputKeys={parseInputKeys(step.input_keys)}
                  payloadTemplate={step.payload_template}
                />
              </div>

              {/* COMPONENT 3: Conditions Section */}
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">
                  Conditions Section
                </h2>
                <StepConditionsSection
                  conditions={conditions[step.id] || []}
                  stepId={step.id}
                />
              </div>

              {/* Step Metadata */}
              <div className="mt-6 pt-6 border-t border-gray-100">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Step ID:</span> {step.id}
                  </div>
                  <div>
                    <span className="font-medium">Created:</span>{' '}
                    {new Date(step.created_at).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="font-medium">Updated:</span>{' '}
                    {new Date(step.updated_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}