'use client';

import { useState, useCallback, useRef, useEffect, DragEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ReactFlow,
  Node,
  Edge,
  Connection,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  useReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  EdgeProps,
  ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// Import existing flow management components
import EditFlowModal from '../../../../components/EditFlowModal';
import SimpleFlowCreator from '../../../../components/SimpleFlowCreator';

// Step data structure - matches backend FlowStep
interface Step {
  id: string;
  flow_id: string;
  step_key: string;
  title: string;
  instructions: string;
  step_type: string;
  order_index: number;
  blocking: number;
  auto_fail_on_error: number;
  retryable: number;
  created_at: string;
  updated_at: string;
  task_id: string | null;
  output_keys: string;
  output_url: string | null;
  output_payload_template: string | null;
  default_next_step: string | null;
  output_auth_token: string | null;
  input_keys: string;
  output: number;
  default_next_step_id: string | null;
  step_number: number;
  requires_task: number;
  // Additional fields for UI
  description?: string;
  type?: 'input' | 'default' | 'output';
  command?: string;
  await_input?: boolean;
  variables?: string[];
}

// Flow definition interface - matches backend
interface FlowDefinition {
  id: string;
  name: string;
  description: string;
  max_iterations: number;
  repository: string;
  branch: string;
  created_at: string;
  updated_at: string;
  next_flow_id: string | null;
  priority: number;
  agent: string;
  system_message?: string;
}

// Edge data structure with conditions
interface EdgeData extends Record<string, any> {
  condition: {
    source: string;
    operator: string;
    value?: any;
  };
  route: {
    type: 'step' | 'flow' | 'end';
    target_id: string;
    context_preservation?: 'full' | 'partial' | 'none';
  };
}

// Extended Edge type
type CustomEdge = Edge<EdgeData>;

// Custom node component for dark mode with enhanced visual indicators
const CustomNode = ({ data, onClick }: { data: any; onClick?: (nodeId: string) => void }) => {
  const step = data.step as Step;
  const hasCommand = data.command && data.command.trim().length > 0;
  const hasVariables = step.output_keys && step.output_keys.trim().length > 0;
  const hasInput = step.input_keys && step.input_keys.trim().length > 0;
  const hasOutput = step.output_keys && step.output_keys.trim().length > 0;
  const awaitInput = data.await_input === true;
  
  // Determine node colors based on type
  let bgColor = '#1f2937'; // default
  let borderColor = '#374151'; // default
  let textColor = '#f9fafb'; // default
  
  if (step.type === 'input') {
    bgColor = '#064e3b'; // dark green
    borderColor = '#047857'; // green
  } else if (step.type === 'output') {
    bgColor = '#7f1d1d'; // dark red
    borderColor = '#dc2626'; // red
  }
  
  return (
    <div 
      className="px-4 py-3 rounded-lg shadow-lg border cursor-pointer hover:shadow-xl transition-shadow"
      style={{
        backgroundColor: bgColor,
        borderColor: borderColor,
        borderWidth: '2px',
        color: textColor,
        minWidth: '220px',
        maxWidth: '280px',
      }}
      onClick={() => {
        console.log('Node clicked:', step.id, step);
        if (onClick) {
          onClick(step.id);
        }
      }}
    >
      <Handle 
        type="target" 
        position={Position.Top} 
        style={{ 
          background: '#3b82f6',
          borderColor: '#1e40af',
          borderWidth: '2px',
          width: '10px',
          height: '10px',
        }} 
      />
      
      {/* Node header with title and indicators */}
      <div className="flex justify-between items-start mb-2">
        <div className="font-medium text-sm truncate">{step.title}</div>
        <div className="flex items-center space-x-1 ml-2">
          {awaitInput && (
            <span className="text-xs bg-yellow-900 text-yellow-200 px-1.5 py-0.5 rounded" title="Awaits user input">
              ⏳
            </span>
          )}
          {hasCommand && (
            <span className="text-xs bg-blue-900 text-blue-200 px-1.5 py-0.5 rounded" title="Has command">
              ⚡
            </span>
          )}
          {hasVariables && (
            <span className="text-xs bg-purple-900 text-purple-200 px-1.5 py-0.5 rounded" title="Has variables">
              📦
            </span>
          )}
        </div>
      </div>
      
      {/* Step description */}
      {step.description && (
        <div className="text-xs text-gray-300 mt-1 mb-2 line-clamp-2">{step.description}</div>
      )}
      
      {/* I/O indicators */}
      <div className="flex flex-wrap gap-1 mt-2">
        {hasInput && (
          <span className="text-xs bg-green-900/50 text-green-300 px-2 py-0.5 rounded border border-green-800">
            Input: {step.input_keys.split(',').length > 3 ? 
              `${step.input_keys.split(',').slice(0, 3).join(',')}...` : 
              step.input_keys}
          </span>
        )}
        {hasOutput && (
          <span className="text-xs bg-red-900/50 text-red-300 px-2 py-0.5 rounded border border-red-800">
            Output: {step.output_keys.split(',').length > 3 ? 
              `${step.output_keys.split(',').slice(0, 3).join(',')}...` : 
              step.output_keys}
          </span>
        )}
      </div>
      
      {/* Variables preview (from output_keys) */}
      {hasOutput && step.output_keys && (
        <div className="mt-2 pt-2 border-t border-gray-700">
          <div className="text-xs text-gray-400 mb-1">Variables:</div>
          <div className="flex flex-wrap gap-1">
            {step.output_keys.split(',').slice(0, 3).map((variable: string, index: number) => (
              <span key={index} className="text-xs bg-purple-900/30 text-purple-300 px-1.5 py-0.5 rounded">
                {variable.trim()}
              </span>
            ))}
            {step.output_keys.split(',').length > 3 && (
              <span className="text-xs text-gray-500">+{step.output_keys.split(',').length - 3} more</span>
            )}
          </div>
        </div>
      )}
      
      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ 
          background: '#3b82f6',
          borderColor: '#1e40af',
          borderWidth: '2px',
          width: '10px',
          height: '10px',
        }} 
      />
    </div>
  );
};

