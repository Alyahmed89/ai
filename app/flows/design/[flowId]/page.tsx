'use client';

import { useState, useCallback, useRef, useEffect, useMemo, DragEvent } from 'react';
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
  input_keys: string | null;
  output: number;
  default_next_step_id: string | null;
  step_number: number | null;
  requires_task: number;
  use_endpoints: string | null;
  extra_step: number;
  page_key: string | null;
  // Additional fields for UI
  description?: string;
  type?: 'input' | 'default' | 'output' | 'response' | 'condition';
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

// Node data interface
interface NodeData {
  label?: string;
  title?: string;
  step?: Step;
  instructions?: string;
  command?: string;
  await_input?: boolean;
  variables?: string[];
  description?: string;
  condition?: string; // Condition text for condition nodes
  type?: 'input' | 'default' | 'output' | 'response' | 'flow' | 'condition';
  [key: string]: unknown;
}

// Extended Node type
type CustomNode = Node<NodeData>;

// Custom node component for dark mode with enhanced visual indicators
const CustomNode = ({ data, onClick, onAddNode }: { data: any; onClick?: (nodeId: string) => void; onAddNode?: (nodeId: string, event: React.MouseEvent) => void }) => {
  const step = data.step as Step;
  const hasCommand = data.command && data.command.trim().length > 0;
  const hasVariables = step && step.output_keys && step.output_keys.trim().length > 0;
  const hasInput = step && step.input_keys && step.input_keys.trim().length > 0;
  const hasOutput = step && step.output_keys && step.output_keys.trim().length > 0;
  const awaitInput = data.await_input === true;
  
  // Determine node colors based on type - Modern minimal palette
  let bgColor = '#0f172a'; // slate-900
  let borderColor = '#334155'; // slate-700
  let textColor = '#f8fafc'; // slate-50
  let borderWidth = '1px';
  let borderStyle = 'solid';
  
  const nodeType = data.type || (step && step.step_type) || 'default';
  
  if (nodeType === 'input') {
    bgColor = '#0f172a'; // slate-900
    borderColor = '#0ea5e9'; // sky-500
  } else if (nodeType === 'output') {
    bgColor = '#0f172a'; // slate-900
    borderColor = '#8b5cf6'; // violet-500
  } else if (nodeType === 'response') {
    bgColor = '#1e293b'; // slate-800 - slightly lighter background
    borderColor = '#f59e0b'; // amber-500
    borderWidth = '2px';
    borderStyle = 'dashed';
  } else if (nodeType === 'condition') {
    bgColor = '#1e293b'; // slate-800 - slightly lighter background
    borderColor = '#3b82f6'; // blue-500
    borderWidth = '2px';
    borderStyle = 'dashed';
  }
  
  return (
    <div 
      className="px-4 py-3 rounded-lg border cursor-pointer transition-all hover:border-opacity-100"
      style={{
        backgroundColor: bgColor,
        borderColor: borderColor,
        borderWidth: borderWidth,
        borderStyle: borderStyle,
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
      <div className="flex justify-between items-start">
        <div className="font-medium text-sm truncate">{step.title}</div>
        <div className="flex items-center space-x-1 ml-2">
          {/* Add Step button - draggable for drag-to-create */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onAddNode) {
                onAddNode(step.id, e);
              }
            }}
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              e.dataTransfer.setData('application/node-add', step.id);
              e.dataTransfer.effectAllowed = 'copy';
              // Set drag image to a custom indicator
              const dragIcon = document.createElement('div');
              dragIcon.textContent = '+';
              dragIcon.style.position = 'absolute';
              dragIcon.style.left = '-1000px';
              dragIcon.style.top = '-1000px';
              document.body.appendChild(dragIcon);
              e.dataTransfer.setDragImage(dragIcon, 10, 10);
              setTimeout(() => document.body.removeChild(dragIcon), 0);
            }}
            className="text-xs text-gray-400 opacity-40 hover:opacity-100 hover:text-green-400 transition-opacity cursor-grab active:cursor-grabbing"
            title="Add step from this node (click or drag)"
          >
            +
          </button>
          {/* I/O and command indicators as icons - blurry by default, full opacity on hover */}
          {hasInput && (
            <span className="text-xs text-gray-400 opacity-40 hover:opacity-100 transition-opacity" title={`Input: ${step.input_keys}`}>
              →
            </span>
          )}
          {hasOutput && (
            <span className="text-xs text-gray-400 opacity-40 hover:opacity-100 transition-opacity" title={`Output: ${step.output_keys}`}>
              ←
            </span>
          )}
          {hasCommand && (
            <span className="text-xs text-gray-400 opacity-40 hover:opacity-100 transition-opacity" title="Has command">
              ⚡
            </span>
          )}
          {awaitInput && (
            <span className="text-xs text-gray-400 opacity-40 hover:opacity-100 transition-opacity" title="Awaits user input">
              ⏳
            </span>
          )}
          {nodeType === 'response' && (
            <span className="text-xs text-yellow-400 opacity-40 hover:opacity-100 transition-opacity" title="Response Node">
              🔄
            </span>
          )}
          {nodeType === 'condition' && (
            <span className="text-xs text-blue-400 opacity-40 hover:opacity-100 transition-opacity" title="Condition Node">
              ⚖️
            </span>
          )}
        </div>
      </div>
      
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
  const hasInput = step && step.input_keys && step.input_keys.trim() !== '';
  const hasOutput = step && step.output_keys && step.output_keys.trim() !== '';
  
  return (
    <div 
      className="bg-gray-900 border border-purple-600 rounded p-3 w-60 cursor-pointer"
      onDoubleClick={() => {
        console.log('Double-clicked flow node:', step.id);
        // In a real implementation, this would open the subflow
        alert(`Would open subflow: ${step.title}`);
      }}
    >
      {/* Minimal header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <div className="text-sm text-white truncate">
            {step.title}
          </div>
        </div>
        <div className="text-xs text-purple-400">
          Flow
        </div>
      </div>
      
      {/* Minimal description */}
      <div className="text-xs text-gray-400 mb-2 line-clamp-2">
        {step.instructions.substring(0, 60)}
        {step.instructions.length > 60 ? '...' : ''}
      </div>
      
      {/* Minimal I/O indicators */}
      <div className="flex justify-between text-xs">
        {hasInput && (
          <div className="text-green-400">
            →
          </div>
        )}
        {hasOutput && (
          <div className="text-blue-400">
            ←
          </div>
        )}
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
    ? '' // Empty for "always" conditions - will be added later using condition nodes
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
      {conditionText && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '3px',
              padding: '1px 4px',
              fontSize: '9px',
              fontWeight: '400',
              color: '#94a3b8',
              pointerEvents: 'all',
              cursor: 'pointer',
              zIndex: 1000,
              opacity: 0.8,
            }}
            className="hover:opacity-100 hover:border-sky-500"
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
      )}
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
    console.log('Raw steps data from backend:', JSON.stringify(stepsData, null, 2));
    console.log('Response status:', stepsResponse.status, stepsResponse.ok);
    
    // Handle different response formats for steps
    let stepsArray: any[] = [];
    if (stepsData.success !== undefined && stepsData.data) {
      stepsArray = stepsData.data;
    } else if (Array.isArray(stepsData)) {
      stepsArray = stepsData;
    } else if (stepsData.data && Array.isArray(stepsData.data)) {
      stepsArray = stepsData.data;
    }
    
    console.log('Steps array before filtering:', stepsArray.map((s: any) => ({ id: s.id, flow_id: s.flow_id, step_type: s.step_type, extra_step: s.extra_step })));
    
    // Filter steps for this flow and sort by order_index
    const flowSteps = stepsArray
      .filter((step: any) => step.flow_id === flowId)
      .sort((a: any, b: any) => a.order_index - b.order_index)
      .map((step: any) => ({
        ...step,
        // Add UI-specific fields - use step_type for type, not order_index
        // Map backend step_type to UI type
        type: (() => {
          // If step_type is "processing" and extra_step is 1, it's a response node (backward compatibility)
          if (step.step_type === 'processing' && step.extra_step === 1) {
            console.log(`Step ${step.id}: Backward compatibility - processing with extra_step=1 -> response`);
            return 'response';
          }
          // Otherwise use step_type directly
          const result = step.step_type || (step.order_index === 1 ? 'input' : step.order_index === stepsArray.length ? 'output' : 'default');
          console.log(`Step ${step.id}: step_type="${step.step_type}", extra_step=${step.extra_step}, mapped to type="${result}"`);
          return result;
        })(),
        description: step.instructions.substring(0, 100) + (step.instructions.length > 100 ? '...' : ''),
      })) as Step[];
    
    console.log('Fetched flow steps with types:', flowSteps.map(s => ({ id: s.id, title: s.title, step_type: s.step_type, type: s.type, extra_step: s.extra_step })));
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
    console.log('Saving flow steps:', { flowId, steps: steps.map(s => ({ id: s.id, title: s.title, step_type: s.step_type, extra_step: s.extra_step, instructions: s.instructions })) });
    
    // Example: Update each step
    for (const step of steps) {
      const requestBody = {
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
        extra_step: step.extra_step || 0,
        page_key: step.page_key || null,
      };
      console.log(`Saving step ${step.id}:`, JSON.stringify(requestBody, null, 2));
      
      const response = await fetch(`/api/proxy/api/flow-steps/${step.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        console.error(`Failed to update step ${step.id}:`, response.status);
        const errorText = await response.text();
        console.error('Error response:', errorText);
        return false;
      } else {
        console.log(`Step ${step.id} saved successfully`);
        // Log the response to see what the backend returned
        try {
          const responseData = await response.json();
          console.log(`Step ${step.id} response:`, JSON.stringify(responseData, null, 2));
        } catch (e) {
          console.log(`Step ${step.id} saved but no JSON response`);
        }
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
        blocking: Boolean(stepData.blocking || 0),
        auto_fail_on_error: Boolean(stepData.auto_fail_on_error || 0),
        retryable: Boolean(stepData.retryable || 0),
        output_keys: stepData.output_keys || '',
        input_keys: stepData.input_keys || '',
        output: Boolean(stepData.output || 0),
        requires_task: Boolean(stepData.requires_task || 0),
      }),
    });
    
    if (!response.ok) {
      console.error('Failed to create step:', response.status);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return null;
    }
    
    const data = await response.json();
    console.log('Create step response:', data);
    return data.data || data;
  } catch (error) {
    console.error('Error creating step:', error);
    return null;
  }
}

// Create nodes from step data
function createNodesFromSteps(steps: Step[]) {
  console.log('Creating nodes from steps:', steps.map(s => ({ id: s.id, title: s.title, step_type: s.step_type, type: s.type })));
  return steps.map((step, index) => {
    // Determine node type based on step_type
    let nodeType: 'input' | 'default' | 'output' | 'response' | 'flow' | 'condition' = 'default';
    if (step.step_type === 'input' || step.type === 'input') {
      nodeType = 'input';
    } else if (step.step_type === 'output' || step.type === 'output') {
      nodeType = 'output';
    } else if (step.step_type === 'flow' || step.step_type === 'agent') {
      nodeType = 'flow';
    } else if (step.step_type === 'response' || step.type === 'response') {
      nodeType = 'response';
    } else if (step.step_type === 'condition') {
      nodeType = 'condition';
    } else if (step.step_type === 'processing' && step.extra_step === 1) {
      // Backward compatibility: processing steps with extra_step=1 are response nodes
      nodeType = 'response';
    }
    
    console.log(`Step ${step.id}: step_type=${step.step_type}, type=${step.type}, nodeType=${nodeType}`);
    
    return {
      id: step.id,
      type: nodeType as 'input' | 'default' | 'output' | 'response' | 'flow' | 'condition',
      data: { 
        label: step.title, 
        title: step.title,
        step,
        instructions: step.instructions,
        command: step.command || '',
        await_input: step.await_input || false,
        type: nodeType as 'input' | 'default' | 'output' | 'response' | 'flow' | 'condition', // Use the mapped nodeType for UI consistency
      },
      position: { x: 250, y: 25 + (index * 150) }, // Increased spacing from 100 to 150px
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
  const edges: CustomEdge[] = [];
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
  edge: CustomEdge;
  nodes: CustomNode[];
  onSave: (edge: CustomEdge) => void;
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
  
  // Get all nodes for variable selection (for cross-step conditions)
  const allSteps = nodes.map(n => n.data?.step as Step | undefined).filter(Boolean);
  
  // Collect variables from all steps for cross-step conditions
  const allVariables: Array<{value: string, label: string, category: string, stepId: string}> = [];
  
  allSteps.forEach(step => {
    if (!step) return;
    
    // Add output variables from this step
    if (step.output_keys) {
      const vars = step.output_keys.split(',').map(key => key.trim()).filter(key => key);
      vars.forEach(variable => {
        allVariables.push({
          value: `step_${step.id}.output.${variable}`,
          label: `${step.title}: ${variable}`,
          category: 'step_output',
          stepId: step.id
        });
      });
    }
    
    // Add input variables from this step
    if (step.input_keys) {
      const vars = step.input_keys.split(',').map(key => key.trim()).filter(key => key);
      vars.forEach(variable => {
        allVariables.push({
          value: `step_${step.id}.input.${variable}`,
          label: `${step.title} (input): ${variable}`,
          category: 'step_input',
          stepId: step.id
        });
      });
    }
    
    // Add AI response variables (if step has AI output)
    if (step.step_type === 'ai' || step.step_type === 'response') {
      allVariables.push({
        value: `step_${step.id}.ai_response`,
        label: `${step.title}: AI Response`,
        category: 'ai_response',
        stepId: step.id
      });
      allVariables.push({
        value: `step_${step.id}.ai_intent`,
        label: `${step.title}: AI Intent`,
        category: 'ai_intent',
        stepId: step.id
      });
    }
  });
  
  // Group variables by category for better organization
  const groupedVariables = {
    ai_responses: allVariables.filter(v => v.category === 'ai_response'),
    ai_intents: allVariables.filter(v => v.category === 'ai_intent'),
    step_outputs: allVariables.filter(v => v.category === 'step_output'),
    step_inputs: allVariables.filter(v => v.category === 'step_input'),
  };
  
  const sourceOptions = [
    { value: 'default', label: 'Always (no condition)', category: 'system' },
    { value: 'loop_complete', label: 'Loop Complete', category: 'system' },
    { value: 'max_iterations_reached', label: 'Max Iterations Reached', category: 'system' },
    { value: 'condition_met', label: 'Condition Met', category: 'system' },
    { value: 'error_occurred', label: 'Error Occurred', category: 'system' },
    { value: 'inputs.approval', label: 'Input: Approval', category: 'input' },
    { value: 'inputs.status', label: 'Input: Status', category: 'input' },
    { value: 'data.user_id', label: 'Data: User ID', category: 'data' },
    { value: 'command.get_tasks.result', label: 'Command: Get Tasks Result', category: 'command' },
    { value: 'ai_output.intent', label: 'AI Output: Intent', category: 'ai' },
    ...sourceVariables.map(variable => ({
      value: `variables.${variable}`,
      label: `Variable: ${variable}`,
      category: 'variable'
    }))
  ];

  const operatorOptions = [
    { value: 'always', label: 'Always' },
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Does Not Contain' },
    { value: 'starts_with', label: 'Starts With' },
    { value: 'ends_with', label: 'Ends With' },
    { value: 'greater_than', label: 'Greater Than' },
    { value: 'less_than', label: 'Less Than' },
    { value: 'greater_than_or_equal', label: 'Greater Than or Equal' },
    { value: 'less_than_or_equal', label: 'Less Than or Equal' },
    { value: 'is_empty', label: 'Is Empty' },
    { value: 'is_not_empty', label: 'Is Not Empty' },
    { value: 'is_true', label: 'Is True' },
    { value: 'is_false', label: 'Is False' },
    { value: 'matches_regex', label: 'Matches Regex' },
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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-800 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-white">Edge Condition</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-lg"
          >
            ×
          </button>
        </div>
        
        <div className="space-y-5">
          {/* Source */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Condition Source
            </label>
            <div className="mb-3">
              <div className="text-xs text-gray-500 mb-2">System Conditions</div>
              <select
                value={condition.source}
                onChange={(e) => setCondition({...condition, source: e.target.value})}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors mb-3"
              >
                <optgroup label="System Conditions">
                  {sourceOptions.filter(opt => opt.category === 'system').map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Input Conditions">
                  {sourceOptions.filter(opt => opt.category === 'input').map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="AI Conditions">
                  {sourceOptions.filter(opt => opt.category === 'ai').map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Command Conditions">
                  {sourceOptions.filter(opt => opt.category === 'command').map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Data Conditions">
                  {sourceOptions.filter(opt => opt.category === 'data').map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Current Step Variables">
                  {sourceOptions.filter(opt => opt.category === 'variable').map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
            
            {/* Advanced Variable Browser */}
            <div className="mt-5">
              <div className="text-xs text-gray-500 mb-2">Cross-Step Variables</div>
              <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-3 max-h-40 overflow-y-auto">
                {groupedVariables.ai_responses.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs text-yellow-400 font-medium mb-2">AI Responses</div>
                    {groupedVariables.ai_responses.map(variable => (
                      <div 
                        key={variable.value}
                        className="text-xs text-gray-300 px-3 py-2 hover:bg-gray-700/50 rounded-lg cursor-pointer mb-1 transition-colors"
                        onClick={() => setCondition({...condition, source: variable.value})}
                      >
                        {variable.label}
                      </div>
                    ))}
                  </div>
                )}
                
                {groupedVariables.ai_intents.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs text-blue-400 font-medium mb-2">AI Intents</div>
                    {groupedVariables.ai_intents.map(variable => (
                      <div 
                        key={variable.value}
                        className="text-xs text-gray-300 px-3 py-2 hover:bg-gray-700/50 rounded-lg cursor-pointer mb-1 transition-colors"
                        onClick={() => setCondition({...condition, source: variable.value})}
                      >
                        {variable.label}
                      </div>
                    ))}
                  </div>
                )}
                
                {groupedVariables.step_outputs.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs text-green-400 font-medium mb-2">Step Outputs</div>
                    {groupedVariables.step_outputs.map(variable => (
                      <div 
                        key={variable.value}
                        className="text-xs text-gray-300 px-3 py-2 hover:bg-gray-700/50 rounded-lg cursor-pointer mb-1 transition-colors"
                        onClick={() => setCondition({...condition, source: variable.value})}
                      >
                        {variable.label}
                      </div>
                    ))}
                  </div>
                )}
                
                {groupedVariables.step_inputs.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs text-purple-400 font-medium mb-2">Step Inputs</div>
                    {groupedVariables.step_inputs.map(variable => (
                      <div 
                        key={variable.value}
                        className="text-xs text-gray-300 px-3 py-2 hover:bg-gray-700/50 rounded-lg cursor-pointer mb-1 transition-colors"
                        onClick={() => setCondition({...condition, source: variable.value})}
                      >
                        {variable.label}
                      </div>
                    ))}
                  </div>
                )}
                
                {allVariables.length === 0 && (
                  <div className="text-xs text-gray-500 text-center py-3">
                    No variables available. Add variables to steps first.
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Click on a variable to select it as condition source
              </div>
            </div>
          </div>

          {/* Operator */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Operator
            </label>
            <select
              value={condition.operator}
              onChange={(e) => setCondition({...condition, operator: e.target.value})}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
            >
              {operatorOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Value (if needed) */}
          {condition.operator !== 'always' && 
           condition.operator !== 'is_empty' && 
           condition.operator !== 'is_not_empty' &&
           condition.operator !== 'is_true' &&
           condition.operator !== 'is_false' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {condition.operator === 'matches_regex' ? 'Regular Expression' : 'Value'}
              </label>
              <input
                type="text"
                value={condition.value || ''}
                onChange={(e) => setCondition({...condition, value: e.target.value})}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                placeholder={
                  condition.operator === 'matches_regex' ? 'Enter regex pattern...' :
                  condition.operator === 'contains' ? 'Enter text to check for...' :
                  'Enter value or use {{variable}}...'
                }
              />
              <div className="text-xs text-gray-500 mt-2">
                {condition.operator === 'matches_regex' ? (
                  <>Use regex patterns like <code className="bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700">^success$</code> or <code className="bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700">error.*</code></>
                ) : (
                  <>Use <code className="bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700">{"{{variable}}"}</code> syntax for variables from previous steps</>
                )}
              </div>
            </div>
          )}

          {/* Target */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Target Step
            </label>
            <select
              value={route.target_id}
              onChange={(e) => setRoute({...route, target_id: e.target.value})}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
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
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Route Type
            </label>
            <select
              value={route.type}
              onChange={(e) => setRoute({...route, type: e.target.value as any})}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
            >
              <option value="step">Step</option>
              <option value="flow">Flow (Agent)</option>
              <option value="end">End</option>
            </select>
          </div>

          {/* Context Preservation */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Context Preservation
            </label>
            <select
              value={route.context_preservation || 'full'}
              onChange={(e) => setRoute({...route, context_preservation: e.target.value as any})}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
            >
              <option value="full">Full Context</option>
              <option value="partial">Partial Context</option>
              <option value="none">No Context</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-800">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 text-sm font-medium border border-gray-700 transition-colors"
          >
            Save Condition
          </button>
        </div>
      </div>
    </div>
  );
};

// Unified popup modal component for all nodes (steps and conditions)
const NodePopup = ({ 
  node, 
  availableVariables,
  onSave, 
  onClose 
}: { 
  node: CustomNode;
  availableVariables: string[];
  onSave: (node: CustomNode) => void;
  onClose: () => void;
}) => {
  const nodeData = node.data as NodeData;
  const [instructions, setInstructions] = useState<string>(typeof nodeData?.instructions === 'string' ? nodeData.instructions : '');
  const [outputKeys, setOutputKeys] = useState<string>(typeof nodeData?.step?.output_keys === 'string' ? nodeData.step.output_keys : '');
  const [selectedCommand, setSelectedCommand] = useState<string>('');
  const [availableCommands, setAvailableCommands] = useState<Array<{name: string, description: string, parameters: any}>>([]);
  const [loadingCommands, setLoadingCommands] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const outputKeysRef = useRef<HTMLInputElement>(null);
  
  // Fetch available commands from API
  useEffect(() => {
    const fetchCommands = async () => {
      try {
        setLoadingCommands(true);
        const response = await fetch('/api/proxy/api/commands');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.commands) {
            setAvailableCommands(data.data.commands);
          }
        }
      } catch (error) {
        console.error('Failed to fetch commands:', error);
      } finally {
        setLoadingCommands(false);
      }
    };
    
    fetchCommands();
  }, []);
  
  // Get parameters for selected command
  const getCommandParameters = () => {
    if (!selectedCommand) return [];
    
    const command = availableCommands.find(cmd => cmd.name === selectedCommand);
    if (!command || !command.parameters) return [];
    
    try {
      const params = JSON.parse(command.parameters);
      if (params.properties) {
        return Object.keys(params.properties);
      }
    } catch (e) {
      console.error('Failed to parse command parameters:', e);
    }
    
    return [];
  };
  
  const commandParameters = getCommandParameters();
  
  console.log('NodePopup rendered! nodeData?.instructions:', nodeData?.instructions, 'instructions state:', instructions);

  const handleSave = () => {
    // Read from DOM refs to bypass React state timing issues with automation
    const domInstructions = textareaRef.current?.value || '';
    const domOutputKeys = outputKeysRef.current?.value || '';
    
    console.log('NodePopup handleSave called!');
    console.log('State instructions:', instructions, 'DOM instructions:', domInstructions);
    console.log('State outputKeys:', outputKeys, 'DOM outputKeys:', domOutputKeys);
    console.log('nodeData:', nodeData);
    
    const currentStep = nodeData?.step;
    const updatedNode = {
      ...node,
      data: {
        ...nodeData,
        instructions: domInstructions, // Use DOM value
        step: currentStep ? {
          ...currentStep,
          instructions: domInstructions, // Use DOM value
          output_keys: domOutputKeys, // Use DOM value
        } : {
          // Create a minimal step object if it doesn't exist
          id: node.id || `step-${Date.now()}`,
          flow_id: '',
          step_key: '',
          title: nodeData?.title || 'Untitled Step',
          instructions: domInstructions, // Use DOM value
          step_type: 'default',
          order_index: 0,
          blocking: 0,
          auto_fail_on_error: 0,
          retryable: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          task_id: null,
          output_keys: domOutputKeys, // Use DOM value
          output_url: null,
          output_payload_template: null,
          default_next_step: null,
          output_auth_token: null,
          input_keys: null,
          output: 0,
          default_next_step_id: null,
          step_number: null,
          requires_task: 0,
          use_endpoints: null,
          extra_step: 0,
          page_key: null,
        },
      },
    };
    console.log('Updated node to save:', JSON.stringify(updatedNode, null, 2));
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
      <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg p-4 w-full max-w-lg border border-gray-700 shadow-lg">
        {/* Minimal header with just close button */}
        <div className="flex justify-end mb-3">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-lg"
            title="Close"
          >
            ×
          </button>
        </div>
        
        <div className="space-y-4">
          {/* Instructions/condition text area - minimal */}
          <div>
            <textarea
              ref={textareaRef}
              value={instructions || ''}
              onChange={(e) => setInstructions(e.target.value)}
              onInput={(e) => setInstructions(e.currentTarget.value)}
              onDragOver={onInstructionsDragOver}
              onDrop={onInstructionsDrop}
              className="w-full bg-gray-800/50 border border-gray-600 rounded px-3 py-2 text-white min-h-[100px] font-mono text-sm focus:border-blue-500 focus:outline-none transition-colors"
              placeholder={nodeData?.type === 'condition' ? 'Enter condition (e.g., {{variable}} == "success")' : 'Enter instructions...'}
              autoFocus
            />
          </div>

          {/* Command Selector */}
          <div>
            <select
              value={selectedCommand}
              onChange={(e) => setSelectedCommand(e.target.value)}
              className="w-full bg-gray-800/50 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none transition-colors"
              disabled={loadingCommands}
            >
              <option value="">Select a command...</option>
              {availableCommands.map((cmd) => (
                <option key={cmd.name} value={cmd.name}>
                  {cmd.name} - {cmd.description}
                </option>
              ))}
            </select>
            {loadingCommands && (
              <div className="text-xs text-gray-400 mt-1">Loading commands...</div>
            )}
          </div>

          {/* Command Parameters - only show when command is selected */}
          {selectedCommand && commandParameters.length > 0 && (
            <div>
              <div className="text-xs text-gray-400 mb-1">
                Parameters for {selectedCommand}:
              </div>
              <div className="flex flex-wrap gap-1">
                {commandParameters.map((param, index) => (
                  <div 
                    key={index}
                    className="inline-flex items-center bg-gray-800/50 border border-gray-600 rounded px-2 py-1 cursor-grab active:cursor-grabbing hover:bg-gray-700/50 transition-colors text-xs"
                    draggable
                    onDragStart={(e) => onVariableDragStart(e, param)}
                    title={`Drag {{${param}}} into text`}
                  >
                    <div className="text-gray-400 mr-1 text-xs">📦</div>
                    <div className="text-white font-mono">{`{{${param}}}`}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Output Variables - minimal */}
          <div>
            <input
              ref={outputKeysRef}
              type="text"
              value={outputKeys || ''}
              onChange={(e) => setOutputKeys(e.target.value)}
              onInput={(e) => setOutputKeys(e.currentTarget.value)}
              className="w-full bg-gray-800/50 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none transition-colors"
              placeholder="Output variables (comma separated)"
            />
          </div>

          {/* Minimal save button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSave}
              className="px-3 py-1.5 bg-blue-600/80 hover:bg-blue-600 text-white rounded text-sm transition-colors"
            >
              Save
            </button>
          </div>
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
  const [nodes, setNodes] = useState<CustomNode[]>([]);
  const [edges, setEdges] = useState<CustomEdge[]>([]);
  const [selectedEdge, setSelectedEdge] = useState<CustomEdge | null>(null);
  const [selectedNode, setSelectedNode] = useState<CustomNode | null>(null);
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    console.log('saving state changed:', saving);
  }, [saving]);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  
  // State for modals
  const [showEditFlowModal, setShowEditFlowModal] = useState(false);
  const [showCreateFlowModal, setShowCreateFlowModal] = useState(false);
  
  // Drag and drop state
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<CustomNode, CustomEdge> | null>(null);
  const [draggingNodeType, setDraggingNodeType] = useState<string | null>(null);
  
  // Add node menu state
  const [addNodeMenu, setAddNodeMenu] = useState<{
    show: boolean;
    sourceNodeId: string | null;
    position: { x: number; y: number };
  }>({
    show: false,
    sourceNodeId: null,
    position: { x: 0, y: 0 },
  });

  // State for empty flow + button
  const [showEmptyFlowButton, setShowEmptyFlowButton] = useState(false);
  
  // Load flow data on mount
  useEffect(() => {
    loadFlowData();
  }, [currentFlowId]);

  // Close add node menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addNodeMenu.show) {
        setAddNodeMenu({ show: false, sourceNodeId: null, position: { x: 0, y: 0 } });
      }
    };

    if (addNodeMenu.show) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [addNodeMenu.show]);
  
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
        
        // Show empty flow button if no steps
        setShowEmptyFlowButton(flowSteps.length === 0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load flow data');
      console.error('Error loading flow data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Node types configuration with onClick handler
  const nodeTypes = useMemo(() => ({
    default: (props: any) => {
      const handleClick = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          setSelectedNode(node);
        }
      };
      
      const handleAddNode = (nodeId: string, event: React.MouseEvent) => {
        event.stopPropagation();
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          setAddNodeMenu({
            show: true,
            sourceNodeId: nodeId,
            position: { x: event.clientX, y: event.clientY },
          });
        }
      };
      
      return <CustomNode {...props} onClick={handleClick} onAddNode={handleAddNode} />;
    },
    input: (props: any) => {
      const handleClick = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          setSelectedNode(node);
        }
      };
      
      const handleAddNode = (nodeId: string, event: React.MouseEvent) => {
        event.stopPropagation();
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          setAddNodeMenu({
            show: true,
            sourceNodeId: nodeId,
            position: { x: event.clientX, y: event.clientY },
          });
        }
      };
      
      return <CustomNode {...props} onClick={handleClick} onAddNode={handleAddNode} />;
    },
    output: (props: any) => {
      const handleClick = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          setSelectedNode(node);
        }
      };
      
      const handleAddNode = (nodeId: string, event: React.MouseEvent) => {
        event.stopPropagation();
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          setAddNodeMenu({
            show: true,
            sourceNodeId: nodeId,
            position: { x: event.clientX, y: event.clientY },
          });
        }
      };
      
      return <CustomNode {...props} onClick={handleClick} onAddNode={handleAddNode} />;
    },
    response: (props: any) => {
      const handleClick = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          setSelectedNode(node);
        }
      };
      
      const handleAddNode = (nodeId: string, event: React.MouseEvent) => {
        event.stopPropagation();
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          setAddNodeMenu({
            show: true,
            sourceNodeId: nodeId,
            position: { x: event.clientX, y: event.clientY },
          });
        }
      };
      
      return <CustomNode {...props} onClick={handleClick} onAddNode={handleAddNode} />;
    },
    condition: (props: any) => {
      const handleClick = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          setSelectedNode(node);
        }
      };
      
      const handleAddNode = (nodeId: string, event: React.MouseEvent) => {
        event.stopPropagation();
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          setAddNodeMenu({
            show: true,
            sourceNodeId: nodeId,
            position: { x: event.clientX, y: event.clientY },
          });
        }
      };
      
      return <CustomNode {...props} onClick={handleClick} onAddNode={handleAddNode} />;
    },
    flow: (props: any) => {
      const handleClick = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          setSelectedNode(node);
        }
      };
      
      return <FlowNode {...props} onClick={handleClick} />;
    },
  }), [nodes]);

  // Edge types configuration with onClick handler
  const edgeTypes = useMemo(() => ({
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
    (changes: NodeChange[]) => {
      setNodes((nds) => {
        const newNodes = applyNodeChanges(changes, nds);
        
        // Clean up edges connected to deleted nodes
        const deletedNodeIds = changes
          .filter(change => change.type === 'remove')
          .map(change => change.id);
        
        if (deletedNodeIds.length > 0) {
          setEdges(prevEdges => 
            prevEdges.filter(edge => 
              !deletedNodeIds.includes(edge.source) && 
              !deletedNodeIds.includes(edge.target)
            )
          );
        }
        
        return newNodes;
      });
    },
    []
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds) as CustomEdge[]),
    []
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge: CustomEdge = {
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

  const handleEdgeUpdate = useCallback((updatedEdge: CustomEdge) => {
    setEdges((eds) => eds.map(edge => 
      edge.id === updatedEdge.id ? updatedEdge : edge
    ));
  }, []);

  const handleNodeUpdate = useCallback((updatedNode: CustomNode) => {
    console.log('handleNodeUpdate called!', updatedNode.id, updatedNode.data.type);
    console.log('Updated node data:', JSON.stringify(updatedNode.data, null, 2));
    setNodes((nds) => nds.map(node => 
      node.id === updatedNode.id ? updatedNode : node
    ));
  }, []);

  const onSaveFlow = useCallback(async () => {
    console.log('onSaveFlow called!');
    try {
      console.log('Setting saving to true');
      setSaving(true);
      console.log('saving should be true now');
      // Convert nodes back to steps
      console.log('Nodes:', nodes.map(n => ({ id: n.id, type: n.data.type, instructions: n.data.instructions, step: n.data.step })));
      const updatedSteps: Step[] = nodes.map((node): Step => {
        const nodeData = node.data as NodeData;
        const step = nodeData.step as Step;
        const nodeTitle = nodeData.title;
        const nodeInstructions = nodeData.instructions;
        const nodeStepType = nodeData.step?.step_type;
        const nodeType = nodeData.type;
        
        console.log(`Processing node ${node.id}: nodeInstructions="${nodeInstructions}", step.instructions="${step.instructions}", nodeType="${nodeType}"`);
        
        // Map UI type to step_type
        let finalStepType = typeof nodeStepType === 'string' ? nodeStepType : step.step_type;
        let extraStep = step.extra_step || 0;
        // Always use nodeType if available to ensure UI changes are saved
        if (nodeType) {
          // Map UI type to step_type
          if (nodeType === 'response') {
            finalStepType = 'response'; // Backend now accepts 'response' as step_type
            extraStep = 0; // No longer need extra_step hack
            console.log('Response node detected! Setting step_type to "response"');
          } else if (nodeType === 'input') {
            finalStepType = 'input';
          } else if (nodeType === 'output') {
            finalStepType = 'output';
          } else {
            finalStepType = 'default';
          }
        }
        
        return {
          ...step,
          title: typeof nodeTitle === 'string' ? nodeTitle : step.title,
          instructions: typeof nodeInstructions === 'string' ? nodeInstructions : step.instructions,
          step_type: finalStepType,
          extra_step: extraStep,
          // Update input/output keys from node data if available
          input_keys: step.input_keys || null,
          output_keys: step.output_keys || '',
        };
      });
      
      // Save to backend
      console.log('Saving steps:', updatedSteps);
      const success = await saveFlowSteps(currentFlowId, updatedSteps);
      
      if (success) {
        console.log(`Flow saved successfully with ${nodes.length} steps`);
        // Reload data to ensure we have latest
        await loadFlowData();
      } else {
        console.error('Failed to save flow. Check console for errors.');
      }
      console.log('Setting saving to false');
      setSaving(false);
    } catch (err) {
      console.error('Error saving flow:', err);
      alert('Error saving flow. See console for details.');
      console.log('Setting saving to false (error case)');
      setSaving(false);
    }
  }, [nodes, currentFlowId, setSaving, loadFlowData]);

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
      const newNode: CustomNode = {
        id: newStep.id,
        type: 'default' as 'input' | 'default' | 'output' | 'response' | 'flow' | 'condition',
        data: {
          label: newStep.title,
          title: newStep.title,
          type: 'default' as 'input' | 'default' | 'output' | 'response' | 'flow' | 'condition',
          step: newStep,
          instructions: newStep.instructions,
          command: '',
          await_input: false,
          variables: [],
        },
        position: { x: maxX + 400, y: maxY + 150 }, // Increased spacing for new nodes
      };
      
      // Add new node to the flow
      setNodes(prevNodes => [...prevNodes, newNode]);
      
      // If there are existing nodes, create an edge from the last node to the new one
      if (nodes.length > 0) {
        const lastNode = nodes[nodes.length - 1];
        const newEdge: CustomEdge = {
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

  // Function to add a new node from a source node
  const handleAddNodeFromSource = useCallback(async (sourceNodeId: string, nodeType: 'step' | 'response' | 'condition', dropPosition?: { x: number, y: number }) => {
    try {
      // Find source node
      const sourceNode = nodes.find(n => n.id === sourceNodeId);
      if (!sourceNode) {
        console.error('Source node not found:', sourceNodeId);
        return;
      }

      // Calculate position for new node
      let newPosition;
      if (dropPosition && reactFlowInstance) {
        // Use drop position (converted from screen to flow coordinates)
        newPosition = reactFlowInstance.screenToFlowPosition({
          x: dropPosition.x,
          y: dropPosition.y,
        });
      } else {
        // Default: to the right of source node
        newPosition = {
          x: sourceNode.position.x + 300,
          y: sourceNode.position.y,
        };
      }

      // Determine step type and title based on nodeType
      let stepType = 'default';
      let stepTitle = '';
      
      if (nodeType === 'response') {
        stepType = 'response';
        stepTitle = `Response Node ${nodes.length + 1}`;
      } else if (nodeType === 'condition') {
        stepType = 'condition';
        stepTitle = `Condition ${nodes.length + 1}`;
      } else {
        stepType = 'default';
        stepTitle = `Step ${nodes.length + 1}`;
      }

      // Create new step data
      const newStepData: Partial<Step> = {
        title: stepTitle,
        instructions: nodeType === 'condition' ? 'Condition expression...' : 'New step instructions...',
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
      const newNode: CustomNode = {
        id: newStep.id,
        type: (nodeType === 'step' ? 'default' : nodeType) as 'input' | 'default' | 'output' | 'response' | 'flow' | 'condition',
        data: {
          label: newStep.title,
          title: newStep.title,
          type: (nodeType === 'step' ? 'default' : nodeType) as 'input' | 'default' | 'output' | 'response' | 'flow' | 'condition',
          step: {
            ...newStep,
            type: stepType as 'input' | 'default' | 'output' | 'response' | 'condition',
          },
          instructions: newStep.instructions,
          command: '',
          await_input: false,
          variables: [],
        },
        position: newPosition,
      };
      
      // Add new node to the flow
      setNodes(prevNodes => [...prevNodes, newNode]);
      
      // Create edge from source to new node
      const newEdge: CustomEdge = {
        id: `e${sourceNodeId}-${newStep.id}`,
        source: sourceNodeId,
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
      
      // Select the new node to open the step popup
      setSelectedNode(newNode);
      
      // Close the menu
      setAddNodeMenu({ show: false, sourceNodeId: null, position: { x: 0, y: 0 } });
      
    } catch (error) {
      console.error('Error adding new node from source:', error);
      alert('Error adding new node. See console for details.');
    }
  }, [nodes, currentFlowId]);

  // Function to create first step in empty flow
  const handleCreateFirstStep = useCallback(async () => {
    try {
      // Create new step data
      const newStepData: Partial<Step> = {
        title: 'Step 1',
        instructions: 'Enter instructions for the first step...',
        step_type: 'default',
        order_index: 1,
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
        alert('Failed to create first step. Check console for errors.');
        return;
      }
      
      // Create new node for the step
      const newNode: CustomNode = {
        id: newStep.id,
        type: 'default' as 'input' | 'default' | 'output' | 'response' | 'flow' | 'condition',
        data: {
          label: newStep.title,
          title: newStep.title,
          type: 'default' as 'input' | 'default' | 'output' | 'response' | 'flow' | 'condition',
          step: {
            ...newStep,
            type: 'default' as 'input' | 'default' | 'output' | 'response' | 'condition',
          },
          instructions: newStep.instructions,
          command: '',
          await_input: false,
          variables: [],
        },
        position: { x: 400, y: 300 }, // Center position
      };
      
      // Add new node to the flow
      setNodes([newNode]);
      setEdges([]);
      
      // Hide empty flow button
      setShowEmptyFlowButton(false);
      
      // Select the new node to open the step popup
      setSelectedNode(newNode);
      
      // Update flow steps
      setFlowSteps(prev => [...prev, newStep]);
      
    } catch (error) {
      console.error('Error creating first step:', error);
      alert('Error creating first step. See console for details.');
    }
  }, [currentFlowId]);

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
      } else if (nodeType === 'response') {
        stepTitle = `Response Node ${nodes.length + 1}`;
        stepType = 'response';
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
      const newNode: CustomNode = {
        id: newStep.id,
        type: nodeType as 'input' | 'default' | 'output' | 'response' | 'flow' | 'condition',
        data: {
          label: newStep.title,
          title: newStep.title,
          type: nodeType as 'input' | 'default' | 'output' | 'response' | 'flow' | 'condition',
          step: {
            ...newStep,
            type: stepType as 'input' | 'default' | 'output' | 'response' | 'condition',
          },
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
  const onInit = useCallback((instance: ReactFlowInstance<CustomNode, CustomEdge>) => {
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
              type="button"
              onClick={async () => {
                console.log('Save Flow button clicked!');
                console.log('onSaveFlow:', onSaveFlow);
                console.log('typeof onSaveFlow:', typeof onSaveFlow);
                if (typeof onSaveFlow === 'function') {
                  console.log('Calling onSaveFlow...');
                  try {
                    await onSaveFlow();
                    console.log('onSaveFlow completed!');
                  } catch (err) {
                    console.error('Error in onSaveFlow:', err);
                  }
                } else {
                  console.error('onSaveFlow is not a function!');
                }
              }}
              className="bg-gray-800 hover:bg-gray-700 px-5 py-1.5 rounded-lg font-medium text-gray-200 hover:text-white transition-colors border border-gray-700"
            >
              {saving ? 'Saving...' : 'Save Flow'}
            </button>
            <div className="text-xs text-gray-500 mt-1">saving state: {saving ? 'true' : 'false'}</div>
            <button
              onClick={() => router.push('/chat')}
              className="bg-gray-800 hover:bg-gray-700 px-5 py-1.5 rounded-lg font-medium border border-gray-700 text-gray-200 hover:text-white transition-colors"
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
        <div className="flex-1 relative">
          <div 
            ref={reactFlowWrapper}
            className="w-full h-[700px] bg-gray-900 rounded-lg border border-gray-800"
            onDragOver={onDragOver}
            onDrop={onDrop}
          >
            {/* Empty Flow Button */}
            {showEmptyFlowButton && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <button
                  onClick={handleCreateFirstStep}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-full w-16 h-16 flex items-center justify-center text-2xl font-bold shadow-lg transition-all hover:scale-110"
                  title="Create first step"
                >
                  +
                </button>
                <div className="absolute bottom-1/4 text-center text-gray-400 text-sm mt-4">
                  Click + to create your first step
                </div>
              </div>
            )}
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onInit={onInit}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }}
              onDrop={(e) => {
                e.preventDefault();
                const sourceNodeId = e.dataTransfer.getData('application/node-add');
                if (sourceNodeId && reactFlowInstance) {
                  const position = reactFlowInstance.screenToFlowPosition({
                    x: e.clientX,
                    y: e.clientY,
                  });
                  // Show menu at drop position
                  setAddNodeMenu({
                    show: true,
                    sourceNodeId: sourceNodeId,
                    position: { x: e.clientX, y: e.clientY },
                  });
                }
              }}
              fitView
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={0.5} color="#334155" />
              <Controls />
              <MiniMap 
                style={{ backgroundColor: '#0f172a' }}
                nodeColor={(node) => {
                  if (node.type === 'input') return '#0f172a'; // slate-900
                  if (node.type === 'output') return '#0f172a'; // slate-900
                  if (node.type === 'response') return '#0f172a'; // slate-900
                  if (node.type === 'condition') return '#0f172a'; // slate-900
                  return '#0f172a'; // default dark
                }}
                nodeStrokeColor={(node) => {
                  if (node.type === 'input') return '#0ea5e9'; // sky-500
                  if (node.type === 'output') return '#8b5cf6'; // violet-500
                  if (node.type === 'response') return '#f59e0b'; // amber-500
                  if (node.type === 'condition') return '#3b82f6'; // blue-500
                  return '#334155'; // default border
                }}
              />
              {/* Node Toolbar REMOVED - All nodes added via edge drop */}

              <Panel position="top-right" className="bg-gray-900/60 backdrop-blur-sm rounded-lg p-3 border border-gray-800">
                <div className="text-sm text-gray-300">
                  <div className="font-medium mb-1">Flow Controls</div>
                  <div className="text-xs text-gray-400 space-y-0.5">
                    <div>• Drag nodes to reposition</div>
                    <div>• Drag + button to create new nodes</div>
                    <div>• Connect nodes via handles</div>
                    <div>• Click edge labels to edit</div>
                  </div>
                </div>
              </Panel>
            </ReactFlow>
          </div>
        </div>

        {/* Add Node Menu */}
        {addNodeMenu.show && addNodeMenu.sourceNodeId && (
          <div 
            className="fixed z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-lg p-2 min-w-[160px]"
            style={{
              left: addNodeMenu.position.x,
              top: addNodeMenu.position.y,
            }}
          >
            <div className="text-xs text-gray-400 mb-1 px-2 pt-1">Add from node:</div>
            <button
              onClick={() => handleAddNodeFromSource(addNodeMenu.sourceNodeId!, 'step', addNodeMenu.position)}
              className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded-md flex items-center"
            >
              <span className="mr-2">+</span>
              Add Step
            </button>
            <button
              onClick={() => handleAddNodeFromSource(addNodeMenu.sourceNodeId!, 'response', addNodeMenu.position)}
              className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded-md flex items-center"
            >
              <span className="mr-2 text-yellow-400">🔄</span>
              Add Response
            </button>
            <button
              onClick={() => handleAddNodeFromSource(addNodeMenu.sourceNodeId!, 'condition', addNodeMenu.position)}
              className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded-md flex items-center"
            >
              <span className="mr-2 text-blue-400">⚖️</span>
              Add Condition
            </button>
            <div className="border-t border-gray-800 mt-2 pt-2">
              <button
                onClick={() => setAddNodeMenu({ show: false, sourceNodeId: null, position: { x: 0, y: 0 } })}
                className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 rounded-md"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Edge Popup */}
        {selectedEdge && (
          <EdgePopup
            edge={selectedEdge}
            nodes={nodes}
            onSave={handleEdgeUpdate}
            onClose={() => setSelectedEdge(null)}
          />
        )}

        {/* Node Popup */}
        {selectedNode && (
          <NodePopup
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