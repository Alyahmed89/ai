'use client';

import { useState, useEffect } from 'react';

interface Project {
  id: string;
  name: string;
  status: string;
  created_at: number;
  updated_at: number;
  metadata: string;
  deleted_at: number | null;
}

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

interface Task {
  id: string;
  title: string | null;
  description: string | null;
  task_type: string | null;
  priority: string | null;
  status: string;
  flow_id: string | null;
  created_at: string;
  action: string | null;
}

interface FlowRun {
  id: string;
  flow_id: string;
  status: string;
  created_at: number;
  completed_at: number | null;
  output_response: string | null;
  step_count: number;
  last_step_at: number | null;
}

interface HierarchicalNavProps {
  onSelectProject?: (projectId: string | null) => void;
  onSelectFlow?: (flowId: string | null) => void;
  onSelectTask?: (taskId: string | null) => void;
  onSelectFlowRun?: (flowRunId: string | null) => void;
  onCreateFlow?: () => void;
}

export default function HierarchicalNav({
  onSelectProject,
  onSelectFlow,
  onSelectTask,
  onSelectFlowRun,
  onCreateFlow
}: HierarchicalNavProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [flows, setFlows] = useState<FlowDefinition[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [flowRuns, setFlowRuns] = useState<FlowRun[]>([]);
  
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedFlowRunId, setSelectedFlowRunId] = useState<string | null>(null);
  
  const [loading, setLoading] = useState({
    projects: false,
    flows: false,
    tasks: false,
    flowRuns: false
  });

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects();
    fetchFlows();
    fetchTasks();
    fetchFlowRuns();
  }, []);

  // Fetch flows when project changes (for now, fetch all)
  useEffect(() => {
    if (selectedProjectId) {
      // In future, filter flows by project
      fetchFlows();
    }
  }, [selectedProjectId]);

  // Fetch tasks when flow changes
  useEffect(() => {
    if (selectedFlowId) {
      fetchTasks();
      fetchFlowRuns();
    }
  }, [selectedFlowId]);

  const fetchProjects = async () => {
    setLoading(prev => ({ ...prev, projects: true }));
    try {
      const response = await fetch('/api/proxy/graph/projects');
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

  const fetchTasks = async () => {
    setLoading(prev => ({ ...prev, tasks: true }));
    try {
      const response = await fetch('/api/proxy/api/tasks');
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(prev => ({ ...prev, tasks: false }));
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

  const handleProjectSelect = (projectId: string | null) => {
    setSelectedProjectId(projectId);
    setSelectedFlowId(null);
    setSelectedTaskId(null);
    setSelectedFlowRunId(null);
    onSelectProject?.(projectId);
  };

  const handleFlowSelect = (flowId: string | null) => {
    setSelectedFlowId(flowId);
    setSelectedTaskId(null);
    setSelectedFlowRunId(null);
    onSelectFlow?.(flowId);
  };

  const handleTaskSelect = (taskId: string | null) => {
    setSelectedTaskId(taskId);
    onSelectTask?.(taskId);
  };

  const handleFlowRunSelect = (flowRunId: string | null) => {
    setSelectedFlowRunId(flowRunId);
    onSelectFlowRun?.(flowRunId);
  };

  // Filter tasks by selected flow
  const filteredTasks = selectedFlowId 
    ? tasks.filter(task => task.flow_id === selectedFlowId)
    : [];

  // Filter flow runs by selected flow
  const filteredFlowRuns = selectedFlowId
    ? flowRuns.filter(run => run.flow_id === selectedFlowId)
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
            {loading.projects && (
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
            )}
          </div>
          <div className="space-y-1 max-h-[calc(100vh-200px)] overflow-y-auto">
            {projects.map(project => (
              <button
                key={project.id}
                onClick={() => handleProjectSelect(project.id)}
                className={`w-full text-left px-3 py-2 rounded text-sm flex items-center justify-between ${
                  selectedProjectId === project.id 
                    ? 'bg-blue-900/30 text-blue-300' 
                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-300'
                }`}
              >
                <span className="truncate">{project.name}</span>
                <span className="text-xs text-gray-500 ml-2">
                  {formatTimeAgo(project.created_at * 1000)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Flows Section (shown when project is selected but no flow is selected) */}
      {selectedProjectId && !selectedFlowId && (
        <div className="p-4 border-b border-gray-800 flex-1">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-sm font-medium text-gray-300">Flows</span>
            </div>
            <div className="flex items-center space-x-2">
              {onCreateFlow && (
                <button
                  onClick={onCreateFlow}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center"
                  title="Create New Flow"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              )}
              {loading.flows && (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
              )}
            </div>
          </div>
          <div className="space-y-1 max-h-[calc(100vh-200px)] overflow-y-auto">
            {flows.map(flow => (
              <button
                key={flow.id}
                onClick={() => handleFlowSelect(flow.id)}
                className={`w-full text-left px-3 py-2 rounded text-sm flex items-center justify-between ${
                  selectedFlowId === flow.id 
                    ? 'bg-blue-900/30 text-blue-300' 
                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <span className="truncate">{flow.name}</span>
                  {flow.agent === 'deepseek' && (
                    <svg className="w-3 h-3 ml-2 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <span className="text-xs text-gray-500 ml-2">
                  {formatTimeAgo(flow.created_at)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Flow Details Section (shown when flow is selected) */}
      {selectedFlowId && (
        <div className="flex-1 overflow-y-auto">
          {/* Flow Info Header */}
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-sm font-medium text-gray-300 truncate">
                  {flows.find(f => f.id === selectedFlowId)?.name || 'Flow'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {/* Runs icon */}
                <div className="flex items-center text-xs text-gray-500">
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>{filteredFlowRuns.length}</span>
                </div>
                {/* Step icon */}
                <div className="flex items-center text-xs text-gray-500">
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span>0</span>
                </div>
                {/* Task icon */}
                <div className="flex items-center text-xs text-gray-500">
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span>{filteredTasks.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tasks Section */}
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span className="text-sm font-medium text-gray-300">Tasks</span>
              </div>
              {loading.tasks && (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
              )}
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {filteredTasks.map(task => (
                <button
                  key={task.id}
                  onClick={() => handleTaskSelect(task.id)}
                  className={`w-full text-left px-3 py-2 rounded text-sm flex items-center justify-between ${
                    selectedTaskId === task.id 
                      ? 'bg-blue-900/30 text-blue-300' 
                      : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-300'
                  }`}
                >
                  <span className="truncate">{task.title || 'Untitled Task'}</span>
                  <span className="text-xs text-gray-500 ml-2">
                    {formatTimeAgo(task.created_at)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Flow Runs Section */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="text-sm font-medium text-gray-300">Flow Runs</span>
              </div>
              {loading.flowRuns && (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
              )}
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {filteredFlowRuns.map(run => (
                <button
                  key={run.id}
                  onClick={() => handleFlowRunSelect(run.id)}
                  className={`w-full text-left px-3 py-2 rounded text-sm flex items-center justify-between ${
                    selectedFlowRunId === run.id 
                      ? 'bg-blue-900/30 text-blue-300' 
                      : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-300'
                  }`}
                >
                  <div className="flex items-center">
                    <span className="truncate">{run.id.substring(0, 8)}...</span>
                    <div className={`ml-2 w-2 h-2 rounded-full ${
                      run.status === 'active' ? 'bg-green-500' :
                      run.status === 'completed' ? 'bg-blue-500' :
                      'bg-gray-500'
                    }`} />
                  </div>
                  <span className="text-xs text-gray-500 ml-2">
                    {formatTimeAgo(run.created_at)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}