// Custom Flow Node component for subflows/agents
const FlowNode = ({ data }: { data: any }) => {
  const step = data.step as Step;
  const hasInput = step.input_keys && step.input_keys.trim() !== '';
  const hasOutput = step.output_keys && step.output_keys.trim() !== '';
  
  return (
    <div 
      className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border-2 border-purple-600 rounded-lg p-4 w-64 shadow-lg hover:shadow-purple-500/20 transition-all duration-200 cursor-pointer"
      onDoubleClick={() => {
        console.log('Double-clicked flow node:', step.id);
        // In a real implementation, this would open the subflow
        alert(`Would open subflow: ${step.title}`);
      }}
    >
      {/* Header with flow icon */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <div className="text-xl mr-2">🌐</div>
          <div className="text-sm font-semibold text-white truncate">
            {step.title}
          </div>
        </div>
        <div className="text-xs bg-purple-700/50 text-purple-300 px-2 py-0.5 rounded">
          Flow
        </div>
      </div>
      
      {/* Description */}
      <div className="text-xs text-gray-300 mb-3 line-clamp-2">
        {step.instructions.substring(0, 80)}
        {step.instructions.length > 80 ? '...' : ''}
      </div>
      
      {/* Input/Output indicators */}
      <div className="flex justify-between text-xs mb-3">
        {hasInput && (
          <div className="flex items-center text-green-400">
            <div className="mr-1">⬇️</div>
            <span>Input</span>
          </div>
        )}
        {hasOutput && (
          <div className="flex items-center text-blue-400">
            <div className="mr-1">⬆️</div>
            <span>Output</span>
          </div>
        )}
      </div>
      
      {/* Variables section */}
      {hasOutput && step.output_keys && (
        <div className="mt-2 pt-2 border-t border-purple-700/50">
          <div className="text-xs text-purple-300 mb-1">Flow Variables:</div>
          <div className="flex flex-wrap gap-1">
            {step.output_keys.split(',').slice(0, 3).map((variable: string, index: number) => (
              <span key={index} className="text-xs bg-purple-800/50 text-purple-200 px-1.5 py-0.5 rounded">
                {variable.trim()}
              </span>
            ))}
            {step.output_keys.split(',').length > 3 && (
              <span className="text-xs text-purple-400">+{step.output_keys.split(',').length - 3} more</span>
            )}
          </div>
        </div>
      )}
      
      {/* Double-click hint */}
      <div className="text-xs text-purple-400/70 mt-2 italic">
        Double-click to open subflow
      </div>
      
      <Handle 
        type="target" 
        position={Position.Top} 
        style={{ 
          background: '#9333ea',
          borderColor: '#7c3aed',
          borderWidth: '2px',
          width: '12px',
          height: '12px',
        }} 
      />
      
      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ 
          background: '#9333ea',
          borderColor: '#7c3aed',
          borderWidth: '2px',
          width: '12px',
          height: '12px',
        }} 
      />
    </div>
  );
};

// Node types configuration
const nodeTypes = {
  default: CustomNode,
  input: CustomNode,
  output: CustomNode,
  flow: FlowNode,
};

// Custom edge component with condition label
const CustomEdge = (props: any & { onClick?: (edgeId: string) => void }) => {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    data,
    onClick,
  } = props;
  
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const conditionText = data?.condition?.source === 'default' 
    ? 'always' 
    : `${data?.condition?.source} ${data?.condition?.operator} ${data?.condition?.value || ''}`;

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: '#3b82f6',
          strokeWidth: 2,
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            background: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '4px',
            padding: '2px 6px',
            fontSize: '10px',
            fontWeight: '500',
            color: '#f9fafb',
            pointerEvents: 'all',
            cursor: 'pointer',
            zIndex: 1000,
          }}
          className="hover:bg-gray-800"
          onClick={() => {
            console.log('Edge clicked:', id, data);
            if (onClick) {
              onClick(id);
            }
          }}
        >
          {conditionText}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

// Edge types configuration - needs to be inside FlowDesigner to access state
// We'll define it inside the FlowDesigner component

