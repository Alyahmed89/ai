'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import EditStepModal from './EditStepModal';
import ApiEndpointsModal from './ApiEndpointsModal';
import { FlowDefinition, FlowRun, FlowStep } from '@/types';

interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}





interface HierarchicalNavProps {
  onSelectProject?: (projectId: string | null) => void;
  onSelectFlow?: (flowId: string | null) => void;
  onSelectFlowRun?: (flowRunId: string | null) => void;
  onSelectStep?: (stepId: string | null) => void;
  onCreateProject?: () => void;
  onCreateFlow?: () => void;
  onCreateStep?: () => void;
  onEditFlow?: (flowId: string) => void;
}

export default function HierarchicalNav({
  onSelectProject,
  onSelectFlow,
  onSelectFlowRun,
  onSelectStep,
  onCreateProject,
  onCreateFlow,
  onCreateStep,
  onEditFlow
}: HierarchicalNavProps) {
  console.log('HierarchicalNav props:', { onEditFlow, onSelectFlow, onCreateFlow });
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [flows, setFlows] = useState<FlowDefinition[]>([]);
  const [flowRuns, setFlowRuns] = useState<FlowRun[]>([]);
  const [flowSteps, setFlowSteps] = useState<FlowStep[]>([]);
  
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  
  const pathname = usePathname();

  // Parse URL to determine selected project/flow
  useEffect(() => {
    console.log('HierarchicalNav - Parsing URL:', pathname);
    
    // Check if we're on a project page: /chat/projects/[projectId]
    const projectMatch = pathname.match(/^\/chat\/projects\/([^\/]+)$/);
    if (projectMatch) {
      const projectId = projectMatch[1];
      console.log('HierarchicalNav - Project selected from URL:', projectId);
      setSelectedProjectId(projectId);
      setSelectedFlowId(null);
      return;
    }
    
    // Check if we're on a flow page: /chat/flows/[flowId]
    const flowMatch = pathname.match(/^\/chat\/flows\/([^\/]+)$/);
    if (flowMatch) {
      const flowId = flowMatch[1];
      console.log('HierarchicalNav - Flow selected from URL:', flowId);
      setSelectedFlowId(flowId);
      setSelectedProjectId(null); // Clear project selection when on flow page
      return;
    }
    
    // If we're on the main chat page, clear selection
    if (pathname === '/chat') {
      setSelectedProjectId(null);
      setSelectedFlowId(null);
    }
  }, [pathname]); // Run when pathname changes

  // Debug logging for data
  useEffect(() => {
    console.log('HierarchicalNav data debug:', {
      projectsCount: projects.length,
      flowsCount: flows.length,
      selectedProjectId,
      selectedFlowId,
      projects: projects.map(p => ({ id: p.id, name: p.name })),
      flows: flows.map(f => ({ id: f.id, name: f.name, agent: f.agent }))
    });
  }, [projects, flows, selectedProjectId, selectedFlowId]);

  const [selectedFlowRunId, setSelectedFlowRunId] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'steps' | 'flowRuns'>('steps');
  const [editingStep, setEditingStep] = useState<FlowStep | null>(null);
  const [showApiEndpointsModal, setShowApiEndpointsModal] = useState(false);
  const [deletingStepId, setDeletingStepId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [stepToDelete, setStepToDelete] = useState<string | null>(null);
  
  const [loading, setLoading] = useState({
    projects: false,
    flows: false,
    flowRuns: false,
    steps: false
  });

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects();
    fetchFlows();
    fetchFlowRuns();
  }, []);

  // Fetch flows when project changes (for now, fetch all)
  useEffect(() => {
    if (selectedProjectId) {
      // In future, filter flows by project
      fetchFlows();
    }
  }, [selectedProjectId]);

  // Fetch flow runs and steps when flow changes
  useEffect(() => {
    if (selectedFlowId) {
      fetchFlowRuns();
      fetchFlowSteps();
    } else {
      setFlowSteps([]);
      setSelectedStepId(null);
    }
  }, [selectedFlowId]);

  const fetchProjects = async () => {
    setLoading(prev => ({ ...prev, projects: true }));
    try {
      const response = await fetch('/api/proxy/api/projects');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setProjects(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(prev => ({ ...prev, projects: false }));
    }
  };

  const fetchFlows = async () => {
    setLoading(prev => ({ ...prev, flows: true }));
    try {
      const response = await fetch('/api/proxy/api/flow-definitions');
      if (response.ok) {
        const data = await response.json();
        setFlows(data);
      }
    } catch (error) {
      console.error('Error fetching flows:', error);
    } finally {
      setLoading(prev => ({ ...prev, flows: false }));
    }
  };



  const fetchFlowRuns = async () => {
    setLoading(prev => ({ ...prev, flowRuns: true }));
    try {
      const response = await fetch('/api/proxy/api/flow-runs');
      if (response.ok) {
        const data = await response.json();
        setFlowRuns(data);
      }
    } catch (error) {
      console.error('Error fetching flow runs:', error);
    } finally {
      setLoading(prev => ({ ...prev, flowRuns: false }));
    }
  };

  const fetchFlowSteps = async () => {
    if (!selectedFlowId) return;
    
    setLoading(prev => ({ ...prev, steps: true }));
    try {
      const response = await fetch(`/api/proxy/api/flow-steps?flow_id=${selectedFlowId}`);
      if (response.ok) {
        const data = await response.json();
        
        // Handle different response formats for steps
        let stepsArray = [];
        if (data.success !== undefined && data.data) {
          stepsArray = data.data;
        } else if (Array.isArray(data)) {
          stepsArray = data;
        } else if (data.data && Array.isArray(data.data)) {
          stepsArray = data.data;
        }
        
        // Filter steps for this flow and sort by order_index
        const filteredSteps = stepsArray
          .filter((step: any) => step.flow_id === selectedFlowId)
          .sort((a: any, b: any) => a.order_index - b.order_index);
        setFlowSteps(filteredSteps);
      }
    } catch (error) {
      console.error('Error fetching flow steps:', error);
    } finally {
      setLoading(prev => ({ ...prev, steps: false }));
    }
  };

  const handleProjectSelect = (projectId: string | null) => {
    console.log('handleProjectSelect called with projectId:', projectId);
    setSelectedProjectId(projectId);
    setSelectedFlowId(null);
    setSelectedFlowRunId(null);
    onSelectProject?.(projectId);
    
    // Navigate to chat view with project
    if (projectId) {
      console.log('Navigating to /chat/projects/${projectId}');
      router.push(`/chat/projects/${projectId}`);
    }
  };

  const handleFlowSelect = (flowId: string | null) => {
    console.log('handleFlowSelect called with flowId:', flowId);
    setSelectedFlowId(flowId);
    setSelectedFlowRunId(null);
    setActiveSection('steps'); // Reset to steps when selecting a new flow
    onSelectFlow?.(flowId);
    
    // Navigate to chat view with flow
    if (flowId) {
      console.log('Navigating to /chat/flows/${flowId}');
      router.push(`/chat/flows/${flowId}`);
    }
  };



  const handleFlowRunSelect = (flowRunId: string | null) => {
    setSelectedFlowRunId(flowRunId);
    onSelectFlowRun?.(flowRunId);
    
    // Navigate to chat view with flow run
    if (flowRunId) {
      router.push(`/chat/flow-run/${flowRunId}`);
    }
  };

  const handleStepSelect = (stepId: string | null) => {
    setSelectedStepId(stepId);
    onSelectStep?.(stepId);
  };

  const handleCreateStep = async () => {
    if (!selectedFlowId) {
      alert('Please select a flow first');
      return;
    }

    try {
      // Create a new step
      const newStep = {
        flow_id: selectedFlowId,
        step_key: `step_${Date.now()}`,
        title: 'New Step',
        instructions: 'New step instructions...',
        step_type: 'default',
        order_index: filteredSteps.length,
        page_key: null,
        blocking: false,
        auto_fail_on_error: false,
        retryable: false,
        output_keys: '[]',
        output_url: null,
        output_payload_template: null,
        default_next_step: null,
        output_auth_token: null,
        input_keys: '[]',
        use_endpoints: '[]',
        output: false,
        default_next_step_id: null,
        step_number: null,
        requires_task: false
      };

      const response = await fetch('/api/proxy/api/flow-steps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newStep)
      });

      if (!response.ok) throw new Error('Failed to create step');

      const data = await response.json();
      
      if (data.success) {
        // Refresh steps
        fetchFlowSteps();
        // Open the new step for editing
        if (data.data && data.data.id) {
          // Find the newly created step - convert booleans back to numbers for FlowStep interface
          const createdStep = {
            ...newStep,
            id: data.data.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            task_id: null,
            // Convert booleans to numbers for FlowStep interface
            blocking: newStep.blocking ? 1 : 0,
            auto_fail_on_error: newStep.auto_fail_on_error ? 1 : 0,
            retryable: newStep.retryable ? 1 : 0,
            output: newStep.output ? 1 : 0,
            requires_task: newStep.requires_task ? 1 : 0
          };
          setEditingStep(createdStep as FlowStep);
        }
      } else {
        throw new Error(data.error || 'Failed to create step');
      }
    } catch (error) {
      console.error('Error creating step:', error);
      alert(`Failed to create step: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    setShowDeleteConfirm(true);
    setStepToDelete(stepId);
  };

  const confirmDeleteStep = async () => {
    if (!stepToDelete) return;

    setDeletingStepId(stepToDelete);
    setShowDeleteConfirm(false);
    
    try {
      const response = await fetch(`/api/proxy/api/flow-steps/${stepToDelete}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete step');

      const data = await response.json();
      
      if (data.success) {
        // Refresh steps
        fetchFlowSteps();
        // Clear selection if deleted step was selected
        if (selectedStepId === stepToDelete) {
          setSelectedStepId(null);
          onSelectStep?.(null);
        }
      } else {
        throw new Error(data.error || 'Failed to delete step');
      }
    } catch (error) {
      console.error('Error deleting step:', error);
      alert(`Failed to delete step: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDeletingStepId(null);
      setStepToDelete(null);
    }
  };

  const cancelDeleteStep = () => {
    setShowDeleteConfirm(false);
    setStepToDelete(null);
  };

  // Filter flow runs by selected flow
  const filteredFlowRuns = selectedFlowId
    ? flowRuns.filter(run => run.flow_id === selectedFlowId)
    : [];

  // Filter steps by selected flow (already filtered in fetch, but keep for consistency)
  const filteredSteps = selectedFlowId
    ? flowSteps.filter(step => step.flow_id === selectedFlowId)
    : [];

  // Format time ago
  const formatTimeAgo = (timestamp: number | string) => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffDay > 0) return `${diffDay}d ago`;
    if (diffHour > 0) return `${diffHour}h ago`;
    if (diffMin > 0) return `${diffMin}m ago`;
    return `${diffSec}s ago`;
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 border-r border-gray-800">
      {/* Header with back button when not at root */}
      {(selectedProjectId || selectedFlowId) && (
        <div className="p-4 border-b border-gray-800">
          <button
            onClick={() => {
              if (selectedFlowId) {
                handleFlowSelect(null);
              } else if (selectedProjectId) {
                handleProjectSelect(null);
              }
            }}
            className="flex items-center text-sm text-gray-400 hover:text-gray-300"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back {selectedFlowId ? 'to Flows' : 'to Projects'}
          </button>
        </div>
      )}

      {/* Projects Section (shown when no project is selected) */}
      {!selectedProjectId && !selectedFlowId && (
        <div className="p-4 border-b border-gray-800 flex-1">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span className="text-sm font-medium text-gray-300">Projects</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowApiEndpointsModal(true)}
                className="text-xs text-purple-400 hover:text-purple-300 flex items-center"
                title="View API Endpoints"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </button>
              {onCreateProject && (
                <button
                  onClick={onCreateProject}
                  className="text-xs text-gray-400 hover:text-gray-300 flex items-center"
                  title="Create New Project"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              )}
              {loading.projects && (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-500"></div>
              )}
            </div>
          </div>
          <div className="space-y-1 max-h-[calc(100vh-200px)] overflow-y-auto custom-scrollbar">
            {projects.map(project => (
              <button
                key={project.id}
                onClick={() => handleProjectSelect(project.id)}
                className={`w-full text-left px-3 py-2 rounded text-sm flex items-center justify-between ${
                  selectedProjectId === project.id 
                    ? 'bg-gray-900/30 text-gray-300' 
                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-300'
                }`}
              >
                <div className="flex items-center min-w-0 flex-1">
                  {/* Project icon */}
                  <svg className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span className="truncate">{project.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Flows Section (shown when project is selected) */}
      {selectedProjectId && !selectedFlowId && (
        <div className="p-4 border-b border-gray-800 flex-1">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <span className="text-sm font-medium text-gray-300">Flows</span>
            </div>
            <div className="flex items-center space-x-2">
              {onCreateFlow && (
                <button
                  onClick={onCreateFlow}
                  className="text-xs text-gray-400 hover:text-gray-300 flex items-center"
                  title="Create New Flow"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              )}
              {loading.flows && (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-500"></div>
              )}
            </div>
          </div>
          <div className="space-y-1 max-h-[calc(100vh-200px)] overflow-y-auto custom-scrollbar">
            {flows.map(flow => (
              <div key={flow.id} className="group flex items-center">
                <button
                  onClick={() => handleFlowSelect(flow.id)}
                  className={`w-full text-left px-3 py-2 rounded text-sm flex items-center justify-between ${
                    selectedFlowId === flow.id 
                      ? 'bg-gray-900/30 text-gray-300' 
                      : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-300'
                  }`}
                >
                  <div className="flex items-center min-w-0 flex-1">
                    <span className="truncate">{flow.name}</span>
                  </div>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flow Details Section (shown when flow is selected) */}
      {selectedFlowId && (
        <div className="flex-1 overflow-y-auto">
          {/* Flow Info Header */}
          <div className="p-4 border-b border-gray-800">
            <div className="mb-2">
              <div className="flex items-center mb-3 group">
                <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-sm font-medium text-gray-300 truncate">
                  {flows.find(f => f.id === selectedFlowId)?.name || 'Flow'}
                </span>
                {/* Flow designer icon */}
                <button
                  onClick={() => router.push(`/flows/design/${selectedFlowId}`)}
                  className="ml-2 text-gray-400 hover:text-gray-400 flex-shrink-0"
                  title="Open Flow Designer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                {onEditFlow && selectedFlowId && (
                  <button
                    onClick={() => onEditFlow(selectedFlowId)}
                    className="invisible group-hover:visible ml-2 text-gray-400 hover:text-gray-300 flex-shrink-0"
                    title="Edit Flow"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {/* Runs icon - clickable */}
                <button
                  onClick={() => setActiveSection('flowRuns')}
                  className={`flex items-center text-xs px-2 py-1 rounded ${
                    activeSection === 'flowRuns'
                      ? 'bg-gray-900/30 text-gray-300'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                  }`}
                  title="Show Flow Runs"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Runs: {filteredFlowRuns.length}</span>
                </button>
                {/* Step icon - clickable */}
                <button
                  onClick={() => setActiveSection('steps')}
                  className={`flex items-center text-xs px-2 py-1 rounded ${
                    activeSection === 'steps'
                      ? 'bg-gray-900/30 text-gray-300'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                  }`}
                  title="Show Steps"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span>Steps: {filteredSteps.length}</span>
                </button>

              </div>
            </div>
          </div>

          {/* Steps Section - shown when activeSection is 'steps' */}
          {activeSection === 'steps' && (
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-sm font-medium text-gray-300">Steps</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleCreateStep}
                      className="text-xs text-gray-400 hover:text-gray-300 flex items-center"
                      title="Create New Step"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                    {loading.steps && (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-500"></div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="space-y-1 p-4">
                  {filteredSteps.map(step => (
                    <div 
                      key={step.id}
                      className="group flex items-center"
                    >
                      <button
                        onClick={() => handleStepSelect(step.id)}
                        className={`w-full text-left px-3 py-2 rounded text-sm flex items-center justify-between ${
                          selectedStepId === step.id 
                            ? 'bg-gray-900/30 text-gray-300' 
                            : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-300'
                        }`}
                      >
                        <div className="flex items-center min-w-0 flex-1">
                          <span className="truncate">{step.title}</span>
                        </div>
                      </button>
                      
                      {/* Action buttons - visible on hover */}
                      <div className="invisible group-hover:visible flex items-center ml-1">
                        {/* Edit button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingStep(step);
                          }}
                          className="text-gray-400 hover:text-gray-300 p-1 flex-shrink-0"
                          title="Edit Step"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        
                        {/* Delete button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteStep(step.id);
                          }}
                          className="text-gray-400 hover:text-red-400 p-1 flex-shrink-0"
                          title="Delete Step"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}



          {/* Flow Runs Section - shown when activeSection is 'flowRuns' */}
          {activeSection === 'flowRuns' && (
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span className="text-sm font-medium text-gray-300">Flow Runs</span>
                  </div>
                  {loading.flowRuns && (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-500"></div>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="space-y-1 p-4">
                  {filteredFlowRuns.map(run => (
                    <button
                      key={run.id}
                      onClick={() => handleFlowRunSelect(run.id)}
                      className={`w-full text-left px-3 py-2 rounded text-sm flex items-center justify-between ${
                        selectedFlowRunId === run.id 
                          ? 'bg-gray-900/30 text-gray-300' 
                          : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-300'
                      }`}
                    >
                      <div className="flex items-center min-w-0 flex-1">
                        <span className="truncate">{run.id.substring(0, 8)}...</span>
                        <div className={`ml-2 w-2 h-2 rounded-full flex-shrink-0 ${
                          run.status === 'active' ? 'bg-green-500' :
                          run.status === 'completed' ? 'bg-gray-500' :
                          'bg-gray-500'
                        }`} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Step Modal */}
      {editingStep && (
        <EditStepModal
          step={editingStep}
          onClose={() => setEditingStep(null)}
          onStepUpdated={(stepId) => {
            console.log('Step updated:', stepId);
            setEditingStep(null);
            // Refresh step data after update
            fetchFlowSteps();
          }}
        />
      )}

      {/* API Endpoints Modal */}
      <ApiEndpointsModal
        isOpen={showApiEndpointsModal}
        onClose={() => setShowApiEndpointsModal(false)}
      />
    </div>
  );
}