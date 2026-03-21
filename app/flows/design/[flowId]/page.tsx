'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
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

// Custom node component for dark mode
const CustomNode = ({ data, onClick }: { data: any; onClick?: (nodeId: string) => void }) => {
  const step = data.step as Step;
  
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
      className="px-4 py-3 rounded-lg shadow-lg border cursor-pointer"
      style={{
        backgroundColor: bgColor,
        borderColor: borderColor,
        borderWidth: '2px',
        color: textColor,
        minWidth: '200px',
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
      <div className="font-medium text-sm">{step.title}</div>
      {step.description && (
        <div className="text-xs text-gray-300 mt-1">{step.description}</div>
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

// Node types configuration
const nodeTypes = {
  default: CustomNode,
  input: CustomNode,
  output: CustomNode,
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
          blocking: step.blocking,
          auto_fail_on_error: step.auto_fail_on_error,
          retryable: step.retryable,
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
  return steps.map((step, index) => ({
    id: step.id,
    type: step.type === 'input' ? 'input' : step.type === 'output' ? 'output' : 'default',
    data: { 
      label: step.title, 
      title: step.title,
      step,
      instructions: step.instructions,
      command: step.command || '',
      await_input: step.await_input || false,
      variables: step.variables || [],
    },
    position: { x: 250, y: 25 + (index * 100) },
  }));
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

  const sourceOptions = [
    { value: 'default', label: 'Always (no condition)' },
    { value: 'inputs.approval', label: 'Input: Approval' },
    { value: 'inputs.status', label: 'Input: Status' },
    { value: 'data.user_id', label: 'Data: User ID' },
    { value: 'command.get_tasks.result', label: 'Command: Get Tasks Result' },
    { value: 'ai_output.intent', label: 'AI Output: Intent' },
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
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                placeholder="Enter value..."
              />
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
  onSave, 
  onClose 
}: { 
  node: Node;
  onSave: (node: Node) => void;
  onClose: () => void;
}) => {
  const [instructions, setInstructions] = useState<string>(typeof node.data?.instructions === 'string' ? node.data.instructions : '');
  const [command, setCommand] = useState<string>(typeof node.data?.command === 'string' ? node.data.command : '');
  const [awaitInput, setAwaitInput] = useState<boolean>(typeof node.data?.await_input === 'boolean' ? node.data.await_input : false);
  const [variables, setVariables] = useState<string[]>(Array.isArray(node.data?.variables) ? node.data.variables : []);

  const handleSave = () => {
    const updatedNode = {
      ...node,
      data: {
        ...node.data,
        instructions,
        command,
        await_input: awaitInput,
        variables,
      },
    };
    onSave(updatedNode);
    onClose();
  };

  const addVariable = () => {
    setVariables([...variables, '']);
  };

  const updateVariable = (index: number, value: string) => {
    const newVariables = [...variables];
    newVariables[index] = value;
    setVariables(newVariables);
  };

  const removeVariable = (index: number) => {
    const newVariables = variables.filter((_, i) => i !== index);
    setVariables(newVariables);
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

          {/* Instructions */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Instructions
            </label>
            <textarea
              value={instructions || ''}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white min-h-[100px]"
              placeholder="Enter step instructions..."
            />
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

          {/* Variables */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-300">
                Variables
              </label>
              <button
                type="button"
                onClick={addVariable}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                + Add Variable
              </button>
            </div>
            
            <div className="space-y-2">
              {variables.map((variable, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={variable}
                    onChange={(e) => updateVariable(index, e.target.value)}
                    className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                    placeholder="Variable name (e.g., user_id, task_result)..."
                  />
                  <button
                    type="button"
                    onClick={() => removeVariable(index)}
                    className="text-red-400 hover:text-red-300 px-2"
                  >
                    ×
                  </button>
                </div>
              ))}
              
              {variables.length === 0 && (
                <div className="text-gray-400 text-sm italic">
                  No variables defined. Use {"{{variable}}"} syntax in instructions.
                </div>
              )}
            </div>
          </div>

          {/* Variable Syntax Help */}
          <div className="bg-gray-900/50 p-3 rounded border border-gray-700">
            <h4 className="text-sm font-medium text-gray-300 mb-1">Variable Syntax</h4>
            <p className="text-xs text-gray-400">
              Use <code className="bg-gray-800 px-1 py-0.5 rounded">{"{{variable_name}}"}</code> in instructions to reference variables.
              Example: <code className="bg-gray-800 px-1 py-0.5 rounded">{"Get tasks for {{user_id}}"}</code>
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
        
        return {
          ...step,
          title: typeof nodeTitle === 'string' ? nodeTitle : step.title,
          instructions: typeof nodeInstructions === 'string' ? nodeInstructions : step.instructions,
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
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
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