// Function to fetch flow data from backend
async function fetchFlowData(flowId: string): Promise<{flowDefinition: FlowDefinition | null, flowSteps: Step[]}> {
  try {
    // Fetch flow definition
    const flowResponse = await fetch(`/api/proxy/api/flow-definitions/${flowId}`);
    if (!flowResponse.ok) {
      console.error('Failed to fetch flow definition:', flowResponse.status);
      return { flowDefinition: null, flowSteps: [] };
    }
    
    const flowData = await flowResponse.json();
    let flowDefinition: FlowDefinition | null = null;
    
    // Check if response has success field (some APIs wrap data)
    if (flowData.success !== undefined) {
      if (!flowData.success) {
        console.error('Failed to fetch flow definition:', flowData.error);
        return { flowDefinition: null, flowSteps: [] };
      }
      flowDefinition = flowData.data;
    } else {
      // Direct flow definition object
      flowDefinition = flowData;
    }

    // Fetch flow steps
    const stepsResponse = await fetch(`/api/proxy/api/flow-steps?flow_id=${flowId}`);
    if (!stepsResponse.ok) {
      console.error('Failed to fetch flow steps:', stepsResponse.status);
      return { flowDefinition, flowSteps: [] };
    }
    
    const stepsData = await stepsResponse.json();
    
    // Handle different response formats for steps
    let stepsArray: any[] = [];
    if (stepsData.success !== undefined && stepsData.data) {
      stepsArray = stepsData.data;
    } else if (Array.isArray(stepsData)) {
      stepsArray = stepsData;
    } else if (stepsData.data && Array.isArray(stepsData.data)) {
      stepsArray = stepsData.data;
    }
    
    // Filter steps for this flow and sort by order_index
    const flowSteps = stepsArray
      .filter((step: any) => step.flow_id === flowId)
      .sort((a: any, b: any) => a.order_index - b.order_index)
      .map((step: any) => ({
        ...step,
        // Add UI-specific fields
        type: step.order_index === 1 ? 'input' : step.order_index === stepsArray.length ? 'output' : 'default',
        description: step.instructions.substring(0, 100) + (step.instructions.length > 100 ? '...' : ''),
      })) as Step[];
    
    return { flowDefinition, flowSteps };
  } catch (error) {
    console.error('Error fetching flow data:', error);
    return { flowDefinition: null, flowSteps: [] };
  }
}

// Function to save flow steps to backend
async function saveFlowSteps(flowId: string, steps: Step[]): Promise<boolean> {
  try {
    // For now, we'll just update existing steps
    // In a real implementation, we would create/update/delete steps as needed
    console.log('Would save flow steps:', { flowId, steps });
    
    // Example: Update each step
    for (const step of steps) {
      const response = await fetch(`/api/proxy/api/flow-steps/${step.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructions: step.instructions,
          title: step.title,
          step_type: step.step_type,
          order_index: step.order_index,
          blocking: Boolean(step.blocking),
          auto_fail_on_error: Boolean(step.auto_fail_on_error),
          retryable: Boolean(step.retryable),
          output_keys: step.output_keys || null,
          input_keys: step.input_keys || null,
          use_endpoints: step.use_endpoints || null,
        }),
      });
      
      if (!response.ok) {
        console.error(`Failed to update step ${step.id}:`, response.status);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error saving flow steps:', error);
    return false;
  }
}

// Function to create a new step
async function createNewStep(flowId: string, stepData: Partial<Step>): Promise<Step | null> {
  try {
    const response = await fetch(`/api/proxy/api/flow-steps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        flow_id: flowId,
        step_key: stepData.step_key || `step-${Date.now()}`,
        title: stepData.title || 'New Step',
        instructions: stepData.instructions || '',
        step_type: stepData.step_type || 'default',
        order_index: stepData.order_index || 1,
        blocking: stepData.blocking || 0,
        auto_fail_on_error: stepData.auto_fail_on_error || 0,
        retryable: stepData.retryable || 0,
        output_keys: stepData.output_keys || '',
        input_keys: stepData.input_keys || '',
        output: stepData.output || 0,
        requires_task: stepData.requires_task || 0,
      }),
    });
    
    if (!response.ok) {
      console.error('Failed to create step:', response.status);
      return null;
    }
    
    const data = await response.json();
    return data.data || data;
  } catch (error) {
    console.error('Error creating step:', error);
    return null;
  }
}

// Create nodes from step data
function createNodesFromSteps(steps: Step[]) {
  return steps.map((step, index) => {
    // Determine node type based on step_type
    let nodeType = 'default';
    if (step.step_type === 'input' || step.type === 'input') {
      nodeType = 'input';
    } else if (step.step_type === 'output' || step.type === 'output') {
      nodeType = 'output';
    } else if (step.step_type === 'flow' || step.step_type === 'agent') {
      nodeType = 'flow';
    }
    
    return {
      id: step.id,
      type: nodeType,
      data: { 
        label: step.title, 
        title: step.title,
        step,
        instructions: step.instructions,
        command: step.command || '',
        await_input: step.await_input || false,
      },
      position: { x: 250, y: 25 + (index * 100) },
    };
  });
}

// Extract available variables from previous steps
function getAvailableVariables(currentStepId: string, steps: Step[]): string[] {
  const variables: Set<string> = new Set();
  
  // Find the current step index
  const currentStepIndex = steps.findIndex(step => step.id === currentStepId);
  
  // If step not found or it's the first step, return empty
  if (currentStepIndex === -1 || currentStepIndex === 0) {
    return [];
  }
  
  // Collect output keys from all previous steps
  for (let i = 0; i < currentStepIndex; i++) {
    const step = steps[i];
    if (step.output_keys && step.output_keys.trim()) {
      // Split by comma and trim each key
      const keys = step.output_keys.split(',').map(key => key.trim()).filter(key => key);
      keys.forEach(key => variables.add(key));
    }
    
    // Also check for command-specific variables
    if (step.command) {
      // For commands, we might have structured outputs
      // For now, add the command name as a potential variable source
      variables.add(`${step.command}_result`);
      variables.add(`${step.command}_output`);
    }
  }
  
  return Array.from(variables);
}

