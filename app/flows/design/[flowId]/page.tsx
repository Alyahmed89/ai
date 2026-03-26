'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { startFlow, runStep } from '@/api';

// Simple types for flow visualization
type FlowNode = Node & {
  data: {
    label: string;
    status?: 'pending' | 'running' | 'completed' | 'error';
    output?: any;
  };
};

type FlowEdge = Edge;

export default function FlowDesignPage() {
  const params = useParams();
  const flowId = params.flowId as string;
  
  // Minimal state for UI
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentFlowRunId, setCurrentFlowRunId] = useState<string | null>(null);
  const [output, setOutput] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize with simple nodes for visualization
  useEffect(() => {
    const initialNodes: FlowNode[] = [
      {
        id: 'start',
        type: 'input',
        position: { x: 250, y: 50 },
        data: { label: 'Start Flow', status: 'pending' },
      },
      {
        id: 'step-1',
        position: { x: 250, y: 150 },
        data: { label: 'Step 1', status: 'pending' },
      },
      {
        id: 'step-2',
        position: { x: 250, y: 250 },
        data: { label: 'Step 2', status: 'pending' },
      },
      {
        id: 'end',
        type: 'output',
        position: { x: 250, y: 350 },
        data: { label: 'End', status: 'pending' },
      },
    ];

    const initialEdges: FlowEdge[] = [
      { id: 'e-start-1', source: 'start', target: 'step-1' },
      { id: 'e-1-2', source: 'step-1', target: 'step-2' },
      { id: 'e-2-end', source: 'step-2', target: 'end' },
    ];

    setNodes(initialNodes);
    setEdges(initialEdges);
  }, []);

  // Safe execution loop
  const runFlow = async (flow_id: string, input: any = {}) => {
    try {
      const start = await startFlow(flow_id, input);
      let flow_run_id = start.flow_run_id;
      
      // Update start node status
      setNodes(prev => prev.map(node => 
        node.id === 'start' 
          ? { ...node, data: { ...node.data, status: 'completed' } }
          : node
      ));
      
      setCurrentFlowRunId(flow_run_id);
      setOutput(prev => ({ ...prev, current_flow: flow_id, flow_run_id }));
      
      while (true) {
        const res = await runStep(flow_run_id);
        
        // Update UI with step result
        setNodes(prev => prev.map(node => {
          if (node.id.includes('step') && node.data.status === 'pending') {
            return { ...node, data: { ...node.data, status: 'completed', output: res.output } };
          }
          return node;
        }));
        
        setOutput(prev => ({ ...prev, last_step: res }));
        
        // Handle cross-flow transition
        if (res.next_flow_id) {
          // Update end node status before moving to next flow
          setNodes(prev => prev.map(node => 
            node.id === 'end' 
              ? { ...node, data: { ...node.data, status: 'completed' } }
              : node
          ));
          
          setOutput(prev => ({ 
            ...prev, 
            message: `Moving to next flow: ${res.next_flow_id}`,
            next_flow: res.next_flow_id 
          }));
          
          // Recursively run the next flow
          await runFlow(res.next_flow_id, {});
          return;
        }
        
        // Stop when no next step
        if (!res.next_step_id) {
          // Update end node status
          setNodes(prev => prev.map(node => 
            node.id === 'end' 
              ? { ...node, data: { ...node.data, status: 'completed' } }
              : node
          ));
          break;
        }
        
        // Small delay for visualization
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Flow execution failed');
      throw err;
    }
  };

  // Start flow execution
  const handleStartFlow = async () => {
    setLoading(true);
    setError(null);
    setOutput(null);
    
    try {
      await runFlow(flowId, {});
    } catch (err) {
      // Error already set in runFlow
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="p-4 border-b">
        <h1 className="text-2xl font-bold">Flow: {flowId}</h1>
        <div className="mt-2 flex space-x-4">
          <button
            onClick={handleStartFlow}
            disabled={loading || !!currentFlowRunId}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Running...' : 'Start Flow'}
          </button>
          {error && (
            <div className="text-red-600">
              Error: {error}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-1 grid grid-cols-3">
        <div className="col-span-2">
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              fitView
            >
              <Background variant={BackgroundVariant.Dots} />
              <Controls />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
        
        <div className="border-l p-4 overflow-auto">
          <h2 className="text-xl font-bold mb-4">Output</h2>
          {output && (
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(output, null, 2)}
            </pre>
          )}
          {!output && (
            <p className="text-gray-500">No output yet. Start the flow to see results.</p>
          )}
        </div>
      </div>
    </div>
  );
}