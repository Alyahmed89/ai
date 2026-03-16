'use client';

// export const runtime = 'edge';
import { useState, useEffect, useRef } from 'react';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'api_call' | 'api_response';
  content: string;
  timestamp: Date;
  stepId?: string;
  stepName?: string;
  endpoint?: string;
}

interface FlowRun {
  id: string;
  flow_id: string;
  input_prompt?: string;
  status: string;
  started_at: string;
  output_response?: string;
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
  updated_at: string;
}

export default function ChatPage() {
  const [flows, setFlows] = useState<any[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<string>('');
  const [steps, setSteps] = useState<any[]>([]);
  const [selectedStep, setSelectedStep] = useState<string>('');
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [flowRuns, setFlowRuns] = useState<FlowRun[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showFlows, setShowFlows] = useState<boolean>(true);
  const [editingStep, setEditingStep] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editStepId, setEditStepId] = useState<string>('');
  const [editStepPrompt, setEditStepPrompt] = useState<string>('');
  const [sidebarView, setSidebarView] = useState<'flows' | 'flowRuns' | 'steps' | 'tasks'>('flows');
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Fetch flows, flow runs, and tasks on component mount
  useEffect(() => {
    fetchFlows();
    fetchFlowRuns();
    fetchTasks();
    
    // Auto-refresh flow runs every 30 seconds
    const interval = setInterval(() => {
      fetchFlowRuns();
      fetchTasks();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Fetch steps when flow is selected
  useEffect(() => {
    if (selectedFlow) {
      fetchSteps(selectedFlow);
    } else {
      setSteps([]);
      setSelectedStep('');
    }
  }, [selectedFlow]);

  // Update sidebar view based on selections (simplified)
  useEffect(() => {
    // Don't change view if we're in tasks view
    if (sidebarView === 'tasks') return;
    
    // Only auto-switch to flows view if no flow is selected
    if (!selectedFlow && sidebarView !== 'flows') {
      setSidebarView('flows');
    }
  }, [selectedFlow, sidebarView]);

  // Debug: log sidebarView changes
  useEffect(() => {
    // sidebarView changed
  }, [sidebarView]);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const fetchFlows = async () => {
    try {
      const response = await fetch('/api/proxy/api/flow-definitions');
      if (!response.ok) throw new Error('Failed to fetch flows');
      const data = await response.json();
      setFlows(data);
    } catch (error) {
      console.error('Error fetching flows:', error);
    }
  };

  const fetchSteps = async (flowId: string) => {
    try {
      const response = await fetch(`/api/proxy/api/flow-steps?flow_id=${flowId}`);
      if (!response.ok) throw new Error('Failed to fetch steps');
      const data = await response.json();
      const stepsData = data.success ? data.data : data;
      setSteps(stepsData);
    } catch (error) {
      console.error('Error fetching steps:', error);
    }
  };

  const fetchFlowRuns = async () => {
    try {
      const response = await fetch('/api/proxy/api/flow-runs');
      if (!response.ok) throw new Error('Failed to fetch flow runs');
      const data = await response.json();
      setFlowRuns(data);
    } catch (error) {
      console.error('Error fetching flow runs:', error);
    }
  };

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/proxy/api/tasks');
      if (!response.ok) throw new Error('Failed to fetch tasks');
      const data = await response.json();
      // Parse the API response - assuming it returns an array of tasks
      setTasks(data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const handleSend = async () => {
    if (!inputPrompt.trim()) return;
    
    const prompt = inputPrompt.trim();
    const step = steps.find(s => s.id === selectedStep);
    
    // Hide flows view when chat starts
    if (showFlows) {
      setShowFlows(false);
    }
    
    // Add user message to chat
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: prompt,
      timestamp: new Date(),
      stepId: selectedStep,
      stepName: step?.step_id
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    setInputPrompt('');
    setIsRunning(true);
    
    try {
      // Add API call message
      const apiCallMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'api_call',
        content: selectedStep ? `Calling step: ${step?.step_id}` : 'Calling endpoint',
        timestamp: new Date(),
        stepId: selectedStep,
        stepName: step?.step_id,
        endpoint: selectedStep ? '/api/execute-step' : '/start'
      };
      
      setChatMessages(prev => [...prev, apiCallMessage]);
      
      // Prepare request data based on your curl examples
      let endpoint = '/api/proxy/start';
      let requestBody: any = {};
      
      if (selectedStep && step) {
        // Use execute-step endpoint for step execution
        endpoint = '/api/proxy/api/execute-step';
        requestBody = {
          flow_id: selectedFlow,
          step_id: step.id,
          user_prompt: prompt
        };
      } else {
        // Use start endpoint for general prompts
        endpoint = '/api/proxy/start';
        requestBody = {
          flow_id: selectedFlow || undefined,
          input_prompt: prompt
        };
      }
      
      // Make API call
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) throw new Error(`API request failed: ${response.status}`);
      
      const result = await response.json();
      
      // Add API response message
      const apiResponseMessage: ChatMessage = {
        id: (Date.now() + 2).toString(),
        type: 'api_response',
        content: JSON.stringify(result, null, 2),
        timestamp: new Date(),
        stepId: selectedStep,
        stepName: step?.step_id,
        endpoint: endpoint
      };
      
      setChatMessages(prev => [...prev, apiResponseMessage]);
      
      // Add assistant message with parsed response
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 3).toString(),
        type: 'assistant',
        content: result.output_response || result.message || 'Request completed successfully',
        timestamp: new Date(),
        stepId: selectedStep,
        stepName: step?.step_id
      };
      
      setChatMessages(prev => [...prev, assistantMessage]);
      
      // Refresh flow runs to show new run
      fetchFlowRuns();
      
    } catch (error) {
      console.error('Error executing request:', error);
      
      // Add error message to chat
      const errorMessage: ChatMessage = {
        id: (Date.now() + 2).toString(),
        type: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        stepId: selectedStep,
        stepName: step?.step_id
      };
      
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsRunning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEditStep = (step: any) => {
    setEditingStep(step);
    setEditStepId(step.step_id || '');
    setEditStepPrompt(step.prompt || '');
    setShowEditModal(true);
  };

  const handleDeleteStep = async (stepId: string) => {
    if (!confirm('Are you sure you want to delete this step?')) return;
    
    try {
      // In a real implementation, you would call an API to delete the step
      // For now, we'll just remove it from the local state
      setSteps(prev => prev.filter(step => step.id !== stepId));
      
      if (selectedStep === stepId) {
        setSelectedStep('');
      }
      
      // Show success message
      const message: ChatMessage = {
        id: Date.now().toString(),
        type: 'assistant',
        content: `Step deleted successfully`,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, message]);
    } catch (error) {
      console.error('Error deleting step:', error);
      const message: ChatMessage = {
        id: Date.now().toString(),
        type: 'assistant',
        content: `Error deleting step: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, message]);
    }
  };

  const handleSaveStep = async () => {
    if (!editingStep || !editStepId.trim()) return;
    
    try {
      // In a real implementation, you would call an API to update the step
      // For now, we'll just update the local state
      setSteps(prev => prev.map(step => 
        step.id === editingStep.id 
          ? { ...step, step_id: editStepId, prompt: editStepPrompt }
          : step
      ));
      
      setShowEditModal(false);
      setEditingStep(null);
      
      // Show success message
      const message: ChatMessage = {
        id: Date.now().toString(),
        type: 'assistant',
        content: `Step "${editStepId}" updated successfully`,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, message]);
    } catch (error) {
      console.error('Error saving step:', error);
      const message: ChatMessage = {
        id: Date.now().toString(),
        type: 'assistant',
        content: `Error saving step: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, message]);
    }
  };

  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffMonth = Math.floor(diffDay / 30);
    const diffYear = Math.floor(diffDay / 365);
    
    if (diffYear > 0) return `${diffYear} year${diffYear > 1 ? 's' : ''}`;
    if (diffMonth > 0) return `${diffMonth} month${diffMonth > 1 ? 's' : ''}`;
    if (diffDay > 0) return `${diffDay} day${diffDay > 1 ? 's' : ''}`;
    if (diffHour > 0) return `${diffHour} hour${diffHour > 1 ? 's' : ''}`;
    if (diffMin > 0) return `${diffMin} min${diffMin > 1 ? 's' : ''}`;
    return 'just now';
  };

  const getStatusColor = (status: string): string => {
    switch (status?.toLowerCase()) {
      case 'completed': return 'bg-green-500/20 text-green-400';
      case 'failed': return 'bg-red-500/20 text-red-400';
      case 'running': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const renderStatusIndicator = (status: string): React.ReactNode => {
    const statusLower = status?.toLowerCase();
    
    if (statusLower === 'completed') {
      return (
        <div className="flex items-center space-x-1">
          <span className="text-green-400">✓</span>
          <span className="text-xs text-green-400">Completed</span>
        </div>
      );
    } else if (statusLower === 'running') {
      return (
        <div className="flex items-center space-x-1">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-400"></div>
          <span className="text-xs text-blue-400">Running</span>
        </div>
      );
    } else if (statusLower === 'failed') {
      return (
        <div className="flex items-center space-x-1">
          <span className="text-red-400">✗</span>
          <span className="text-xs text-red-400">Failed</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center space-x-1">
          <span className="text-gray-400">○</span>
          <span className="text-xs text-gray-400">{status || 'Stopped'}</span>
        </div>
      );
    }
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-screen bg-black text-gray-100 font-sans overflow-hidden">
      {/* Main layout */}
      <div className="flex h-full">
        {/* Left sidebar - Hierarchical Navigation */}
        <div className="w-80 border-r border-gray-900 bg-black overflow-y-auto custom-scrollbar">
          <div className="p-6">
            {/* Navigation header with icons */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setSelectedFlow('');
                    setSelectedStep('');
                    setSidebarView('flows');
                    setShowFlows(true);
                  }}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-900 rounded-lg transition-colors"
                  title="Home"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </button>
                <button
                  onClick={() => setSidebarView('flows')}
                  className={`p-2 rounded-lg transition-colors ${sidebarView === 'flows' ? 'text-blue-400 bg-blue-500/10' : 'text-gray-400 hover:text-white hover:bg-gray-900'}`}
                  title="Flows"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </button>
                <button
                  onClick={() => window.alert('Flow Runs button clicked!')}
                  className={`p-2 rounded-lg transition-colors ${sidebarView === 'flowRuns' ? 'text-green-400 bg-green-500/10' : 'text-gray-400 hover:text-white hover:bg-gray-900'}`}
                  title="Flow Runs"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </button>
                <button
                  onClick={() => setSidebarView('steps')}
                  className={`p-2 rounded-lg transition-colors ${sidebarView === 'steps' ? 'text-purple-400 bg-purple-500/10' : 'text-gray-400 hover:text-white hover:bg-gray-900'}`}
                  title="Steps"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </button>
              </div>
              <button
                onClick={() => setSidebarView('tasks')}
                className={`p-2 rounded-lg transition-colors ${sidebarView === 'tasks' ? 'text-yellow-400 bg-yellow-500/10' : 'text-gray-400 hover:text-white hover:bg-gray-900'}`}
                title="Tasks"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </button>
            </div>

            {/* Hierarchy indicator */}
            {selectedFlow && (
              <div className="mb-4 p-3 bg-gray-900/50 rounded-lg border border-gray-800">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500">Current:</span>
                  <span className="text-sm text-blue-400 font-medium">
                    {flows.find(f => f.id === selectedFlow)?.name || selectedFlow}
                  </span>
                </div>
              </div>
            )}

            {/* Content based on sidebar view */}
            <div className="space-y-3">
              {sidebarView === 'flows' && (
                <>
                  <h3 className="text-sm font-semibold text-gray-400 mb-3">Available Flows</h3>
                  {flows.map(flow => (
                    <div
                      key={flow.id}
                      className="p-3 rounded-lg bg-gray-900/50 hover:bg-gray-900 border border-gray-800 hover:border-gray-700 cursor-pointer transition-all"
                      onClick={() => {
                        setSelectedFlow(flow.id);
                        setShowFlows(false);
                        setSidebarView('flowRuns');
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-200">
                            {flow.name}
                          </div>
                          {flow.description && (
                            <div className="text-xs text-gray-400 mt-1 line-clamp-1">
                              {flow.description}
                            </div>
                          )}
                        </div>
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  ))}
                  {flows.length === 0 && (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      No flows available
                    </div>
                  )}
                </>
              )}

              {sidebarView === 'flowRuns' && (
                <>
                  <h3 className="text-sm font-semibold text-gray-400 mb-3">Flow Runs</h3>
                  {flowRuns.filter(run => run.flow_id === selectedFlow).slice(0, 10).map(run => (
                    <div 
                      key={run.id} 
                      className="p-3 rounded-lg bg-gray-900/50 hover:bg-gray-900 border border-gray-800 hover:border-gray-700 cursor-pointer transition-all"
                      onClick={() => {
                        setSelectedFlow(run.flow_id);
                        setShowFlows(false);
                        setSidebarView('steps');
                      }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-200 truncate">
                            {run.flow_id}
                          </div>
                          {run.input_prompt && (
                            <div className="text-xs text-gray-400 mt-1 line-clamp-2">
                              {run.input_prompt}
                            </div>
                          )}
                        </div>
                        {renderStatusIndicator(run.status)}
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-gray-500">
                          {formatRelativeTime(run.started_at)}
                        </span>
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  ))}
                  {flowRuns.filter(run => run.flow_id === selectedFlow).length === 0 && (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      No flow runs for this flow
                    </div>
                  )}
                </>
              )}

              {sidebarView === 'steps' && (
                <>
                  <h3 className="text-sm font-semibold text-gray-400 mb-3">Steps</h3>
                  {steps.map(step => (
                    <div
                      key={step.id}
                      className={`p-3 rounded-lg transition-all ${
                        selectedStep === step.id
                          ? 'bg-purple-500/20 border border-purple-500/30'
                          : 'bg-gray-900/50 hover:bg-gray-900 border border-gray-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div 
                          className="flex-1 cursor-pointer"
                          onClick={() => {
                            setSelectedStep(step.id);
                            setSidebarView('steps');
                          }}
                        >
                          <div className="flex items-center">
                            <div className={`h-2 w-2 rounded-full mr-3 ${
                              selectedStep === step.id ? 'bg-purple-400' : 'bg-gray-600'
                            }`} />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-200">
                                {step.step_id}
                              </div>
                              {step.prompt && (
                                <div className="text-xs text-gray-400 mt-1 line-clamp-1">
                                  {step.prompt}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 ml-2">
                          <button
                            onClick={() => handleEditStep(step)}
                            className="p-1 text-gray-400 hover:text-blue-400 hover:bg-gray-900 rounded transition-colors"
                            title="Edit step"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {steps.length === 0 && (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      No steps for this flow
                    </div>
                  )}
                </>
              )}

              {sidebarView === 'tasks' && (
                <>
                  <h3 className="text-sm font-semibold text-gray-400 mb-3">Tasks</h3>
                  {tasks.slice(0, 10).map(task => (
                    <div 
                      key={task.id} 
                      className="p-3 rounded-lg bg-gray-900/50 hover:bg-gray-900 border border-gray-800 hover:border-gray-700 cursor-pointer transition-all"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-200 truncate">
                            {task.title || task.description || 'Untitled Task'}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {task.task_type && (
                              <span className="mr-2">Type: {task.task_type}</span>
                            )}
                            {task.priority && (
                              <span>Priority: {task.priority}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          {task.status === 'completed' ? (
                            <span className="text-green-400">✓</span>
                          ) : task.status === 'failed' ? (
                            <span className="text-red-400">✗</span>
                          ) : task.status === 'running' ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-400"></div>
                          ) : (
                            <span className="text-gray-400">○</span>
                          )}
                          <span className="text-xs text-gray-400">{task.status}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-gray-500">
                          {formatRelativeTime(task.created_at)}
                        </span>
                        {task.flow_id && (
                          <span className="text-xs text-blue-400">
                            Flow: {task.flow_id}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {tasks.length === 0 && (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      No tasks available
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col">
          {/* Chat header */}
          <div className="border-b border-gray-900 bg-black p-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-3">
                {selectedFlow && (
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-sm rounded-full">
                    {flows.find(f => f.id === selectedFlow)?.name || selectedFlow}
                  </span>
                )}
                {selectedStep && (
                  <span className="px-3 py-1 bg-purple-500/20 text-purple-400 text-sm rounded-full">
                    {steps.find(s => s.id === selectedStep)?.step_id}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-3">
                {/* Play/Pause controls for flow runs */}
                {selectedFlow && !selectedStep && (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        // Start flow run
                        setIsRunning(true);
                        // In a real implementation, this would trigger a flow run
                        const message: ChatMessage = {
                          id: Date.now().toString(),
                          type: 'assistant',
                          content: `Starting flow run for ${flows.find(f => f.id === selectedFlow)?.name || selectedFlow}`,
                          timestamp: new Date()
                        };
                        setChatMessages(prev => [...prev, message]);
                        
                        // Simulate flow run completion after 2 seconds
                        setTimeout(() => {
                          setIsRunning(false);
                          const completionMessage: ChatMessage = {
                            id: (Date.now() + 1).toString(),
                            type: 'assistant',
                            content: `Flow run completed successfully`,
                            timestamp: new Date()
                          };
                          setChatMessages(prev => [...prev, completionMessage]);
                          fetchFlowRuns(); // Refresh flow runs
                        }, 2000);
                      }}
                      disabled={isRunning}
                      className="p-2 text-green-400 hover:text-green-300 hover:bg-gray-900 rounded-lg transition-colors border border-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Start flow run"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        // Pause flow run
                        setIsRunning(false);
                        const message: ChatMessage = {
                          id: Date.now().toString(),
                          type: 'assistant',
                          content: `Flow run paused`,
                          timestamp: new Date()
                        };
                        setChatMessages(prev => [...prev, message]);
                      }}
                      disabled={!isRunning}
                      className="p-2 text-yellow-400 hover:text-yellow-300 hover:bg-gray-900 rounded-lg transition-colors border border-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Pause flow run"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        // Stop flow run
                        setIsRunning(false);
                        const message: ChatMessage = {
                          id: Date.now().toString(),
                          type: 'assistant',
                          content: `Flow run stopped`,
                          timestamp: new Date()
                        };
                        setChatMessages(prev => [...prev, message]);
                      }}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-gray-900 rounded-lg transition-colors border border-gray-800"
                      title="Stop flow run"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                      </svg>
                    </button>
                  </div>
                )}
                
                {isRunning && (
                  <div className="flex items-center text-sm text-blue-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400 mr-2"></div>
                    <span>Running...</span>
                  </div>
                )}
                <button
                  onClick={() => {
                    setShowFlows(true);
                    setSelectedFlow('');
                    setSelectedStep('');
                    setSidebarView('flows');
                  }}
                  className="px-3 py-1.5 text-sm bg-gray-900 text-gray-300 hover:bg-gray-800 rounded-lg transition-colors border border-gray-800"
                >
                  Flows
                </button>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 overflow-hidden">
            {showFlows && chatMessages.length === 0 ? (
              // Flows view (center before chat starts)
              <div className="h-full flex items-center justify-center p-8">
                <div className="max-w-2xl w-full">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {flows.map(flow => (
                      <div
                        key={flow.id}
                        className="p-6 rounded-xl bg-gray-900/50 border border-gray-800 hover:border-gray-700 hover:bg-gray-900 cursor-pointer transition-all"
                        onClick={() => {
                          setSelectedFlow(flow.id);
                          setShowFlows(false);
                          setSidebarView('flowRuns');
                        }}
                      >
                        <h3 className="text-lg font-medium text-gray-200 mb-2">
                          {flow.name}
                        </h3>
                        <p className="text-sm text-gray-400 line-clamp-2">
                          {flow.description || 'No description available'}
                        </p>
                      </div>
                    ))}
                  </div>
                  
                  {flows.length === 0 && (
                    <div className="text-center py-12">
                      <button
                        onClick={fetchFlows}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                      >
                        Refresh
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // Chat view
              <div className="h-full flex">
                {/* Steps sidebar (only shown when a flow is selected) */}
                {selectedFlow && steps.length > 0 && (
                  <div className="w-64 border-r border-gray-900 bg-black overflow-y-auto custom-scrollbar">
                    <div className="p-4">
                      <div className="space-y-2">
                        {steps.map(step => (
                          <div
                            key={step.id}
                            className={`p-3 rounded-lg transition-all ${
                              selectedStep === step.id
                                ? 'bg-purple-500/20 border border-purple-500/30'
                                : 'bg-gray-900/50 hover:bg-gray-900 border border-gray-800'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div 
                                className="flex-1 cursor-pointer"
                                onClick={() => {
                                  setSelectedStep(step.id);
                                  setSidebarView('steps');
                                }}
                              >
                                <div className="flex items-center">
                                  <div className={`h-2 w-2 rounded-full mr-3 ${
                                    selectedStep === step.id ? 'bg-purple-400' : 'bg-gray-600'
                                  }`} />
                                  <div className="flex-1">
                                    <div className="text-sm font-medium text-gray-200">
                                      {step.step_id}
                                    </div>
                                    {step.prompt && (
                                      <div className="text-xs text-gray-400 mt-1 line-clamp-2">
                                        {step.prompt}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-1 ml-2">
                                <button
                                  onClick={() => handleEditStep(step)}
                                  className="p-1 text-gray-400 hover:text-blue-400 hover:bg-gray-900 rounded transition-colors"
                                  title="Edit step"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteStep(step.id)}
                                  className="p-1 text-gray-400 hover:text-red-400 hover:bg-gray-900 rounded transition-colors"
                                  title="Delete step"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Chat area */}
                <div className="flex-1 flex flex-col">
                  {/* Chat messages */}
                  <div 
                    ref={chatContainerRef}
                    className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar"
                  >
                    {chatMessages.length === 0 ? (
                      <div className="h-full flex items-center justify-center">
                        <div className="text-center">
                          <p className="text-gray-400 text-sm max-w-md">
                            Type a prompt below to begin
                          </p>
                        </div>
                      </div>
                    ) : (
                      chatMessages.map(message => (
                        <div
                          key={message.id}
                          className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-3xl rounded-lg px-4 py-3 ${
                              message.type === 'user'
                                ? 'bg-blue-600 text-white'
                                : message.type === 'assistant'
                                ? 'bg-gray-900 text-gray-100'
                                : message.type === 'api_call'
                                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                : 'bg-green-500/10 text-green-300 border border-green-500/20'
                            }`}
                          >
                            {message.stepName && (
                              <div className={`text-xs font-medium mb-1 ${
                                message.type === 'user' ? 'text-blue-200' : 'text-gray-400'
                              }`}>
                                Step: {message.stepName}
                              </div>
                            )}
                            {message.endpoint && (
                              <div className="text-xs font-mono mb-1 text-gray-400">
                                {message.endpoint}
                              </div>
                            )}
                            <div className="whitespace-pre-wrap">{message.content}</div>
                            <div className={`text-xs mt-2 ${
                              message.type === 'user' ? 'text-blue-200' : 'text-gray-500'
                            }`}>
                              {formatTime(message.timestamp)}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Chat input */}
                  <div className="border-t border-gray-900 p-4">
                    <div className="flex space-x-4">
                      <textarea
                        value={inputPrompt}
                        onChange={(e) => setInputPrompt(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type your prompt here..."
                        className="flex-1 px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-100 placeholder-gray-500"
                        rows={3}
                      />
                      <button
                        onClick={handleSend}
                        disabled={isRunning || !inputPrompt.trim()}
                        className="self-end px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isRunning ? '...' : 'Send'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Step Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-black border border-gray-900 rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-200 mb-4">Edit Step</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Step ID
                </label>
                <input
                  type="text"
                  value={editStepId}
                  onChange={(e) => setEditStepId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-100"
                  placeholder="Enter step ID"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Step Prompt/Instructions
                </label>
                <textarea
                  value={editStepPrompt}
                  onChange={(e) => setEditStepPrompt(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-100 resize-none"
                  rows={4}
                  placeholder="Enter step instructions"
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingStep(null);
                  }}
                  className="px-4 py-2 text-gray-300 hover:text-gray-100 hover:bg-gray-900 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveStep}
                  disabled={!editStepId.trim()}
                  className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