// Create edges connecting all steps in sequence
function createEdgesFromSteps(steps: Step[]) {
  const edges: Edge[] = [];
  for (let i = 0; i < steps.length - 1; i++) {
    edges.push({
      id: `e${steps[i].id}-${steps[i + 1].id}`,
      source: steps[i].id,
      target: steps[i + 1].id,
      animated: i === 0, // Animate first connection
      style: {
        stroke: '#3b82f6', // Blue color for edges
        strokeWidth: 2,
      },
      markerEnd: {
        type: 'arrowclosed',
        color: '#3b82f6',
      },
      data: {
        condition: {
          source: 'default',
          operator: 'always',
          value: null,
        },
        route: {
          type: 'step' as const,
          target_id: steps[i + 1].id,
          context_preservation: 'full' as const,
        },
      },
    });
  }
  return edges;
}

// Edge popup modal component
const EdgePopup = ({ 
  edge, 
  nodes, 
  onSave, 
  onClose 
}: { 
  edge: Edge;
  nodes: Node[];
  onSave: (edge: Edge) => void;
  onClose: () => void;
}) => {
  const [condition, setCondition] = useState(() => {
    const data = edge.data as any;
    if (data?.condition && typeof data.condition === 'object' && data.condition.source) {
      return data.condition;
    }
    return {
      source: 'default',
      operator: 'always',
      value: '',
    };
  });
  const [route, setRoute] = useState(() => {
    const data = edge.data as any;
    if (data?.route && typeof data.route === 'object' && data.route.target_id) {
      return data.route;
    }
    return {
      type: 'step' as const,
      target_id: edge.target,
      context_preservation: 'full' as const,
    };
  });

  // Get all variables from source node's output_keys
  const sourceNode = nodes.find(n => n.id === edge.source);
  const sourceStep = sourceNode?.data?.step as Step | undefined;
  const sourceVariables = sourceStep?.output_keys 
    ? sourceStep.output_keys.split(',').map(key => key.trim()).filter(key => key)
    : [];
  
  const sourceOptions = [
    { value: 'default', label: 'Always (no condition)' },
    { value: 'inputs.approval', label: 'Input: Approval' },
    { value: 'inputs.status', label: 'Input: Status' },
    { value: 'data.user_id', label: 'Data: User ID' },
    { value: 'command.get_tasks.result', label: 'Command: Get Tasks Result' },
    { value: 'ai_output.intent', label: 'AI Output: Intent' },
    ...sourceVariables.map(variable => ({
      value: `variables.${variable}`,
      label: `Variable: ${variable}`
    }))
  ];

  const operatorOptions = [
    { value: 'always', label: 'Always' },
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'greater_than', label: 'Greater Than' },
    { value: 'less_than', label: 'Less Than' },
  ];

  const targetNodes = nodes.filter(n => n.id !== edge.source);

  const handleSave = () => {
    const updatedEdge = {
      ...edge,
      data: {
        condition,
        route,
      },
    };
    onSave(updatedEdge);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Edge Condition</h3>
        
        <div className="space-y-4">
          {/* Source */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Source
            </label>
            <select
              value={condition.source}
              onChange={(e) => setCondition({...condition, source: e.target.value})}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
            >
              {sourceOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Operator */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Operator
            </label>
            <select
              value={condition.operator}
              onChange={(e) => setCondition({...condition, operator: e.target.value})}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
            >
              {operatorOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Value (if not "always") */}
          {condition.operator !== 'always' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Value
              </label>
              <input
                type="text"
                value={condition.value || ''}
                onChange={(e) => setCondition({...condition, value: e.target.value})}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white font-mono"
                placeholder="Enter value or use {{variable}}..."
              />
              <div className="text-xs text-gray-400 mt-1">
                Use <code className="bg-gray-900 px-1 py-0.5 rounded">{"{{variable}}"}</code> syntax for variables from previous steps
              </div>
            </div>
          )}

          {/* Target */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Target Step
            </label>
            <select
              value={route.target_id}
              onChange={(e) => setRoute({...route, target_id: e.target.value})}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
            >
              {targetNodes.map(node => (
                <option key={node.id} value={node.id}>
                  {typeof node.data?.title === 'string' ? node.data.title : node.id}
                </option>
              ))}
            </select>
          </div>

          {/* Route Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Route Type
            </label>
            <select
              value={route.type}
              onChange={(e) => setRoute({...route, type: e.target.value as any})}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
            >
              <option value="step">Step</option>
              <option value="flow">Flow (Agent)</option>
              <option value="end">End</option>
            </select>
          </div>

          {/* Context Preservation */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Context Preservation
            </label>
            <select
              value={route.context_preservation || 'full'}
              onChange={(e) => setRoute({...route, context_preservation: e.target.value as any})}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
            >
              <option value="full">Full Context</option>
              <option value="partial">Partial Context</option>
              <option value="none">No Context</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
          >
            Save Condition
          </button>
        </div>
      </div>
    </div>
  );
};

// Step popup modal component
const StepPopup = ({ 
  node, 
  availableVariables,
  onSave, 
  onClose 
}: { 
  node: Node;
  availableVariables: string[];
  onSave: (node: Node) => void;
  onClose: () => void;
}) => {
  const [instructions, setInstructions] = useState<string>(typeof node.data?.instructions === 'string' ? node.data.instructions : '');
  const [command, setCommand] = useState<string>(typeof node.data?.command === 'string' ? node.data.command : '');
  const [awaitInput, setAwaitInput] = useState<boolean>(typeof node.data?.await_input === 'boolean' ? node.data.await_input : false);
  const [outputKeys, setOutputKeys] = useState<string>(typeof node.data?.step?.output_keys === 'string' ? node.data.step.output_keys : '');
  const [stepType, setStepType] = useState<string>(typeof node.data?.step?.step_type === 'string' ? node.data.step.step_type : 'default');

  const handleSave = () => {
    const updatedNode = {
      ...node,
      data: {
        ...node.data,
        instructions,
        command,
        await_input: awaitInput,
        step: {
          ...node.data?.step,
          output_keys: outputKeys,
          step_type: stepType,
        },
      },
    };
    onSave(updatedNode);
    onClose();
  };

  // Handle drag start for variables
  const onVariableDragStart = (event: DragEvent, variableName: string) => {
    event.dataTransfer.setData('text/plain', `{{${variableName}}}`);
    event.dataTransfer.effectAllowed = 'copy';
  };

  // Handle drop on instructions textarea
  const onInstructionsDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const onInstructionsDrop = (event: DragEvent) => {
    event.preventDefault();
    const variable = event.dataTransfer.getData('text/plain');
    if (variable) {
      const textarea = event.target as HTMLTextAreaElement;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newInstructions = instructions.substring(0, start) + variable + instructions.substring(end);
      setInstructions(newInstructions);
      
      // Focus and set cursor after inserted variable
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl border border-gray-700 max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-white mb-4">Step Configuration</h3>
        
        <div className="space-y-4">
          {/* Step Title */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Step Title
            </label>
            <input
              type="text"
              value={typeof node.data?.title === 'string' ? node.data.title : ''}
              readOnly
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-400"
            />
          </div>

          {/* Step Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Step Type
            </label>
            <select
              value={stepType}
              onChange={(e) => setStepType(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
            >
              <option value="default">Regular Step</option>
              <option value="input">Input Step</option>
              <option value="output">Output Step</option>
              <option value="flow">Flow (Agent)</option>
              <option value="ai">AI Step</option>
              <option value="command">Command Step</option>
            </select>
            <div className="text-xs text-gray-400 mt-1">
              Flow nodes can be double-clicked to open subflows
            </div>
          </div>

          {/* Instructions with drag-and-drop support */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-300">
                Instructions
              </label>
              <div className="text-xs text-gray-400">
                Drag variables from below into instructions
              </div>
            </div>
            <textarea
              value={instructions || ''}
              onChange={(e) => setInstructions(e.target.value)}
              onDragOver={onInstructionsDragOver}
              onDrop={onInstructionsDrop}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white min-h-[120px] font-mono text-sm"
              placeholder="Enter step instructions... Drag variables from below to insert {{variable}} syntax."
            />
            <div className="text-xs text-gray-400 mt-1">
              Use <code className="bg-gray-900 px-1 py-0.5 rounded">{"{{variable}}"}</code> syntax for variables
            </div>
          </div>

          {/* Command */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Command
            </label>
            <input
              type="text"
              value={command || ''}
              onChange={(e) => setCommand(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              placeholder="Enter command (e.g., get_tasks, analyze_data)..."
            />
          </div>

          {/* Await Input */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="awaitInput"
              checked={awaitInput || false}
              onChange={(e) => setAwaitInput(e.target.checked)}
              className="h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded"
            />
            <label htmlFor="awaitInput" className="ml-2 text-sm text-gray-300">
              Await User Input
            </label>
          </div>

          {/* Available Variables from Previous Steps */}
          {availableVariables.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Available Variables (Drag into instructions)
              </label>
              <div className="space-y-2">
                {availableVariables.map((variable, index) => (
                  <div 
                    key={index}
                    className="flex items-center bg-gray-700 border border-gray-600 rounded px-3 py-2 cursor-grab active:cursor-grabbing hover:bg-gray-600 transition-colors"
                    draggable
                    onDragStart={(e) => onVariableDragStart(e, variable)}
                  >
                    <div className="text-purple-300 mr-2">📦</div>
                    <div className="flex-1 text-white font-mono text-sm">
                      {variable}
                    </div>
                    <div className="text-xs text-gray-400 ml-2">Drag to instructions</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Output Keys (Variables this step will produce) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Output Keys (Comma-separated)
            </label>
            <input
              type="text"
              value={outputKeys || ''}
              onChange={(e) => setOutputKeys(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white font-mono"
              placeholder="task_id, user_name, result_data..."
            />
            <div className="text-xs text-gray-400 mt-1">
              These keys will be available as variables for subsequent steps
            </div>
          </div>

          {/* Variable Syntax Help */}
          <div className="bg-gray-900/50 p-3 rounded border border-gray-700">
            <h4 className="text-sm font-medium text-gray-300 mb-1">Variable System</h4>
            <p className="text-xs text-gray-400 mb-2">
              • Use <code className="bg-gray-800 px-1 py-0.5 rounded">{"{{variable_name}}"}</code> in instructions
            </p>
            <p className="text-xs text-gray-400 mb-2">
              • Variables come from previous steps' output keys
            </p>
            <p className="text-xs text-gray-400">
              • Define output keys above to create variables for next steps
            </p>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
          >
            Save Step
          </button>
        </div>
      </div>
    </div>
  );
};

function FlowDesigner({ flowId }: { flowId?: string }) {
  const router = useRouter();
  const params = useParams();
  
  // Get flowId from props or URL params
  const currentFlowId = flowId || params?.flowId as string || 'word-matching-flow';
  
  // State for flow data
  const [flowDefinition, setFlowDefinition] = useState<FlowDefinition | null>(null);
  const [flowSteps, setFlowSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // React Flow state
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [saving, setSaving] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  
  // State for modals
  const [showEditFlowModal, setShowEditFlowModal] = useState(false);
  const [showCreateFlowModal, setShowCreateFlowModal] = useState(false);
  
  // Drag and drop state
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [draggingNodeType, setDraggingNodeType] = useState<string | null>(null);
  
  // Load flow data on mount
  useEffect(() => {
    loadFlowData();
  }, [currentFlowId]);
  
  const loadFlowData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { flowDefinition, flowSteps } = await fetchFlowData(currentFlowId);
      
      if (!flowDefinition) {
        // Flow doesn't exist - show create flow modal
        setShowCreateFlowModal(true);
        setError(`Flow "${currentFlowId}" not found. Create a new flow?`);
      } else {
        setFlowDefinition(flowDefinition);
        setFlowSteps(flowSteps);
        
        // Create nodes and edges from real data
        const initialNodes = createNodesFromSteps(flowSteps);
        const initialEdges = createEdgesFromSteps(flowSteps);
        
        setNodes(initialNodes);
        setEdges(initialEdges);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load flow data');
      console.error('Error loading flow data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Node types configuration with onClick handler
  const nodeTypes = useCallback(() => ({
    default: (props: any) => {
      const handleClick = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          setSelectedNode(node);
        }
      };
      
      return <CustomNode {...props} onClick={handleClick} />;
    },
    input: (props: any) => {
      const handleClick = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          setSelectedNode(node);
        }
      };
      
      return <CustomNode {...props} onClick={handleClick} />;
    },
    output: (props: any) => {
      const handleClick = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          setSelectedNode(node);
        }
      };
      
      return <CustomNode {...props} onClick={handleClick} />;
    },
  }), [nodes]);

  // Edge types configuration with onClick handler
  const edgeTypes = useCallback(() => ({
    default: (props: any) => {
      const handleClick = (edgeId: string) => {
        const edge = edges.find(e => e.id === edgeId);
        if (edge) {
          setSelectedEdge(edge);
        }
      };
      
      return <CustomEdge {...props} onClick={handleClick} />;
    },
  }), [edges]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge: Edge = {
        id: `e${connection.source}-${connection.target}`,
        source: connection.source!,
        target: connection.target!,
        animated: false,
        style: {
          stroke: '#3b82f6',
          strokeWidth: 2,
        },
        markerEnd: {
          type: 'arrowclosed',
          color: '#3b82f6',
        },
        data: {
          condition: {
            source: 'default',
            operator: 'always',
            value: null,
          },
          route: {
            type: 'step',
            target_id: connection.target!,
            context_preservation: 'full',
          },
        },
      };
      setEdges((eds) => [...eds, newEdge]);
    },
    []
  );

  const handleEdgeUpdate = useCallback((updatedEdge: Edge) => {
    setEdges((eds) => eds.map(edge => 
      edge.id === updatedEdge.id ? updatedEdge : edge
    ));
  }, []);

  const handleNodeUpdate = useCallback((updatedNode: Node) => {
    setNodes((nds) => nds.map(node => 
      node.id === updatedNode.id ? updatedNode : node
    ));
  }, []);

  const onSaveFlow = useCallback(async () => {
    setSaving(true);
    try {
      // Convert nodes back to steps
      const updatedSteps: Step[] = nodes.map((node): Step => {
        const step = node.data.step as Step;
        const nodeTitle = node.data.title;
        const nodeInstructions = node.data.instructions;
        const nodeStepType = node.data.step?.step_type;
        
        return {
          ...step,
          title: typeof nodeTitle === 'string' ? nodeTitle : step.title,
          instructions: typeof nodeInstructions === 'string' ? nodeInstructions : step.instructions,
          step_type: typeof nodeStepType === 'string' ? nodeStepType : step.step_type,
          // Update other fields from node data if needed
        };
      });
      
      // Save to backend
      const success = await saveFlowSteps(currentFlowId, updatedSteps);
      
      if (success) {
        alert(`Flow saved successfully with ${nodes.length} steps`);
        // Reload data to ensure we have latest
        await loadFlowData();
      } else {
        alert('Failed to save flow. Check console for errors.');
      }
    } catch (err) {
      console.error('Error saving flow:', err);
      alert('Error saving flow. See console for details.');
    } finally {
      setSaving(false);
    }
  }, [nodes, currentFlowId]);

  // Function to add a new step
  const handleAddStep = useCallback(async () => {
    try {
      // Calculate position for new node (right of existing nodes)
      const maxX = nodes.length > 0 ? Math.max(...nodes.map(n => n.position.x)) : 250;
      const maxY = nodes.length > 0 ? Math.max(...nodes.map(n => n.position.y)) : 25;
      
      // Create new step data
      const newStepData: Partial<Step> = {
        title: `Step ${nodes.length + 1}`,
        instructions: 'New step instructions...',
        step_type: 'default',
        order_index: nodes.length + 1,
        blocking: 0,
        auto_fail_on_error: 0,
        retryable: 0,
        output_keys: '',
        input_keys: '',
        output: 0,
        requires_task: 0,
      };
      
      // Create step in backend
      const newStep = await createNewStep(currentFlowId, newStepData);
      
      if (!newStep) {
        alert('Failed to create new step. Check console for errors.');
        return;
      }
      
      // Create new node for the step
      const newNode: Node = {
        id: newStep.id,
        type: 'default',
        data: {
          label: newStep.title,
          title: newStep.title,
          step: newStep,
          instructions: newStep.instructions,
          command: '',
          await_input: false,
          variables: [],
        },
        position: { x: maxX + 300, y: maxY + 100 },
      };
      
      // Add new node to the flow
      setNodes(prevNodes => [...prevNodes, newNode]);
      
      // If there are existing nodes, create an edge from the last node to the new one
      if (nodes.length > 0) {
        const lastNode = nodes[nodes.length - 1];
        const newEdge: Edge = {
          id: `e${lastNode.id}-${newStep.id}`,
          source: lastNode.id,
          target: newStep.id,
          animated: false,
          style: {
            stroke: '#3b82f6',
            strokeWidth: 2,
          },
          markerEnd: {
            type: 'arrowclosed',
            color: '#3b82f6',
          },
          data: {
            condition: {
              source: 'default',
              operator: 'always',
              value: null,
            },
            route: {
              type: 'step' as const,
              target_id: newStep.id,
              context_preservation: 'full' as const,
            },
          },
        };
        setEdges(prevEdges => [...prevEdges, newEdge]);
      }
      
      // Select the new node to open the step popup
      setSelectedNode(newNode);
      
    } catch (error) {
      console.error('Error adding new step:', error);
      alert('Error adding new step. See console for details.');
    }
  }, [nodes, currentFlowId]);

  // Drag and drop handlers for React Flow
  const onDragStart = (event: DragEvent, nodeType: string) => {
    setDraggingNodeType(nodeType);
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(async (event: DragEvent) => {
    event.preventDefault();
    
    if (!reactFlowInstance || !draggingNodeType) return;
    
    // Get position where node should be placed
    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    
    try {
      // Create new step data based on node type
      const nodeType = draggingNodeType;
      let stepTitle = '';
      let stepType = 'default';
      
      if (nodeType === 'input') {
        stepTitle = 'Input Step';
        stepType = 'input';
      } else if (nodeType === 'output') {
        stepTitle = 'Output Step';
        stepType = 'output';
      } else if (nodeType === 'flow') {
        stepTitle = `Flow ${nodes.length + 1}`;
        stepType = 'flow';
      } else {
        stepTitle = `Step ${nodes.length + 1}`;
        stepType = 'default';
      }
      
      // Create new step data
      const newStepData: Partial<Step> = {
        title: stepTitle,
        instructions: 'New step instructions...',
        step_type: stepType,
        order_index: nodes.length + 1,
        blocking: 0,
        auto_fail_on_error: 0,
        retryable: 0,
        output_keys: '',
        input_keys: '',
        output: 0,
        requires_task: 0,
      };
      
      // Create step in backend
      const newStep = await createNewStep(currentFlowId, newStepData);
      
      if (!newStep) {
        alert('Failed to create new step. Check console for errors.');
        return;
      }
      
      // Create new node for the step
      const newNode: Node = {
        id: newStep.id,
        type: nodeType,
        data: {
          label: newStep.title,
          title: newStep.title,
          step: newStep,
          instructions: newStep.instructions,
          command: '',
          await_input: false,
          variables: [],
        },
        position,
      };
      
      // Add new node to the flow
      setNodes(prevNodes => [...prevNodes, newNode]);
      
      // Select the new node to open the step popup
      setSelectedNode(newNode);
      
      // Reset dragging state
      setDraggingNodeType(null);
      
    } catch (error) {
      console.error('Error dropping node:', error);
      alert('Error creating step. See console for details.');
      setDraggingNodeType(null);
    }
  }, [reactFlowInstance, draggingNodeType, nodes, currentFlowId]);

  // Initialize React Flow instance
  const onInit = useCallback((instance: ReactFlowInstance) => {
    setReactFlowInstance(instance);
  }, []);

  // Handle flow created/updated
  const handleFlowCreated = (newFlowId: string) => {
    // Refresh the page with the new flow ID
    router.push(`/flows/design/${newFlowId}`);
  };

  const handleFlowUpdated = (updatedFlowId: string) => {
    // Reload flow data
    loadFlowData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading flow data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="p-6">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-white">Flow Designer</h1>
            <p className="text-gray-300">
              Flow: <span className="font-mono text-blue-400">{flowDefinition?.name || currentFlowId}</span>
              {flowDefinition && (
                <button
                  onClick={() => setShowEditFlowModal(true)}
                  className="ml-4 text-sm text-gray-400 hover:text-white"
                >
                  Edit Flow Details
                </button>
              )}
            </p>
            {flowDefinition?.description && (
              <p className="text-gray-400 mt-1 max-w-2xl">{flowDefinition.description}</p>
            )}
          </div>
          <div className="flex gap-4">
            <button
              onClick={handleAddStep}
              className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded font-medium text-white transition-colors"
            >
              + Add Step
            </button>
            <button
              onClick={onSaveFlow}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Flow'}
            </button>
            <button
              onClick={() => router.push('/chat')}
              className="bg-gray-800 hover:bg-gray-700 px-6 py-2 rounded font-medium border border-gray-700 text-gray-100 hover:text-white transition-colors"
            >
              Back to Chat
            </button>
          </div>
        </div>
        
        {error && (
          <div className="mb-6 bg-red-900/30 border border-red-800 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-400">Error</h3>
                <div className="mt-2 text-sm text-red-300">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Flow Canvas */}
        <div className="flex-1">
          <div 
            ref={reactFlowWrapper}
            className="w-full h-[700px] bg-gray-900 rounded-lg border border-gray-800"
            onDragOver={onDragOver}
            onDrop={onDrop}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onInit={onInit}
              fitView
              nodeTypes={nodeTypes()}
              edgeTypes={edgeTypes()}
            >
              <Background variant={BackgroundVariant.Dots} gap={12} size={1} color="#374151" />
              <Controls />
              <MiniMap 
                style={{ backgroundColor: '#111827' }}
                nodeColor={(node) => {
                  if (node.type === 'input') return '#064e3b'; // dark green
                  if (node.type === 'output') return '#7f1d1d'; // dark red
                  return '#1f2937'; // default dark gray
                }}
                nodeStrokeColor={(node) => {
                  if (node.type === 'input') return '#047857'; // green
                  if (node.type === 'output') return '#dc2626'; // red
                  return '#374151'; // default border
                }}
              />
              {/* Node Toolbar - Drag and drop nodes */}
              <Panel position="top-left" className="bg-gray-800/90 backdrop-blur-sm rounded-lg p-3 border border-gray-700 shadow-lg">
                <div className="text-sm font-medium text-gray-200 mb-2">Add Nodes</div>
                <div className="space-y-2">
                  <div 
                    className="px-3 py-2 bg-green-900/40 hover:bg-green-800/60 border border-green-800 rounded cursor-grab active:cursor-grabbing text-green-200 text-sm transition-colors"
                    draggable
                    onDragStart={(e) => onDragStart(e, 'input')}
                  >
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                      <span>Input Step</span>
                    </div>
                  </div>
                  <div 
                    className="px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded cursor-grab active:cursor-grabbing text-gray-200 text-sm transition-colors"
                    draggable
                    onDragStart={(e) => onDragStart(e, 'default')}
                  >
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                      <span>Regular Step</span>
                    </div>
                  </div>
                  <div 
                    className="px-3 py-2 bg-red-900/40 hover:bg-red-800/60 border border-red-800 rounded cursor-grab active:cursor-grabbing text-red-200 text-sm transition-colors"
                    draggable
                    onDragStart={(e) => onDragStart(e, 'output')}
                  >
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                      <span>Output Step</span>
                    </div>
                  </div>
                  <div 
                    className="px-3 py-2 bg-purple-900/40 hover:bg-purple-800/60 border border-purple-800 rounded cursor-grab active:cursor-grabbing text-purple-200 text-sm transition-colors"
                    draggable
                    onDragStart={(e) => onDragStart(e, 'flow')}
                  >
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full bg-purple-500 mr-2"></div>
                      <span>Flow Node (Agent)</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <div className="text-xs text-gray-400">
                    Drag nodes onto canvas to create steps
                  </div>
                  <div className="text-xs text-purple-400 mt-1">
                    Flow nodes can be double-clicked to open subflows
                  </div>
                </div>
              </Panel>

              <Panel position="top-right" className="bg-gray-800/80 backdrop-blur-sm rounded p-2 border border-gray-700">
                <div className="text-sm text-gray-200">
                  <div>Drag nodes to reposition</div>
                  <div>Connect nodes by dragging from handles</div>
                  <div className="mt-1 text-xs text-gray-400">Click edge labels to edit conditions</div>
                </div>
              </Panel>
            </ReactFlow>
          </div>
        </div>

        {/* Edge Popup */}
        {selectedEdge && (
          <EdgePopup
            edge={selectedEdge}
            nodes={nodes}
            onSave={handleEdgeUpdate}
            onClose={() => setSelectedEdge(null)}
          />
        )}

        {/* Step Popup */}
        {selectedNode && (
          <StepPopup
            node={selectedNode}
            availableVariables={getAvailableVariables(selectedNode.id, flowSteps)}
            onSave={handleNodeUpdate}
            onClose={() => setSelectedNode(null)}
          />
        )}

        {/* Edit Flow Modal */}
        {showEditFlowModal && flowDefinition && (
          <EditFlowModal
            flowId={flowDefinition.id}
            onClose={() => setShowEditFlowModal(false)}
            onFlowUpdated={handleFlowUpdated}
          />
        )}

        {/* Create Flow Modal */}
        {showCreateFlowModal && (
          <SimpleFlowCreator
            onClose={() => {
              setShowCreateFlowModal(false);
              router.push('/chat'); // Go back to chat if user cancels
            }}
            onFlowCreated={handleFlowCreated}
          />
        )}
      </div>
    </div>
  );
}

export default function FlowDesignPage() {
  return (
    <ReactFlowProvider>
      <FlowDesigner />
    </ReactFlowProvider>
  );
}