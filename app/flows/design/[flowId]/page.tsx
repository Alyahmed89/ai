'use client';

import { useState, useCallback, useRef, useEffect, useMemo, DragEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';

// Stable ID generator
const generateStableId = (prefix: string = 'step'): string => {
  // Use a counter and timestamp to ensure uniqueness and stability
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000);
  return `${prefix}-${timestamp}-${random}`;
};

// LocalStorage helper functions for edge persistence
const getStoredEdges = (flowId: string): CustomEdge[] => {
  if (typeof window === 'undefined') return [];
  try {
    const key = `flow_edges_${flowId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const edges = JSON.parse(stored);
      console.log(`Loaded ${edges.length} edges from localStorage for flow ${flowId}`);
      return edges;
    }
  } catch (error) {
    console.error('Error loading edges from localStorage:', error);
  }
  return [];
};

const storeEdges = (flowId: string, edges: CustomEdge[]) => {
  if (typeof window === 'undefined') return;
  try {
    const key = `flow_edges_${flowId}`;
    localStorage.setItem(key, JSON.stringify(edges));
    console.log(`Stored ${edges.length} edges to localStorage for flow ${flowId}`);
  } catch (error) {
    console.error('Error storing edges to localStorage:', error);
  }
};

const clearStoredEdges = (flowId: string) => {
  if (typeof window === 'undefined') return;
  try {
    const key = `flow_edges_${flowId}`;
    localStorage.removeItem(key);
    console.log(`Cleared stored edges for flow ${flowId}`);
  } catch (error) {
    console.error('Error clearing edges from localStorage:', error);
  }
};

// LocalStorage helper functions for next_flow_id persistence
const getStoredNextFlowIds = (flowId: string): Record<string, string | null> => {
  if (typeof window === 'undefined') return {};
  try {
    const key = `flow_next_flow_ids_${flowId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const nextFlowIds = JSON.parse(stored);
      console.log(`Loaded next_flow_ids for ${Object.keys(nextFlowIds).length} steps from localStorage for flow ${flowId}`);
      return nextFlowIds;
    }
  } catch (error) {
    console.error('Error loading next_flow_ids from localStorage:', error);
  }
  return {};
};

const storeNextFlowId = (flowId: string, stepId: string, nextFlowId: string | null) => {
  if (typeof window === 'undefined') return;
  try {
    const key = `flow_next_flow_ids_${flowId}`;
    const stored = getStoredNextFlowIds(flowId);
    const updated = { ...stored, [stepId]: nextFlowId };
    localStorage.setItem(key, JSON.stringify(updated));
    console.log(`Stored next_flow_id for step ${stepId}: ${nextFlowId} to localStorage for flow ${flowId}`);
  } catch (error) {
    console.error('Error storing next_flow_id to localStorage:', error);
  }
};

const clearStoredNextFlowIds = (flowId: string) => {
  if (typeof window === 'undefined') return;
  try {
    const key = `flow_next_flow_ids_${flowId}`;
    localStorage.removeItem(key);
    console.log(`Cleared stored next_flow_ids for flow ${flowId}`);
  } catch (error) {
    console.error('Error clearing next_flow_ids from localStorage:', error);
  }
};
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
import dagre from 'dagre';
import DebugPanelAggressive from '@/app/components/DebugPanelAggressive';
import './NodePopupEnhanced.css';

// Dagre layout configuration
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 250;
const nodeHeight = 100;

const getLayoutedElements = (nodes: CustomNode[], edges: CustomEdge[], direction = 'TB') => {
  // If no edges, create a simple grid layout
  if (edges.length === 0) {
    const GRID_COLS = 3;
    const HORIZONTAL_SPACING = 300;
    const VERTICAL_SPACING = 150;
    
    const layoutedNodes = nodes.map((node, index) => {
      const row = Math.floor(index / GRID_COLS);
      const col = index % GRID_COLS;
      
      return {
        ...node,
        position: {
          x: col * HORIZONTAL_SPACING,
          y: row * VERTICAL_SPACING,
        },
      };
    });
    
    return { nodes: layoutedNodes, edges };
  }
  
  // Use Dagre for connected graphs
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    console.log(`Dagre: Setting edge ${edge.source} -> ${edge.target}`);
    dagreGraph.setEdge(edge.source, edge.target);
  });

  console.log(`Dagre layout: ${nodes.length} nodes, ${edges.length} edges`);
  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    
    // If node has position from dagre, use it
    if (nodeWithPosition) {
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - nodeWidth / 2,
          y: nodeWithPosition.y - nodeHeight / 2,
        },
      };
    }
    
    // Fallback to original position
    return node;
  });

  return { nodes: layoutedNodes, edges };
};

// Import existing flow management components
import EditFlowModal from '../../../../components/EditFlowModal';
import SimpleFlowCreator from '../../../../components/SimpleFlowCreator';
import Modal from '../../../../components/ui/Modal';
import FlowSection from '../../../../components/FlowSection';
import IntelligentTextarea from '../../../../components/ui/IntelligentTextarea';

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
  type?: 'input' | 'default' | 'output' | 'response';
  command?: string;
  await_input?: boolean;
  variables?: string[];
  // Default next flow for step-level routing (edge always overrides)
  next_flow_id?: string | null;
}

// Import shared types
import { FlowDefinition } from '@/types';

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
  type?: 'input' | 'default' | 'output' | 'response' | 'flow';
  [key: string]: unknown;
}

// Extended Node type
type CustomNode = Node<NodeData>;

// Simplified node component with single primary type
const CustomNode = ({ data, onClick, onAddNode, onDeleteNode }: { data: any; onClick?: (nodeId: string) => void; onAddNode?: (nodeId: string, event: React.MouseEvent) => void; onDeleteNode?: (nodeId: string) => void }) => {
  const step = data.step as Step;
  const nodeType = data.type || (step && step.step_type) || 'default';
  
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDeleteNode && step.id) {
      onDeleteNode(step.id);
    }
  };
  
  return (
    <div 
      className="px-3 py-2 rounded border cursor-pointer relative group"
      style={{
        backgroundColor: '#000000', // black
        borderColor: '#666666', // gray
        borderWidth: '1px',
        borderStyle: 'solid',
        color: '#ffffff', // white
        minWidth: '180px',
        maxWidth: '240px',
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
          background: '#666666',
          borderColor: '#999999',
          borderWidth: '1px',
          width: '10px',
          height: '10px',
        }} 
      />
      
      {/* Node header - title hidden, only controls visible */}
      <div className="flex justify-between items-start">
        {/* Hidden title placeholder */}
        <div className="font-thin text-sm truncate italic text-gray-400">
          {data.instructions ? data.instructions.substring(0, 30) + (data.instructions.length > 30 ? '...' : '') : 
           step?.instructions ? step.instructions.substring(0, 30) + (step.instructions.length > 30 ? '...' : '') : 'Step'}
        </div>
        <div className="flex items-center space-x-1 ml-2">
          {/* Delete button - visible on hover only */}
          {onDeleteNode && !data.isFlowExit && (
            <button
              onClick={handleDelete}
              className="text-xs text-red-400 hover:text-red-300 transition-colors p-0.5 rounded hover:bg-red-900/30 opacity-0 group-hover:opacity-100"
              title="Delete this step"
            >
              🗑️
            </button>
          )}
          {/* Add Step button */}
          {!data.isFlowExit && (
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
                const dragIcon = document.createElement('div');
                dragIcon.textContent = '+';
                dragIcon.style.position = 'absolute';
                dragIcon.style.left = '-1000px';
                dragIcon.style.top = '-1000px';
                document.body.appendChild(dragIcon);
                e.dataTransfer.setDragImage(dragIcon, 10, 10);
                setTimeout(() => document.body.removeChild(dragIcon), 0);
              }}
              className="text-xs text-neutral-400 opacity-40 hover:opacity-100 hover:text-green-400 transition-opacity cursor-grab active:cursor-grabbing"
              title="Add step from this node (click or drag)"
            >
              +
            </button>
          )}
        </div>
      </div>
      
      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ 
          background: '#666666',
          borderColor: '#999999',
          borderWidth: '1px',
          width: '10px',
          height: '10px',
        }} 
      />
    </div>
  );
};



// Node types configuration - only one primary type
const nodeTypes = {
  default: CustomNode,
  // All nodes use the same component
  input: CustomNode,
  output: CustomNode,
  flow: CustomNode, // Use same component for flow nodes too
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
    ? data?.route?.type === 'flow' ? `To flow: ${data?.route?.target_id || 'flow'}` : 'Always' // Show flow name for flow routing edges
    : data?.condition?.source === 'condition' && data?.condition?.operator === 'false'
    ? `If false: ${data?.condition?.value || 'condition'}` // Show condition for loop edges
    : `${data?.condition?.source} ${data?.condition?.operator} ${data?.condition?.value || ''}`;

  return (
    <>
      <g
        onClick={() => {
          console.log('Edge clicked (on path):', id, data);
          if (onClick) {
            onClick(id);
          }
        }}
        style={{ cursor: 'pointer' }}
      >
        <BaseEdge
          path={edgePath}
          markerEnd={markerEnd}
          style={{
            ...style,
            stroke: '#3b82f6',
            strokeWidth: 2,
          }}
        />
      </g>
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
              console.log('Edge clicked (on label):', id, data);
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
async function fetchFlowData(flowId: string): Promise<{flowDefinition: FlowDefinition | null, flowSteps: Step[], flowEdges?: any[]}> {
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

    // Try to fetch complete DAG from new endpoint first
    try {
      const dagResponse = await fetch(`/api/proxy/api/flows/${flowId}/steps`);
      if (dagResponse.ok) {
        const dagData = await dagResponse.json();
        console.log('Fetched DAG data from new endpoint:', dagData);
        
        // Handle different response formats
        let dagResult: any = dagData;
        if (dagData.success !== undefined && dagData.data) {
          dagResult = dagData.data;
        }
        
        // Extract steps and edges from DAG response
        const stepsArray = dagResult.steps || [];
        const edgesArray = dagResult.edges || [];
        
        console.log('DAG steps:', stepsArray.map((s: any) => ({ id: s.id, title: s.title })));
        console.log('DAG edges:', edgesArray.map((e: any) => ({ id: e.id, source: e.source_step_id, target: e.target_step_id })));
        
        // Process steps
        // Load next_flow_ids from localStorage for this flow
        const storedNextFlowIds = getStoredNextFlowIds(flowId);
        console.log('Loaded next_flow_ids from localStorage:', storedNextFlowIds);
        
        const flowSteps = stepsArray
          .sort((a: any, b: any) => a.order_index - b.order_index)
          .map((step: any) => ({
            ...step,
            // Ensure next_flow_id is always present - check localStorage first, then backend, then default to null
            next_flow_id: storedNextFlowIds[step.id] !== undefined ? storedNextFlowIds[step.id] : (step.next_flow_id || null),
            // Add UI-specific fields
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
            description: step.instructions?.substring(0, 100) + (step.instructions?.length > 100 ? '...' : ''),
          })) as Step[];
        
        console.log('Fetched flow steps with types:', flowSteps.map(s => ({ id: s.id, title: s.title, step_type: s.step_type, type: s.type, extra_step: s.extra_step })));
        return { flowDefinition, flowSteps, flowEdges: edgesArray };
      }
    } catch (dagError) {
      console.log('New DAG endpoint not available, falling back to old endpoint:', dagError);
    }

    // Fallback: Fetch flow steps from old endpoint
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
    // Load next_flow_ids from localStorage for this flow
    const storedNextFlowIds = getStoredNextFlowIds(flowId);
    console.log('Loaded next_flow_ids from localStorage:', storedNextFlowIds);
    
    const flowSteps = stepsArray
      .filter((step: any) => step.flow_id === flowId)
      .sort((a: any, b: any) => a.order_index - b.order_index)
      .map((step: any) => ({
        ...step,
        // Ensure next_flow_id is always present - check localStorage first, then backend, then default to null
        next_flow_id: storedNextFlowIds[step.id] !== undefined ? storedNextFlowIds[step.id] : (step.next_flow_id || null),
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
    return { flowDefinition, flowSteps, flowEdges: [] };
  } catch (error) {
    console.error('Error fetching flow data:', error);
    return { flowDefinition: null, flowSteps: [], flowEdges: [] };
  }
}

// Function to save flow steps to backend
async function saveFlowSteps(flowId: string, steps: Step[]): Promise<boolean> {
  try {
    console.log('Saving flow steps:', { flowId, steps: steps.map(s => ({ id: s.id, title: s.title, step_type: s.step_type, extra_step: s.extra_step, instructions: s.instructions })) });
    
    // First, get existing steps to determine which ones need to be created/updated/deleted
    const existingStepsResponse = await fetch(`/api/proxy/api/flow-steps?flow_id=${flowId}`);
    if (!existingStepsResponse.ok) {
      console.error('Failed to fetch existing steps:', existingStepsResponse.status);
      return false;
    }
    
    const existingStepsData = await existingStepsResponse.json();
    const existingSteps = existingStepsData.success ? existingStepsData.data?.steps || [] : [];
    console.log('Existing steps:', existingSteps.map((s: any) => s.id));
    
    // Create sets for comparison
    const existingStepIds = new Set(existingSteps.map((s: any) => s.id));
    const newStepIds = new Set(steps.map(s => s.id));
    
    // Steps to delete (exist in backend but not in current UI)
    const stepsToDelete = existingSteps.filter((s: any) => !newStepIds.has(s.id));
    
    // Steps to create (exist in UI but not in backend)
    const stepsToCreate = steps.filter(s => !existingStepIds.has(s.id));
    
    // Steps to update (exist in both)
    const stepsToUpdate = steps.filter(s => existingStepIds.has(s.id));
    
    console.log(`CRUD operations: Create=${stepsToCreate.length}, Update=${stepsToUpdate.length}, Delete=${stepsToDelete.length}`);
    
    // Delete steps
    for (const step of stepsToDelete) {
      console.log(`Deleting step ${step.id}`);
      const response = await fetch(`/api/proxy/api/flow-steps/${step.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        console.error(`Failed to delete step ${step.id}:`, response.status);
        const errorText = await response.text();
        console.error('Error response:', errorText);
        return false;
      } else {
        console.log(`Step ${step.id} deleted successfully`);
      }
    }
    
    // Create steps
    for (const step of stepsToCreate) {
      console.log(`Creating step ${step.id}`);
      const requestBody = {
        flow_id: flowId,
        instructions: step.instructions,
        title: step.title,
        step_type: 'action', // Always set to 'action' as default
        order_index: step.order_index,
        blocking: Boolean(step.blocking),
        auto_fail_on_error: Boolean(step.auto_fail_on_error),
        retryable: Boolean(step.retryable),
        output_keys: step.output_keys || null,
        input_keys: step.input_keys || null,
        use_endpoints: step.use_endpoints || null,
        extra_step: step.extra_step || 0,
        page_key: step.page_key || null,
        // Include next_flow_id if present
        next_flow_id: step.next_flow_id || null,
      };
      
      const response = await fetch(`/api/proxy/api/flow-steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        console.error(`Failed to create step ${step.id}:`, response.status);
        const errorText = await response.text();
        console.error('Error response:', errorText);
        return false;
      } else {
        console.log(`Step ${step.id} created successfully`);
      }
    }
    
    // Update steps
    for (const step of stepsToUpdate) {
      console.log(`=== Updating step ${step.id} ===`);
      console.log(`  instructions: "${step.instructions}"`);
      console.log(`  next_flow_id: "${step.next_flow_id}"`);
      console.log(`  step_type: "${step.step_type}"`);
      
      const requestBody = {
        instructions: step.instructions,
        title: step.title,
        step_type: 'action', // Always set to 'action' as default
        order_index: step.order_index,
        blocking: Boolean(step.blocking),
        auto_fail_on_error: Boolean(step.auto_fail_on_error),
        retryable: Boolean(step.retryable),
        output_keys: step.output_keys || null,
        input_keys: step.input_keys || null,
        use_endpoints: step.use_endpoints || null,
        extra_step: step.extra_step || 0,
        page_key: step.page_key || null,
        // Include next_flow_id if present
        next_flow_id: step.next_flow_id || null,
      };
      
      console.log('  Request body:', requestBody);
      
      const response = await fetch(`/api/proxy/api/flow-steps/${step.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
      console.log(`  Response status: ${response.status}`);
      console.log(`  Response ok: ${response.ok}`);
      
      if (!response.ok) {
        console.error(`Failed to update step ${step.id}:`, response.status);
        const errorText = await response.text();
        console.error('Error response:', errorText);
        return false;
      } else {
        const responseData = await response.json();
        console.log(`Step ${step.id} updated successfully:`, responseData);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error saving flow steps:', error);
    return false;
  }
}

// Function to save complete DAG (steps and edges) to backend using new endpoint
async function saveFlowDAG(
  flowId: string, 
  steps: Step[], 
  edges: CustomEdge[], 
  deletedStepIds: string[] = [], 
  deletedEdgeIds: string[] = []
): Promise<boolean> {
  try {
    console.log('=== SAVE FLOW DAG CALLED ===');
    console.log('Flow ID:', flowId);
    console.log('Steps count:', steps.length);
    console.log('Edges count:', edges.length);
    console.log('Deleted step IDs:', deletedStepIds);
    console.log('Deleted edge IDs:', deletedEdgeIds);
    console.log('Steps IDs:', steps.map(s => s.id));
    console.log('Edges source->target:', edges.map(e => `${e.source}->${e.target}`));
    
    // Prepare edges for backend
    const backendEdges = edges.map(edge => ({
      id: edge.id,
      source_step_id: edge.source,
      target_step_id: edge.target,
      condition: edge.data?.condition || {
        source: 'default',
        operator: 'always',
        value: null,
      },
      route: edge.data?.route || {
        type: 'step',
        target_id: edge.target,
        context_preservation: 'full',
      },
      type: edge.type || 'default',
    }));
    
    // Prepare steps for backend (ensure they have correct structure)
    const backendSteps = steps.map(step => ({
      id: step.id,
      flow_id: flowId, // CRITICAL: Add flow_id to each step
      step_key: step.step_key || step.id, // Use step_key if available, fallback to id
      title: step.title || '',
      instructions: step.instructions || '',
      step_type: step.step_type || 'action', // Use actual step_type, not hardcoded
      order_index: step.order_index || 1,
      page_key: step.page_key || null,
      blocking: Boolean(step.blocking || 0),
      auto_fail_on_error: Boolean(step.auto_fail_on_error || 0),
      retryable: Boolean(step.retryable || 0),
      output_keys: step.output_keys || null,
      output_url: step.output_url || null,
      output_payload_template: step.output_payload_template || null,
      default_next_step: step.default_next_step || null,
      output_auth_token: step.output_auth_token || null,
      input_keys: step.input_keys || null,
      output: Boolean(step.output || 0), // FIX: Convert to boolean (was number)
      default_next_step_id: step.default_next_step_id || null,
      step_number: step.step_number || null,
      requires_task: Boolean(step.requires_task || 0), // Also fix this boolean
      use_endpoints: step.use_endpoints || null,
      extra_step: step.extra_step || 0,
      // Include next_flow_id if present
      next_flow_id: step.next_flow_id || null,
    }));
    
    const payload = {
      steps: backendSteps,
      edges: backendEdges,
      deleted_step_ids: deletedStepIds,
      deleted_edge_ids: deletedEdgeIds,
    };
    
    console.log('=== SENDING DAG PAYLOAD ===');
    console.log('Full payload:', JSON.stringify(payload, null, 2));
    console.log('Steps in payload:', payload.steps.length);
    console.log('Edges in payload:', payload.edges.length);
    console.log('Deleted step IDs:', payload.deleted_step_ids);
    console.log('Deleted edge IDs:', payload.deleted_edge_ids);
    
    const response = await fetch(`/api/proxy/api/flows/${flowId}/steps`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);
    
    if (!response.ok) {
      console.error('Failed to save flow DAG:', response.status);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return false;
    }
    
    const data = await response.json();
    console.log('Flow DAG saved successfully:', data);
    return true;
  } catch (error) {
    console.error('Error saving flow DAG:', error);
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
        step_key: stepData.step_key || generateStableId('step'),
        title: stepData.title || 'New Step',
        instructions: stepData.instructions || '',
        step_type: 'action', // Always set to 'action' as default
        order_index: stepData.order_index || 1,
        blocking: Boolean(stepData.blocking || 0),
        auto_fail_on_error: Boolean(stepData.auto_fail_on_error || 0),
        retryable: Boolean(stepData.retryable || 0),
        output_keys: stepData.output_keys || '',
        input_keys: stepData.input_keys || '',
        output: Boolean(stepData.output || 0),
        requires_task: Boolean(stepData.requires_task || 0),
        // Include next_flow_id if present
        next_flow_id: stepData.next_flow_id || null,
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
    let nodeType: 'input' | 'default' | 'output' | 'response' | 'flow' = 'default';
    if (step.step_type === 'input' || step.type === 'input') {
      nodeType = 'input';
    } else if (step.step_type === 'output' || step.type === 'output') {
      nodeType = 'output';
    } else if (step.step_type === 'flow' || step.step_type === 'agent') {
      nodeType = 'flow';
    } else if (step.step_type === 'response' || step.type === 'response') {
      nodeType = 'response';
    } else if (step.step_type === 'processing' && step.extra_step === 1) {
      // Backward compatibility: processing steps with extra_step=1 are response nodes
      nodeType = 'response';
    }
    // Note: condition nodes are removed from frontend for now
    
    console.log(`Step ${step.id}: step_type=${step.step_type}, type=${step.type}, nodeType=${nodeType}`);
    
    return {
      id: step.id,
      type: nodeType as 'input' | 'default' | 'output' | 'response' | 'flow',
      data: { 
        label: step.title, 
        title: step.title,
        step,
        instructions: step.instructions,
        command: step.command || '',
        await_input: step.await_input || false,
        type: nodeType as 'input' | 'default' | 'output' | 'response' | 'flow', // Use the mapped nodeType for UI consistency
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
  
  // Create a map of step IDs to steps for easy lookup
  const stepMap = new Map<string, Step>();
  steps.forEach(step => stepMap.set(step.id, step));
  
  // Create edges based on various connection types
  steps.forEach(step => {
    console.log(`Processing step ${step.id}: next_flow_id="${step.next_flow_id}", default_next_step_id="${step.default_next_step_id}"`);
    
    // 1. Default next step (non-conditional)
    if (step.default_next_step_id && stepMap.has(step.default_next_step_id)) {
      edges.push({
        id: `e-default-${step.id}-${step.default_next_step_id}`,
        source: step.id,
        target: step.default_next_step_id,
        animated: false,
        style: {
          stroke: '#3b82f6', // Blue color for default edges
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
            target_id: step.default_next_step_id,
            context_preservation: 'full' as const,
          },
        },
      });
    }
    
    // 3. Next flow routing edge
    if (step.next_flow_id && step.next_flow_id.trim()) {
      console.log(`Creating flow routing edge from ${step.id} to flow-exit-${step.next_flow_id} for flow ${step.next_flow_id}`);
      // Create edge to the flow exit node
      edges.push({
        id: `e-flow-${step.id}-${step.next_flow_id}`,
        source: step.id,
        target: `flow-exit-${step.next_flow_id}`, // Special node ID for flow exit
        animated: true,
        style: {
          stroke: '#8b5cf6', // Purple color for flow routing edges
          strokeWidth: 2,
          strokeDasharray: '5,5',
        },
        markerEnd: {
          type: 'arrowclosed',
          color: '#8b5cf6',
        },
        data: {
          condition: {
            source: 'default',
            operator: 'always',
            value: null,
          },
          route: {
            type: 'flow' as const,
            target_id: step.next_flow_id,
            context_preservation: 'full' as const,
          },
        },
      });
    }
  });
  
  return edges;
}

// Create flow exit nodes for flow routing edges
function createFlowExitNodes(steps: Step[]): CustomNode[] {
  const flowExitNodes: CustomNode[] = [];
  const flowIds = new Set<string>();
  
  // Collect unique flow IDs from steps with next_flow_id
  steps.forEach(step => {
    if (step.next_flow_id && step.next_flow_id.trim() && !flowIds.has(step.next_flow_id)) {
      flowIds.add(step.next_flow_id);
    }
  });
  
  // Create a flow exit node for each unique flow ID
  let index = 0;
  flowIds.forEach(flowId => {
    flowExitNodes.push({
      id: `flow-exit-${flowId}`,
      type: 'flow' as const,
      data: {
        label: `Exit to ${flowId}`,
        title: `Exit to ${flowId}`,
        instructions: `Route to flow: ${flowId}`,
        type: 'flow' as const,
        isFlowExit: true, // Mark as flow exit node
      },
      position: { x: 800, y: 100 + (index * 120) }, // Position to the right of regular nodes
    });
    index++;
  });
  
  return flowExitNodes;
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
      flow_id: null as string | null,
    };
  });
  
  const [availableFlows, setAvailableFlows] = useState<Array<{id: string, name: string}>>([]);
  const [loadingFlows, setLoadingFlows] = useState(false);

  // Fetch available flows from backend
  useEffect(() => {
    const fetchFlows = async () => {
      try {
        setLoadingFlows(true);
        const response = await fetch('/api/proxy/api/flows');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.flows) {
            setAvailableFlows(data.data.flows.map((flow: any) => ({
              id: flow.id,
              name: flow.name || `Flow ${flow.id}`
            })));
          }
        }
      } catch (error) {
        console.error('Failed to fetch flows:', error);
      } finally {
        setLoadingFlows(false);
      }
    };
    
    fetchFlows();
  }, []);

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
    // Add flows as condition sources
    ...availableFlows.map(flow => ({
      value: `flow.${flow.id}.status`,
      label: `Flow: ${flow.name} Status`,
      category: 'flow'
    })),
    ...availableFlows.map(flow => ({
      value: `flow.${flow.id}.result`,
      label: `Flow: ${flow.name} Result`,
      category: 'flow'
    })),
    ...availableFlows.map(flow => ({
      value: `flow.${flow.id}.output`,
      label: `Flow: ${flow.name} Output`,
      category: 'flow'
    })),
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
    <Modal onClose={onClose}>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-thin">Edge</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M6 18 L18 6 M6 6 l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="space-y-5">
          {/* Condition Source */}
          <div>
            <select
              value={condition.source}
              onChange={(e) => setCondition({...condition, source: e.target.value})}
              className="w-full bg-black border border-gray-600 rounded px-3 py-2 text-white font-thin focus:border-gray-500 focus:outline-none"
            >
              {sourceOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Condition Operator */}
          <div>
            <select
              value={condition.operator}
              onChange={(e) => setCondition({...condition, operator: e.target.value})}
              className="w-full bg-black border border-gray-600 rounded px-3 py-2 text-white font-thin focus:border-gray-500 focus:outline-none"
            >
              {operatorOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Condition Value (if not "always") */}
          {condition.operator !== 'always' && (
            <div>
              <input
                type="text"
                value={condition.value || ''}
                onChange={(e) => setCondition({...condition, value: e.target.value})}
                className="w-full bg-black border border-gray-600 rounded px-3 py-2 text-white font-thin placeholder:italic focus:border-gray-500 focus:outline-none"
                placeholder="condition value..."
              />
            </div>
          )}

          {/* Target Node Selection */}
          <div>
            <select
              value={route.target_id}
              onChange={(e) => setRoute({...route, target_id: e.target.value, type: 'step' })}
              className="w-full bg-black border border-gray-600 rounded px-3 py-2 text-white font-thin focus:border-gray-500 focus:outline-none"
            >
              <option value="">Select target node...</option>
              {nodes
                .filter(n => n.id !== edge.source)
                .map(node => (
                  <option key={node.id} value={node.id}>
                    {node.data?.step?.title || `Node ${node.id}`}
                  </option>
                ))}
            </select>
          </div>

          {/* Response to Another Flow Selection */}
          <div>
            <select
              value={route.flow_id || ''}
              onChange={(e) => {
                const flowId = e.target.value;
                setRoute({
                  ...route,
                  type: flowId ? 'flow' as const : 'step' as const,
                  flow_id: flowId || null,
                });
              }}
              className="w-full bg-black border border-gray-600 rounded px-3 py-2 text-white font-thin focus:border-gray-500 focus:outline-none"
              disabled={loadingFlows}
            >
              <option value="">Response to another flow (optional)...</option>
              {availableFlows.map(flow => (
                <option key={flow.id} value={flow.id}>
                  {flow.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end space-x-2 mt-6 pt-4 border-t border-gray-800">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-800 text-sm font-thin border border-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 bg-black text-white rounded hover:bg-gray-900 text-sm font-thin border border-gray-700 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
};

// Unified popup modal component for all nodes (steps and conditions) - ENHANCED VERSION
const NodePopup = ({ 
  node, 
  availableVariables,
  onSave, 
  onClose,
  flowId
}: { 
  node: CustomNode;
  availableVariables: string[];
  onSave: (node: CustomNode) => void;
  onClose: () => void;
  flowId?: string;
}) => {
  const nodeData = node.data as NodeData;
  const [instructions, setInstructions] = useState<string>(typeof nodeData?.instructions === 'string' ? nodeData.instructions : '');
  const [selectedCommand, setSelectedCommand] = useState<string>('');
  const [availableCommands, setAvailableCommands] = useState<Array<{name: string, description: string, method: string, parameters: any}>>([]);
  const [loadingCommands, setLoadingCommands] = useState(false);
  const [showCreateCommand, setShowCreateCommand] = useState(false);
  const [newCommandData, setNewCommandData] = useState({
    name: '',
    description: '',
    method: 'GET' as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    endpoint: '',
    parameters: '{}'
  });
  const [creatingCommand, setCreatingCommand] = useState(false);
  const [awaitInput, setAwaitInput] = useState<boolean>(nodeData?.await_input === true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Simple flow selection state
  const [availableFlows, setAvailableFlows] = useState<Array<{id: string, name: string}>>([]);
  const [selectedFlowId, setSelectedFlowId] = useState<string>(
    nodeData?.step?.next_flow_id || ''
  );
  
  // Track if we've already auto-inserted [input:message]
  const hasAutoInsertedRef = useRef(false);
  
  // Enhanced UI states
  const [flowInput, setFlowInput] = useState('main_pipeline');
  const [stepInput, setStepInput] = useState('process_data');
  const [flowrunInput, setFlowrunInput] = useState('daily_run_001');
  const [queryParams, setQueryParams] = useState([
    { key: 'limit', value: '10' },
    { key: 'status', value: 'active' },
    { key: 'priority', value: 'high' }
  ]);
  const [outputCollapsed, setOutputCollapsed] = useState(false);
  const [showSampleModal, setShowSampleModal] = useState(false);
  
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
  
  // Fetch available flows from backend (simple version like /chat page)
  useEffect(() => {
    const fetchFlows = async () => {
      try {
        const response = await fetch('/api/proxy/api/flow-definitions');
        if (response.ok) {
          const flows = await response.json();
          setAvailableFlows(flows.map((flow: any) => ({
            id: flow.id,
            name: flow.name || `Flow ${flow.id}`
          })));
        }
      } catch (error) {
        console.error('Failed to fetch flows:', error);
      }
    };
    
    fetchFlows();
  }, []);
  
  // When component mounts with existing next_flow_id, ensure [input:message] is in instructions
  useEffect(() => {
    if (selectedFlowId && instructions && !instructions.includes('[input:message]') && !hasAutoInsertedRef.current) {
      const newInstructions = instructions.trim() + '\n\n[input:message]';
      setInstructions(newInstructions);
      hasAutoInsertedRef.current = true;
    }
  }, [selectedFlowId, instructions]);
  
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
  
  // Handle flow selection change with auto-insertion of [input:message] and auto-save
  const handleFlowChange = (flowId: string) => {
    setSelectedFlowId(flowId);
    
    let updatedInstructions = instructions;
    
    // If a flow is selected and instructions don't already contain [input:message],
    // auto-insert it at the end
    if (flowId && instructions && !instructions.includes('[input:message]')) {
      updatedInstructions = instructions.trim() + '\n\n[input:message]';
      setInstructions(updatedInstructions);
      hasAutoInsertedRef.current = true;
    }
    
    // Auto-save when flow is selected
    autoSaveNode(flowId, updatedInstructions);
  };
  
  // Function to auto-save node when flow is selected
  const autoSaveNode = (flowId: string, updatedInstructions?: string) => {
    // Read from DOM refs to bypass React state timing issues with automation
    // Use updatedInstructions if provided, otherwise get from DOM or state
    const domInstructions = updatedInstructions || textareaRef.current?.value || instructions || '';
    
    console.log('NodePopup autoSaveNode called!');
    console.log('Selected flow ID:', flowId);
    console.log('DOM instructions:', domInstructions);
    console.log('nodeData:', nodeData);
    
    const currentStep = nodeData?.step;
    const updatedNode = {
      ...node,
      data: {
        ...nodeData,
        instructions: domInstructions,
        await_input: false, // Always false since we removed the checkbox
        step: currentStep ? {
          ...currentStep,
          instructions: domInstructions,
          // Store next_flow_id (empty string becomes null for backend)
          next_flow_id: flowId || null,
        } : {
          // Create a minimal step object if it doesn't exist
          id: node.id || generateStableId('step'),
          flow_id: '',
          step_key: '',
          title: nodeData?.title || 'Untitled Step',
          instructions: domInstructions,
          step_type: 'default',
          order_index: 0,
          blocking: 0,
          auto_fail_on_error: 0,
          retryable: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          task_id: null,
          output_keys: '', // Empty since we removed the field
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
          // Store next_flow_id for new steps
          next_flow_id: flowId || null,
        },
      },
    };
    console.log('Auto-saving node with flow selection:', JSON.stringify(updatedNode, null, 2));
    
    // Save next_flow_id to localStorage for persistence
    // Always save (even if flowId is empty string) to clear previous values
    const stepId = currentStep?.id || node.id;
    const currentFlowId = currentStep?.flow_id;
    if (currentFlowId) {
      storeNextFlowId(currentFlowId, stepId, flowId || null);
      console.log(`Saved next_flow_id to localStorage: flow ${currentFlowId}, step ${stepId} -> next_flow ${flowId || 'null'}`);
    } else {
      console.warn('Cannot save next_flow_id to localStorage: current flow ID not found in step');
    }
    
    onSave(updatedNode);
  };
  
  console.log('NodePopup rendered! nodeData?.instructions:', nodeData?.instructions, 'instructions state:', instructions);

  const handleSave = () => {
    // Read from DOM refs to bypass React state timing issues with automation
    const domInstructions = textareaRef.current?.value || '';
    
    console.log('NodePopup handleSave called!');
    console.log('State instructions:', instructions, 'DOM instructions:', domInstructions);
    console.log('nodeData:', nodeData);
    console.log('awaitInput:', awaitInput);
    
    // Use the autoSaveNode function to save with current selectedFlowId
    autoSaveNode(selectedFlowId, domInstructions);
    
    // Close the popup after saving
    onClose();
  };

  // Handle new command form input changes
  const handleNewCommandChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewCommandData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle creating a new command
  const handleCreateCommand = async () => {
    if (!newCommandData.name.trim() || !newCommandData.endpoint.trim()) {
      alert('Please fill in command name and endpoint URL');
      return;
    }

    setCreatingCommand(true);
    try {
      // Simulate API call delay (like in /commands/new page)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('Creating new command:', {
        name: newCommandData.name,
        description: newCommandData.description,
        method: newCommandData.method,
        endpoint: newCommandData.endpoint,
        parameters: newCommandData.parameters
      });
      
      // Add the new command to the available commands list locally
      const newCommand = {
        name: newCommandData.name,
        description: newCommandData.description,
        method: newCommandData.method,
        endpoint: newCommandData.endpoint,
        parameters: newCommandData.parameters,
        tags: ['custom', 'user_created']
      };
      
      // Update the commands list locally
      setAvailableCommands(prev => [...prev, newCommand]);
      
      // Close the popup and reset form
      setShowCreateCommand(false);
      setNewCommandData({
        name: '',
        description: '',
        method: 'GET',
        endpoint: '',
        parameters: '{}'
      });
      
      alert('Command created successfully! It will appear in the dropdown.');
    } catch (error) {
      console.error('Error creating command:', error);
      alert('Failed to create command. Please check the console for details.');
    } finally {
      setCreatingCommand(false);
    }
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
    <Modal onClose={onClose}>
      <div className="space-y-4">
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="space-y-4">
          {/* ========== INPUT SECTION ========== */}
          <FlowSection
            title="INPUT"
            type="input"
            flowValue={flowInput}
            stepValue={stepInput}
            flowrunValue={flowrunInput}
            onFlowChange={setFlowInput}
            onStepChange={setStepInput}
            onFlowrunChange={setFlowrunInput}
            selectedCommand={selectedCommand}
            onCommandChange={setSelectedCommand}
            availableCommands={availableCommands}
            loadingCommands={loadingCommands}
            onAddCommand={() => setShowCreateCommand(true)}
            onShowSample={() => setShowSampleModal(true)}
            queryParams={queryParams}
            onAddQueryParam={() => setQueryParams([...queryParams, { key: '', value: '' }])}
            onUpdateQueryParam={(index, key, value) => {
              const newParams = [...queryParams];
              newParams[index] = { key, value };
              setQueryParams(newParams);
            }}
            onRemoveQueryParam={(index) => {
              const newParams = queryParams.filter((_, i) => i !== index);
              setQueryParams(newParams);
            }}
            onVariableDragStart={onVariableDragStart}
            defaultCollapsed={true}
          />

          {/* ========== STEP INSTRUCTIONS ========== */}
          <div className="node-popup-textarea-container">
            <IntelligentTextarea
              value={instructions || ''}
              onChange={(value) => setInstructions(value)}
              placeholder="expected response: {{command_output}}"
              className="node-popup-textarea"
              commands={availableCommands.map(cmd => ({
                id: cmd.name,
                label: cmd.name,
                description: `Command: ${cmd.method}`,
                type: 'command' as const,
                value: `{{${cmd.name}}}`
              }))}
              variables={[
                { id: 'command_output', label: 'command_output', description: 'Output from the command', type: 'variable', value: '{{command_output}}' },
                { id: 'flow_id', label: 'flow_id', description: 'Current flow ID', type: 'variable', value: '{{flow_id}}' },
                { id: 'step_id', label: 'step_id', description: 'Current step ID', type: 'variable', value: '{{step_id}}' },
                { id: 'user_input', label: 'user_input', description: 'User input variable', type: 'variable', value: '{{user_input}}' },
                { id: 'timestamp', label: 'timestamp', description: 'Current timestamp', type: 'variable', value: '{{timestamp}}' },
                { id: 'inputs.user_prompt', label: 'inputs.user_prompt', description: 'User prompt from chat input', type: 'variable', value: '{inputs.user_prompt}' }
              ]}
              flows={[]} // Will be populated from API
              steps={[]} // Will be populated from API
              flowruns={[]} // Will be populated from API
              flowId={flowId}
            />
          </div>

          {/* ========== OUTPUT SECTION ========== */}
          <FlowSection
            title="OUTPUT"
            type="output"
            flowValue={flowInput}
            stepValue={stepInput}
            flowrunValue={flowrunInput}
            onFlowChange={setFlowInput}
            onStepChange={setStepInput}
            onFlowrunChange={setFlowrunInput}
            selectedCommand={selectedCommand}
            onCommandChange={setSelectedCommand}
            availableCommands={availableCommands}
            loadingCommands={loadingCommands}
            onAddCommand={() => setShowCreateCommand(true)}
            onShowSample={() => setShowSampleModal(true)}
            queryParams={queryParams}
            onAddQueryParam={() => setQueryParams([...queryParams, { key: '', value: '' }])}
            onUpdateQueryParam={(index, key, value) => {
              const newParams = [...queryParams];
              newParams[index] = { key, value };
              setQueryParams(newParams);
            }}
            onRemoveQueryParam={(index) => {
              const newParams = queryParams.filter((_, i) => i !== index);
              setQueryParams(newParams);
            }}
            onVariableDragStart={onVariableDragStart}
            defaultCollapsed={true}
          />

          {/* ========== FLOW DROPDOWN ========== */}
          <div className="node-popup-dropdown-row">
            <select
              value={selectedFlowId}
              onChange={(e) => handleFlowChange(e.target.value)}
              className="node-popup-select"
            >
              <option value="">Default Next Flow (optional)</option>
              {availableFlows.map(flow => (
                <option key={flow.id} value={flow.id}>
                  {flow.name}
                </option>
              ))}
            </select>
          </div>

          {/* Command Parameters - only show when command is selected */}
          {selectedCommand && commandParameters.length > 0 && (
            <div>
              <div className="text-xs text-gray-400 mb-1 font-thin">
                parameters for {selectedCommand}:
              </div>
              <div className="flex flex-wrap gap-1">
                {commandParameters.map((param, index) => (
                  <div 
                    key={index}
                    className="inline-flex items-center bg-black text-gray-100 border border-gray-700 rounded px-2 py-1 cursor-pointer hover:bg-gray-900 transition-colors text-xs font-thin"
                    draggable
                    onDragStart={(e) => onVariableDragStart(e, param)}
                    title={`Drag ${param} into text`}
                    style={{ cursor: 'grab' }}
                  >
                    <div>{param}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Flow Selection for Response Nodes */}
          {nodeData?.type === 'response' && (
            <div>
              <select
                className="w-full bg-black border border-gray-600 rounded px-3 py-2 text-white text-sm font-thin focus:border-gray-500 focus:outline-none"
              >
                <option value="">target flow...</option>
                <option value="current">Current Flow</option>
                <option value="word-matching-flow">Word Matching Flow</option>
                <option value="other">Other Flow...</option>
              </select>
            </div>
          )}



          {/* ========== SAVE BUTTON ========== */}
          <div className="node-popup-save-row">
            <button
              onClick={handleSave}
              className="node-popup-save-btn"
            >
              Save
            </button>
          </div>
        </div>
      </div>

      {/* Command Creation Popup */}
      {showCreateCommand && (
        <Modal onClose={() => setShowCreateCommand(false)}>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-thin">New Command</h3>
              <button
                onClick={() => setShowCreateCommand(false)}
                className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800 transition-colors"
                disabled={creatingCommand}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <input
                  type="text"
                  name="name"
                  value={newCommandData.name}
                  onChange={handleNewCommandChange}
                  className="w-full bg-black border border-gray-600 rounded px-3 py-2 text-white text-sm font-thin placeholder:italic focus:border-gray-500 focus:outline-none"
                  placeholder="command name..."
                  disabled={creatingCommand}
                />
              </div>
              
              <div>
                <textarea
                  name="description"
                  value={newCommandData.description}
                  onChange={handleNewCommandChange}
                  className="w-full bg-black border border-gray-600 rounded px-3 py-2 text-white text-sm font-thin placeholder:italic focus:border-gray-500 focus:outline-none min-h-[60px]"
                  placeholder="description..."
                  disabled={creatingCommand}
                />
              </div>
              
              <div>
                <select
                  name="method"
                  value={newCommandData.method}
                  onChange={handleNewCommandChange}
                  className="w-full bg-black border border-gray-600 rounded px-3 py-2 text-white text-sm font-thin focus:border-gray-500 focus:outline-none"
                  disabled={creatingCommand}
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                  <option value="PATCH">PATCH</option>
                </select>
              </div>
              
              <div>
                <input
                  type="text"
                  name="endpoint"
                  value={newCommandData.endpoint}
                  onChange={handleNewCommandChange}
                  className="w-full bg-black border border-gray-600 rounded px-3 py-2 text-white text-sm font-thin placeholder:italic focus:border-gray-500 focus:outline-none"
                  placeholder="endpoint url..."
                  disabled={creatingCommand}
                />
              </div>
              
              <div>
                <textarea
                  name="parameters"
                  value={newCommandData.parameters}
                  onChange={handleNewCommandChange}
                  className="w-full bg-black border border-gray-600 rounded px-3 py-2 text-white text-sm font-thin placeholder:italic focus:border-gray-500 focus:outline-none min-h-[80px]"
                  placeholder='parameters json...'
                  disabled={creatingCommand}
                />
              </div>
              
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowCreateCommand(false)}
                  className="px-3 py-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-800 text-sm font-thin border border-gray-700 transition-colors"
                  disabled={creatingCommand}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCommand}
                  className="px-3 py-1.5 bg-black text-white rounded hover:bg-gray-900 text-sm font-thin border border-gray-700 transition-colors flex items-center gap-2"
                  disabled={creatingCommand}
                >
                  {creatingCommand ? (
                    <>
                      <span className="animate-spin">⟳</span>
                      Creating...
                    </>
                  ) : (
                    'Create'
                  )}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Sample Response Modal */}
      {showSampleModal && (
        <Modal onClose={() => setShowSampleModal(false)}>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-thin">Sample Response</h3>
              <button
                onClick={() => setShowSampleModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="bg-black border border-gray-600 rounded p-4">
              <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">
{`{
  "status": "success",
  "data": {
    "id": "resp_001",
    "message": "Operation completed successfully",
    "timestamp": "2024-01-15T10:30:00Z",
    "metrics": {
      "duration_ms": 245,
      "records_processed": 1250
    }
  }
}`}</pre>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
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
  
  // Flow run state
  const [startingFlow, setStartingFlow] = useState(false);
  const [flowRunId, setFlowRunId] = useState<string | null>(null);
  const [flowRunError, setFlowRunError] = useState<string | null>(null);
  
  // Track deleted items for DAG persistence
  const [deletedStepIds, setDeletedStepIds] = useState<string[]>([]);
  const [deletedEdgeIds, setDeletedEdgeIds] = useState<string[]>([]);
  
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

  // Save edges to localStorage whenever they change
  useEffect(() => {
    if (currentFlowId && edges.length > 0) {
      storeEdges(currentFlowId, edges);
    }
  }, [edges, currentFlowId]);

  // Function to auto-save flow changes
  const autoSaveFlow = useCallback(async (deletedStepIdsOverride?: string[], deletedEdgeIdsOverride?: string[]) => {
    if (saving || !currentFlowId || nodes.length === 0) {
      console.log('Auto-save skipped:', { saving, currentFlowId, nodesCount: nodes.length });
      return;
    }

    console.log('=== AUTO-SAVE START ===');
    console.log('Auto-saving flow with', nodes.length, 'nodes and', edges.length, 'edges');
    
    // Use overridden values if provided, otherwise use state
    const currentDeletedStepIds = deletedStepIdsOverride || deletedStepIds;
    const currentDeletedEdgeIds = deletedEdgeIdsOverride || deletedEdgeIds;
    
    console.log('Current deletedStepIds:', currentDeletedStepIds);
    console.log('Current deletedEdgeIds:', currentDeletedEdgeIds);
    
    // Debug: List all node IDs
    console.log('All node IDs:', nodes.map(n => n.id));
    console.log('All step IDs from node data:', nodes.map(n => (n.data as NodeData)?.step?.id).filter(Boolean));
    
    try {
      setSaving(true);
      
      // Convert nodes to steps for saving, EXCLUDING deleted steps
      const updatedSteps: Step[] = nodes
        .filter(node => {
          const step = (node.data as NodeData)?.step as Step;
          return step?.id && !currentDeletedStepIds.includes(step.id);
        })
        .map((node): Step => {
          const nodeData = node.data as NodeData;
          const step = nodeData.step as Step;
          const nodeTitle = nodeData.title;
          const nodeInstructions = nodeData.instructions;
          const nodeStepType = nodeData.step?.step_type;
          const nodeType = nodeData.type;
          
          // Map UI type to step_type
          let finalStepType = typeof nodeStepType === 'string' ? nodeStepType : step.step_type;
          let extraStep = step.extra_step || 0;
          
          if (nodeType) {
            if (nodeType === 'response') {
              finalStepType = 'response';
              extraStep = 0;
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
            order_index: step.order_index || 1,
            input_keys: step.input_keys || null,
            output_keys: step.output_keys || '',
            default_next_step_id: step.default_next_step_id || null,
            next_flow_id: step.next_flow_id || null,
          };
        });
      
      // Sort steps by order_index for consistency
      updatedSteps.sort((a, b) => a.order_index - b.order_index);
      
      // Save complete DAG to backend
      const success = await saveFlowDAG(currentFlowId, updatedSteps, edges, currentDeletedStepIds, currentDeletedEdgeIds);
      
      if (success) {
        console.log('Auto-save successful');
        // Clear deletion tracking after successful save
        setDeletedStepIds([]);
        setDeletedEdgeIds([]);
        // Also save edges to localStorage for persistence
        storeEdges(currentFlowId, edges);
      } else {
        console.error('Auto-save failed');
      }
    } catch (err) {
      console.error('Error in auto-save:', err);
    } finally {
      setSaving(false);
      console.log('=== AUTO-SAVE END ===');
    }
  }, [nodes, edges, currentFlowId, saving, deletedStepIds, deletedEdgeIds, setSaving, setDeletedStepIds, setDeletedEdgeIds, storeEdges]);
  
  const loadFlowData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { flowDefinition, flowSteps, flowEdges } = await fetchFlowData(currentFlowId);
      
      if (!flowDefinition) {
        // Flow doesn't exist - show create flow modal
        setShowCreateFlowModal(true);
        setError(`Flow "${currentFlowId}" not found. Create a new flow?`);
      } else {
        setFlowDefinition(flowDefinition);
        setFlowSteps(flowSteps);
        
        // Create nodes from steps
        const initialNodes = createNodesFromSteps(flowSteps);
        
        // Add flow exit nodes for flow routing
        const flowExitNodes = createFlowExitNodes(flowSteps);
        const allNodes = [...initialNodes, ...flowExitNodes];
        
        // Create edges: use flowEdges if available, otherwise try localStorage, otherwise create from steps
        let initialEdges: CustomEdge[] = [];
        if (flowEdges && flowEdges.length > 0) {
          // Convert backend edges to React Flow edges
          initialEdges = flowEdges.map((edge: any) => ({
            id: edge.id,
            source: edge.source_step_id,
            target: edge.target_step_id,
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
              condition: edge.condition || {
                source: 'default',
                operator: 'always',
                value: null,
              },
              route: edge.route || {
                type: 'step',
                target_id: edge.target_step_id,
                context_preservation: 'full',
              },
            },
            type: edge.type || 'default',
          }));
          console.log('Created edges from backend DAG:', initialEdges);
        } else {
          // Try to load edges from localStorage
          const storedEdges = getStoredEdges(currentFlowId);
          if (storedEdges.length > 0) {
            initialEdges = storedEdges;
            console.log('Loaded edges from localStorage:', initialEdges);
          } else {
            // Final fallback: create edges from step connections
            initialEdges = createEdgesFromSteps(flowSteps);
            console.log('Created edges from step connections (fallback):', initialEdges);
          }
        }
        
        // Apply Dagre layout for proper node positioning
        const { nodes: layoutedNodes } = getLayoutedElements(allNodes, initialEdges);
        
        setNodes(layoutedNodes);
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

  // Function to handle node deletion
  const handleDeleteNode = useCallback((nodeId: string) => {
    // Create a remove change for the node
    const change: NodeChange = {
      id: nodeId,
      type: 'remove'
    };
    
    // Track deleted step ID - use functional update to ensure we get latest
    setDeletedStepIds(prev => {
      const updated = [...prev, nodeId];
      console.log('Updated deletedStepIds in handleDeleteNode:', updated);
      
      // Schedule auto-save AFTER state is updated, passing the updated deletedStepIds
      setTimeout(() => {
        console.log('Auto-saving after node deletion, deletedStepIds includes:', updated);
        autoSaveFlow(updated, deletedEdgeIds);
      }, 100); // Short delay to ensure React processes the state update
      
      return updated;
    });
    
    // Trigger the nodes change with remove action
    onNodesChange([change]);
    
    // Also remove from selected node if it's the one being deleted
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
  }, [onNodesChange, selectedNode, autoSaveFlow, deletedEdgeIds]);

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
      
      return <CustomNode {...props} onClick={handleClick} onAddNode={handleAddNode} onDeleteNode={handleDeleteNode} />;
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
      
      return <CustomNode {...props} onClick={handleClick} onAddNode={handleAddNode} onDeleteNode={handleDeleteNode} />;
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
      
      return <CustomNode {...props} onClick={handleClick} onAddNode={handleAddNode} onDeleteNode={handleDeleteNode} />;
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
      
      return <CustomNode {...props} onClick={handleClick} onAddNode={handleAddNode} onDeleteNode={handleDeleteNode} />;
    },

    flow: (props: any) => {
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
      
      return <CustomNode {...props} onClick={handleClick} onAddNode={handleAddNode} onDeleteNode={handleDeleteNode} />;
    },
  }), [nodes, handleDeleteNode]);

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

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      // Track deleted edge IDs
      const deletedIds = changes
        .filter(change => change.type === 'remove')
        .map(change => change.id);
      
      if (deletedIds.length > 0) {
        setDeletedEdgeIds(prev => [...prev, ...deletedIds]);
        
        // Auto-save after deleting edges
        setTimeout(() => {
          autoSaveFlow();
        }, 100);
      }
      
      setEdges((eds) => applyEdgeChanges(changes, eds) as CustomEdge[]);
    },
    [autoSaveFlow]
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
      setSelectedEdge(newEdge);
      
      // Auto-save after adding edge
      setTimeout(() => {
        autoSaveFlow();
      }, 100);
    },
    [autoSaveFlow]
  );

  const handleEdgeUpdate = useCallback((updatedEdge: CustomEdge) => {
    setEdges((eds) => eds.map(edge => 
      edge.id === updatedEdge.id ? updatedEdge : edge
    ));
    
    // Auto-save after updating edge
    setTimeout(() => {
      autoSaveFlow();
    }, 100);
  }, [autoSaveFlow]);

  const handleNodeUpdate = useCallback((updatedNode: CustomNode) => {
    console.log('=== handleNodeUpdate START ===');
    console.log('Updated node ID:', updatedNode.id);
    console.log('Updated node type:', updatedNode.data.type);
    console.log('Updated node instructions:', updatedNode.data.instructions);
    console.log('Updated node step.next_flow_id:', updatedNode.data.step?.next_flow_id);
    console.log('Full updated node data:', JSON.stringify(updatedNode.data, null, 2));
    
    setNodes((nds) => {
      const newNodes = nds.map(node => 
        node.id === updatedNode.id ? updatedNode : node
      );
      console.log('New nodes after update:', newNodes.map(n => ({ id: n.id, instructions: n.data.instructions, next_flow_id: n.data.step?.next_flow_id })));
      console.log('=== handleNodeUpdate END ===');
      return newNodes;
    });
    
    // Auto-save after updating node
    setTimeout(() => {
      autoSaveFlow();
    }, 100);
  }, [autoSaveFlow]);

  const onSaveFlow = useCallback(async () => {
    console.log('=== onSaveFlow START ===');
    console.log('Current nodes count:', nodes.length);
    console.log('Current edges count:', edges.length);
    console.log('Current flow ID:', currentFlowId);
    console.log('Nodes state:', nodes.map(n => ({ id: n.id, instructions: n.data.instructions, next_flow_id: n.data.step?.next_flow_id })));
    
    try {
      console.log('Setting saving to true');
      setSaving(true);
      console.log('saving should be true now');
      
      // First, recalculate order_index based on edge connections
      console.log('Recalculating order_index based on edge connections...');
      console.log('Edges:', edges.map(e => ({ source: e.source, target: e.target })));
      
      // Create a map of node dependencies based on edges
      const nodeDependencies = new Map<string, string[]>();
      const nodeReverseDependencies = new Map<string, string[]>();
      
      // Initialize maps
      nodes.forEach(node => {
        nodeDependencies.set(node.id, []);
        nodeReverseDependencies.set(node.id, []);
      });
      
      // Build dependency graph from edges
      edges.forEach(edge => {
        if (edge.data?.route?.type === 'step') {
          // Only consider step-to-step edges for order calculation
          const sourceDeps = nodeDependencies.get(edge.source) || [];
          nodeDependencies.set(edge.source, [...sourceDeps, edge.target]);
          
          const targetReverseDeps = nodeReverseDependencies.get(edge.target) || [];
          nodeReverseDependencies.set(edge.target, [...targetReverseDeps, edge.source]);
        }
      });
      
      // Find nodes with no incoming edges (start nodes)
      const startNodes = nodes.filter(node => {
        const reverseDeps = nodeReverseDependencies.get(node.id) || [];
        return reverseDeps.length === 0;
      });
      
      console.log('Start nodes:', startNodes.map(n => n.id));
      
      // Perform topological sort to determine order
      const visited = new Set<string>();
      const order: string[] = [];
      
      const visit = (nodeId: string) => {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);
        
        const dependencies = nodeDependencies.get(nodeId) || [];
        dependencies.forEach(depId => visit(depId));
        
        order.push(nodeId);
      };
      
      // Visit all start nodes first
      startNodes.forEach(node => visit(node.id));
      
      // Visit any remaining nodes (in case of disconnected components)
      nodes.forEach(node => {
        if (!visited.has(node.id)) {
          visit(node.id);
        }
      });
      
      console.log('Topological order:', order);
      
      // Create a map from node ID to order_index (1-based)
      const orderIndexMap = new Map<string, number>();
      order.forEach((nodeId, index) => {
        orderIndexMap.set(nodeId, index + 1);
      });
      
      // Convert nodes back to steps with updated order_index, EXCLUDING deleted steps
      console.log('=== Converting nodes to steps ===');
      console.log('Nodes:', nodes.map(n => ({ 
        id: n.id, 
        type: n.data.type, 
        instructions: n.data.instructions, 
        step: n.data.step,
        step_next_flow_id: n.data.step?.next_flow_id 
      })));
      const updatedSteps: Step[] = nodes
        .filter(node => {
          const nodeData = node.data as NodeData;
          const step = nodeData.step as Step;
          // Keep only nodes whose step ID is NOT in deletedStepIds
          // Also handle cases where step might be undefined
          return step && step.id && !deletedStepIds.includes(step.id);
        })
        .map((node): Step => {
        const nodeData = node.data as NodeData;
        const step = nodeData.step as Step;
        const nodeTitle = nodeData.title;
        const nodeInstructions = nodeData.instructions;
        const nodeStepType = nodeData.step?.step_type;
        const nodeType = nodeData.type;
        
        console.log(`=== Processing node ${node.id} ===`);
        console.log(`  nodeInstructions="${nodeInstructions}"`);
        console.log(`  step.instructions="${step.instructions}"`);
        console.log(`  nodeType="${nodeType}"`);
        console.log(`  step.next_flow_id="${step.next_flow_id}"`);
        console.log(`  nodeData.step?.next_flow_id="${nodeData.step?.next_flow_id}"`);
        
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
        
        // Get the recalculated order_index
        const newOrderIndex = orderIndexMap.get(node.id) || step.order_index || 1;
        console.log(`Node ${node.id}: old order_index=${step.order_index}, new order_index=${newOrderIndex}`);
        
        // Find outgoing edges for this node to set default_next_step_id
        let defaultNextStepId: string | null = null;
        const outgoingEdges = edges.filter(edge => edge.source === node.id);
        if (outgoingEdges.length > 0) {
          // Use the first outgoing edge's target as the default next step
          // Note: This assumes unconditional edges. For conditional edges, we might need more complex logic
          const firstEdge = outgoingEdges[0];
          if (firstEdge.data?.route?.type === 'step') {
            defaultNextStepId = firstEdge.data.route.target_id;
          }
        }
        console.log(`Node ${node.id}: outgoing edges=${outgoingEdges.length}, default_next_step_id=${defaultNextStepId}`);
        
        const finalStep = {
          ...step,
          title: typeof nodeTitle === 'string' ? nodeTitle : step.title,
          instructions: typeof nodeInstructions === 'string' ? nodeInstructions : step.instructions,
          step_type: finalStepType,
          extra_step: extraStep,
          order_index: newOrderIndex,
          // Update input/output keys from node data if available
          input_keys: step.input_keys || null,
          output_keys: step.output_keys || '',
          // Save edge connection
          default_next_step_id: defaultNextStepId,
          // CRITICAL: Include next_flow_id from step object
          next_flow_id: step.next_flow_id || null,
        };
        
        console.log(`  Final step for node ${node.id}:`, {
          instructions: finalStep.instructions,
          next_flow_id: finalStep.next_flow_id,
          step_type: finalStep.step_type
        });
        
        return finalStep;
      });
      
      // Sort steps by order_index for consistency
      updatedSteps.sort((a, b) => a.order_index - b.order_index);
      
      // Save complete DAG to backend
      console.log('=== SAVING DAG ===');
      console.log('Steps to save:', updatedSteps.map(s => ({ 
        id: s.id, 
        instructions: s.instructions, 
        next_flow_id: s.next_flow_id,
        step_type: s.step_type 
      })));
      console.log('Edges to save:', edges.length);
      console.log('Deleted step IDs:', deletedStepIds);
      console.log('Deleted edge IDs:', deletedEdgeIds);
      const success = await saveFlowDAG(currentFlowId, updatedSteps, edges, deletedStepIds, deletedEdgeIds);
      
      if (success) {
        console.log(`Flow saved successfully with ${nodes.length} steps and ${edges.length} edges`);
        // Also save edges to localStorage for persistence
        storeEdges(currentFlowId, edges);
        // Clear deletion tracking after successful save
        setDeletedStepIds([]);
        setDeletedEdgeIds([]);
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
  }, [nodes, edges, currentFlowId, setSaving, loadFlowData]);

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
        type: 'default' as 'input' | 'default' | 'output' | 'response' | 'flow',
        data: {
          label: newStep.title,
          title: newStep.title,
          type: 'default' as 'input' | 'default' | 'output' | 'response' | 'flow',
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
      
      // Auto-save after adding step
      setTimeout(() => {
        autoSaveFlow();
      }, 100);
      
    } catch (error) {
      console.error('Error adding new step:', error);
      alert('Error adding new step. See console for details.');
    }
  }, [nodes, currentFlowId, autoSaveFlow]);

  // Function to add a new node from a source node
  const handleAddNodeFromSource = useCallback(async (sourceNodeId: string, nodeType: 'step' | 'response', dropPosition?: { x: number, y: number }) => {
    try {
      // Find source node
      const sourceNode = nodes.find(n => n.id === sourceNodeId);
      if (!sourceNode) {
        console.error('Source node not found:', sourceNodeId);
        return;
      }

      // Get source node's order_index
      const sourceStep = sourceNode.data?.step as Step | undefined;
      const sourceOrderIndex = sourceStep?.order_index || 1;
      
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
        stepTitle = `Response Node`;
      } else {
        stepType = 'default';
        stepTitle = `Step`;
      }

      // Calculate new order_index (insert after source node)
      const newOrderIndex = sourceOrderIndex + 1;
      
      // Create new step data with correct order_index
      const newStepData: Partial<Step> = {
        title: stepTitle,
        instructions: 'New step instructions...',
        step_type: stepType,
        order_index: newOrderIndex,
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
        type: (nodeType === 'step' ? 'default' : nodeType) as 'input' | 'default' | 'output' | 'response' | 'flow',
        data: {
          label: newStep.title,
          title: newStep.title,
          type: (nodeType === 'step' ? 'default' : nodeType) as 'input' | 'default' | 'output' | 'response' | 'flow',
          step: {
            ...newStep,
            type: stepType as 'input' | 'default' | 'output' | 'response',
          },
          instructions: newStep.instructions,
          command: '',
          await_input: false,
          variables: [],
        },
        position: newPosition,
      };
      
      // Find and redirect edges from source node
      const edgesFromSource = edges.filter(edge => edge.source === sourceNodeId);
      
      // Update nodes: insert new node and update order_index for subsequent nodes
      setNodes(prevNodes => {
        // Find source node to get its order_index
        const sourceNode = prevNodes.find(n => n.id === sourceNodeId);
        if (!sourceNode) return [...prevNodes, newNode];
        
        // Update order_index for all nodes with order_index >= newOrderIndex (increment by 1)
        // Exclude the source node itself
        const updatedNodes = prevNodes.map(node => {
          if (node.id === sourceNodeId) return node; // Don't update source node
          
          const nodeStep = node.data?.step as Step | undefined;
          if (nodeStep && nodeStep.order_index >= newOrderIndex) {
            // This node needs its order_index incremented
            const updatedStep = {
              ...nodeStep,
              order_index: nodeStep.order_index + 1,
            };
            return {
              ...node,
              data: {
                ...node.data,
                step: updatedStep,
              },
            };
          }
          return node;
        });
        
        // Add new node to the end (order doesn't matter for display, order_index does)
        return [...updatedNodes, newNode];
      });
      
      // Update edges: redirect edges from source to come from new node instead
      setEdges(prevEdges => {
        let updatedEdges = [...prevEdges];
        
        // Redirect all edges from source node to come from new node instead
        edgesFromSource.forEach(edge => {
          const edgeIndex = updatedEdges.findIndex(e => e.id === edge.id);
          if (edgeIndex !== -1) {
            updatedEdges[edgeIndex] = {
              ...updatedEdges[edgeIndex],
              source: newNode.id,
              id: `e${newNode.id}-${edge.target}`,
            };
          }
        });
        
        // Create new edge from source to new node
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
        
        return [...updatedEdges, newEdge];
      });
      
      // Select the new node to open the step popup
      setSelectedNode(newNode);
      
      // Close the menu
      setAddNodeMenu({ show: false, sourceNodeId: null, position: { x: 0, y: 0 } });
      
      // Auto-save after adding node
      setTimeout(() => {
        autoSaveFlow();
      }, 100);
      
    } catch (error) {
      console.error('Error adding new node from source:', error);
      alert('Error adding new node. See console for details.');
    }
  }, [nodes, edges, currentFlowId, reactFlowInstance, autoSaveFlow]);

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
        type: 'default' as 'input' | 'default' | 'output' | 'response' | 'flow',
        data: {
          label: newStep.title,
          title: newStep.title,
          type: 'default' as 'input' | 'default' | 'output' | 'response' | 'flow',
          step: {
            ...newStep,
            type: 'default' as 'input' | 'default' | 'output' | 'response',
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
        type: nodeType as 'input' | 'default' | 'output' | 'response' | 'flow',
        data: {
          label: newStep.title,
          title: newStep.title,
          type: nodeType as 'input' | 'default' | 'output' | 'response' | 'flow',
          step: {
            ...newStep,
            type: stepType as 'input' | 'default' | 'output' | 'response',
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
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-500 mx-auto"></div>
          <p className="mt-4 text-neutral-300">Loading flow data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="p-6">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-white">Flow Designer</h1>
            <p className="text-neutral-300">
              Flow: <span className="font-mono text-gray-400">{flowDefinition?.name || currentFlowId}</span>
              {flowDefinition && (
                <button
                  onClick={() => setShowEditFlowModal(true)}
                  className="ml-4 text-sm text-neutral-400 hover:text-white"
                >
                  Edit Flow Details
                </button>
              )}
            </p>
            {flowDefinition?.description && (
              <p className="text-neutral-400 mt-1 max-w-2xl">{flowDefinition.description}</p>
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
              className="bg-neutral-800 hover:bg-neutral-700 px-5 py-1.5 rounded-lg font-medium text-neutral-200 hover:text-white transition-colors border border-neutral-700"
            >
              {saving ? 'Saving...' : 'Save Flow'}
            </button>
            <div className="text-xs text-neutral-500 mt-1">saving state: {saving ? 'true' : 'false'}</div>
            <button
              onClick={() => router.push('/chat')}
              className="bg-neutral-800 hover:bg-neutral-700 px-5 py-1.5 rounded-lg font-medium border border-neutral-700 text-neutral-200 hover:text-white transition-colors"
            >
              Back to Chat
            </button>
            <button
              onClick={() => {
                const { nodes: layoutedNodes } = getLayoutedElements(nodes, edges);
                setNodes(layoutedNodes);
              }}
              className="bg-gray-700 hover:bg-gray-600 px-5 py-1.5 rounded-lg font-medium border border-gray-600 text-gray-200 hover:text-white transition-colors"
            >
              Auto Layout
            </button>
            <button
              onClick={async () => {
                if (startingFlow) return;
                
                setStartingFlow(true);
                setFlowRunError(null);
                setFlowRunId(null);
                
                try {
                  console.log('Starting flow:', currentFlowId);
                  
                  // Start the flow (same as chat UI)
                  const flowResponse = await fetch('/api/proxy/start', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      flow_id: currentFlowId,
                      input_prompt: ''
                    }),
                  });
                  
                  if (!flowResponse.ok) throw new Error('Failed to start flow');
                  
                  const flowResult = await flowResponse.json();
                  
                  if (!flowResult.success) {
                    throw new Error(flowResult.error || 'Failed to start flow execution');
                  }
                  
                  console.log('Flow started successfully:', flowResult);
                  console.log('Flow result data:', flowResult.data);
                  console.log('Conversation ID:', flowResult.data?.conversation_id);
                  console.log('Flow Run ID:', flowResult.data?.flow_run_id);
                  
                  // Get conversation ID and flow run ID from response
                  const conversationId = flowResult.data?.conversation_id;
                  const flowRunId = flowResult.data?.flow_run_id;
                  
                  // If we have flowRunId from the response, use it directly
                  if (flowRunId) {
                    console.log('Setting flow run ID from response:', flowRunId);
                    setFlowRunId(flowRunId);
                  } else if (conversationId) {
                    // Fallback: Poll to find the flow run ID if flowRunId is not in response
                    console.log('Flow run ID not in response, falling back to polling with conversation ID:', conversationId);
                    let attempts = 0;
                    const maxAttempts = 30; // Increased from 10 to 30
                    
                    while (attempts < maxAttempts) {
                      const flowRunsResponse = await fetch('/api/proxy/api/flow-runs');
                      if (flowRunsResponse.ok) {
                        const flowRuns = await flowRunsResponse.json();
                        console.log(`Polling attempt ${attempts + 1}/${maxAttempts}: Available flow runs:`, flowRuns.length);
                        
                        // Try to find the most recent flow run for this flow_id
                        const flowRunsForThisFlow = flowRuns.filter((run: any) => run.flow_id === currentFlowId);
                        console.log(`Flow runs for flow ${currentFlowId}:`, flowRunsForThisFlow.length);
                        
                        if (flowRunsForThisFlow.length > 0) {
                          // Sort by created_at (newest first) and take the most recent
                          const sortedRuns = flowRunsForThisFlow.sort((a: any, b: any) => b.created_at - a.created_at);
                          const mostRecentRun = sortedRuns[0];
                          
                          console.log('Found matching flow run:', mostRecentRun.id, 'created_at:', mostRecentRun.created_at, 'status:', mostRecentRun.status);
                          setFlowRunId(mostRecentRun.id);
                          break;
                        } else {
                          console.log(`No flow runs found for flow_id: ${currentFlowId}, attempt ${attempts + 1}/${maxAttempts}`);
                          
                          // Also check for flow runs with null flow_id that might be ours
                          const nullFlowIdRuns = flowRuns.filter((run: any) => !run.flow_id);
                          console.log(`Flow runs with null flow_id:`, nullFlowIdRuns.length);
                        }
                      } else {
                        console.log(`Flow runs API returned ${flowRunsResponse.status}`);
                      }
                      
                      attempts++;
                      await new Promise(resolve => setTimeout(resolve, 2000)); // Increased from 1s to 2s
                    }
                    
                    if (attempts >= maxAttempts) {
                      console.log(`Gave up after ${maxAttempts} attempts. No flow run found for flow ${flowId}`);
                      setFlowRunError(`Flow started but no flow run was created after ${maxAttempts * 2} seconds. Check backend logs.`);
                    }
                  }
                  
                } catch (error: any) {
                  console.error('Error starting flow:', error);
                  setFlowRunError(error.message || 'Failed to start flow');
                } finally {
                  setStartingFlow(false);
                }
              }}
              disabled={startingFlow}
              className="px-5 py-1.5 rounded-lg font-medium border border-green-700 bg-green-600 hover:bg-green-700 text-white transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Start this flow"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {startingFlow ? 'Starting...' : 'Start Flow'}
            </button>
          </div>
          
          {/* Flow run status and link */}
          {(flowRunId || flowRunError) && (
            <div className="mt-4 p-4 bg-gray-900/50 border border-gray-800 rounded-lg">
              {flowRunError ? (
                <div className="text-red-400 text-sm">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Error: {flowRunError}</span>
                  </div>
                </div>
              ) : flowRunId ? (
                <div className="text-green-400 text-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Flow started successfully!</span>
                  </div>
                  <a 
                    href={`/chat?flowRun=${flowRunId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors underline"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    View flow run in chat
                  </a>
                </div>
              ) : null}
            </div>
          )}
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
            className="w-full h-[700px] bg-neutral-900 rounded-lg border border-neutral-800"
            onDragOver={onDragOver}
            onDrop={onDrop}
          >
            {/* Empty Flow Button */}
            {showEmptyFlowButton && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <button
                  onClick={handleCreateFirstStep}
                  className="bg-gray-600 hover:bg-gray-700 text-white rounded-full w-16 h-16 flex items-center justify-center text-2xl font-bold shadow-lg transition-all hover:scale-110"
                  title="Create first step"
                >
                  +
                </button>
                <div className="absolute bottom-1/4 text-center text-neutral-400 text-sm mt-4">
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
                  return '#0f172a'; // default dark
                }}
                nodeStrokeColor={(node) => {
                  if (node.type === 'input') return '#0ea5e9'; // sky-500
                  if (node.type === 'output') return '#8b5cf6'; // violet-500
                  if (node.type === 'response') return '#f59e0b'; // amber-500
                  return '#334155'; // default border
                }}
              />
              {/* Node Toolbar REMOVED - All nodes added via edge drop */}

              <Panel position="top-right" className="bg-neutral-900/60 backdrop-blur-sm rounded-lg p-3 border border-neutral-800">
                <div className="text-sm text-neutral-300">
                  <div className="font-medium mb-1">Flow Controls</div>
                  <div className="text-xs text-neutral-400 space-y-0.5">
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
            className="fixed z-50 bg-neutral-900 border border-neutral-700 rounded-lg shadow-lg p-2 min-w-[160px]"
            style={{
              left: addNodeMenu.position.x,
              top: addNodeMenu.position.y,
            }}
          >
            <div className="text-xs text-neutral-400 mb-1 px-2 pt-1">Add from node:</div>
            <button
              onClick={() => handleAddNodeFromSource(addNodeMenu.sourceNodeId!, 'step', addNodeMenu.position)}
              className="w-full text-left px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 rounded-md flex items-center"
            >
              <span className="mr-2">+</span>
              Add Step
            </button>
            <button
              onClick={() => handleAddNodeFromSource(addNodeMenu.sourceNodeId!, 'response', addNodeMenu.position)}
              className="w-full text-left px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 rounded-md flex items-center"
            >
              <span className="mr-2 text-yellow-400">🔄</span>
              Add Response
            </button>
            <div className="border-t border-neutral-800 mt-2 pt-2">
              <button
                onClick={() => setAddNodeMenu({ show: false, sourceNodeId: null, position: { x: 0, y: 0 } })}
                className="w-full text-left px-3 py-2 text-sm text-neutral-400 hover:bg-neutral-800 rounded-md"
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
            flowId={flowId}
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

        {/* Debug Panel for API Requests */}
        <DebugPanelAggressive />
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