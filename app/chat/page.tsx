'use client';

import { useState, useEffect, useRef } from 'react';
import SimpleFlowCreator from '@/components/SimpleFlowCreator';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'api_call' | 'api_response';
  content: string;
  timestamp: Date;
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
  action: string | null;
  dependencies: string | null;
  file: string | null;
  line: number | null;
  estimated_complexity: string | null;
  validation_checklist: string | null;
  numeric_priority: number | null;
  endpoint_path: string | null;
  http_method: string | null;
  sample_payload: string | null;
  expected_response: string | null;
  auth_required: string | null;
  ai_context: string | null;
  last_runtime_validation_at: string | null;
  last_runtime_validation_status: string | null;
  runtime_validation_count: number | null;
  expectation_override: string | null;
  expectation_source: string | null;
  flow: string | null;
  obligation_evidence: string | null;
  obligation_reason: string | null;
  order_index: number | null;
}

export default function ChatPage() {
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [flowRuns, setFlowRuns] = useState<FlowRun[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showCreateFlowModal, setShowCreateFlowModal] = useState<boolean>(false);
  const [showEditFlowModal, setShowEditFlowModal] = useState<boolean>(false);
  const [sidebarView, setSidebarView] = useState<'flowRuns' | 'tasks'>('flowRuns');
  const [selectedFlowRun, setSelectedFlowRun] = useState<FlowRun | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Fetch flow runs and tasks on component mount
  useEffect(() => {
    fetchFlowRuns();
    fetchTasks();
    
    // Auto-refresh flow runs and tasks every 30 seconds
    const interval = setInterval(() => {
      fetchFlowRuns();
      fetchTasks();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const fetchFlowRuns = async () => {
    try {
      const response = await fetch('/api/proxy/api/flow-runs');
      if (!response.ok) throw new Error('Failed to fetch flow runs');
      const data = await response.json();
      // Sort flow runs from latest to oldest
      const sortedRuns = data.sort((a: FlowRun, b: FlowRun) => 
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
      );
      setFlowRuns(sortedRuns);
    } catch (error) {
      console.error('Error fetching flow runs:', error);
    }
  };

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/proxy/api/tasks');
      if (!response.ok) throw new Error('Failed to fetch tasks');
      const data = await response.json();
      // Sort tasks from latest to oldest
      const sortedTasks = data.sort((a: Task, b: Task) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setTasks(sortedTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const handleSend = async () => {
    if (!inputPrompt.trim()) return;
    
    const prompt = inputPrompt.trim();
    
    // Add user message to chat
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: prompt,
      timestamp: new Date(),
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    setInputPrompt('');
    setIsRunning(true);
    
    try {
      // First, create a task for the "rules_are_rules" flow
      const taskTitle = prompt.length > 50 ? prompt.substring(0, 47) + '...' : prompt;
      
      // Add API call message for task creation
      const taskCreationMessage: ChatMessage = {
        id: (Date.now() + 0.5).toString(),
        type: 'api_call',
        content: `Creating task for flow: rules_are_rules`,
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, taskCreationMessage]);
      
      // Create task
      const taskResponse = await fetch('/api/proxy/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: `Chat: ${taskTitle}`,
          description: prompt,
          flow_id: 'rules_are_rules',
          status: 'pending'
        }),
      });
      
      if (!taskResponse.ok) throw new Error('Failed to create task');
      
      const taskResult = await taskResponse.json();
      const createdTaskId = taskResult.id;
      
      // Add task creation success message
      const taskSuccessMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'api_response',
        content: `Task created successfully: ${createdTaskId}`,
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, taskSuccessMessage]);
      
      // Now start the flow
      const flowStartMessage: ChatMessage = {
        id: (Date.now() + 1.5).toString(),
        type: 'api_call',
        content: `Starting flow: rules_are_rules`,
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, flowStartMessage]);
      
      // Start the flow
      const flowResponse = await fetch('/api/proxy/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flow_id: 'rules_are_rules',
          input_prompt: prompt
        }),
      });
      
      if (!flowResponse.ok) throw new Error('Failed to start flow');
      
      const flowResult = await flowResponse.json();
      
      // Add flow response message
      const flowResponseMessage: ChatMessage = {
        id: (Date.now() + 2).toString(),
        type: 'api_response',
        content: JSON.stringify(flowResult, null, 2),
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, flowResponseMessage]);
      
      // Add assistant message with parsed response
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 3).toString(),
        type: 'assistant',
        content: flowResult.output_response || flowResult.message || 'Flow executed successfully',
        timestamp: new Date(),
      };
      
      setChatMessages(prev => [...prev, assistantMessage]);
      
      // Update task status to completed
      await fetch(`/api/proxy/api/tasks/${createdTaskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'completed'
        }),
      });
      
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
    <div className="min-h-screen bg-black text-gray-100 font-sans">
      {/* Full screen layout */}
      <div className="flex h-screen">
        {/* Left sidebar */}
        <div className="w-80 border-r border-gray-900 bg-black overflow-y-auto">
          <div className="p-6">
            {/* Sidebar header with icons */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setSidebarView('flowRuns')}
                  className={`p-2 rounded-lg transition-colors ${sidebarView === 'flowRuns' ? 'text-green-400 bg-green-500/10' : 'text-gray-400 hover:text-white hover:bg-gray-900'}`}
                  title="Flow Runs"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </button>
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
            </div>

            {/* Content based on sidebar view */}
            <div className="space-y-3">
              {sidebarView === 'flowRuns' && (
                <>
                  {flowRuns.slice(0, 20).map(run => (
                    <div 
                      key={run.id} 
                      className="p-3 rounded-lg bg-gray-900/50 hover:bg-gray-900 border border-gray-800 hover:border-gray-700 cursor-pointer transition-all"
                      onClick={() => setSelectedFlowRun(run)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div 
                            className="text-sm font-medium text-gray-200 truncate hover:text-blue-400"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowEditFlowModal(true);
                            }}
                          >
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
                      </div>
                    </div>
                  ))}
                  {flowRuns.length === 0 && (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      No flow runs yet
                    </div>
                  )}
                </>
              )}

              {sidebarView === 'tasks' && (
                <>
                  {tasks.slice(0, 20).map(task => (
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
          {/* Chat header with minimal controls */}
          <div className="border-b border-gray-900 bg-black p-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-sm rounded-full">
                  rules_are_rules
                </span>
              </div>
              <div className="flex items-center space-x-3">
                {isRunning && (
                  <div className="flex items-center text-sm text-blue-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400 mr-2"></div>
                    <span>Running...</span>
                  </div>
                )}
                <button
                  onClick={() => setShowCreateFlowModal(true)}
                  className="px-3 py-1.5 text-sm bg-green-900 text-green-300 hover:bg-green-800 rounded-lg transition-colors border border-green-800"
                >
                  Create Flow
                </button>
              </div>
            </div>
          </div>

          {/* Chat area */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full flex">
              {/* Chat area */}
              <div className="flex-1 flex flex-col">
                {/* Chat messages */}
                <div 
                  ref={chatContainerRef}
                  className="flex-1 overflow-y-auto p-6 space-y-4"
                >
                  {chatMessages.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-gray-400 text-sm max-w-md">
                          Type a prompt below to begin. Your message will create a task for the "rules_are_rules" flow and start execution.
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
                      placeholder="Type your prompt here... (Will create task for 'rules_are_rules' flow)"
                      className="flex-1 px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-100 placeholder-gray-500"
                      rows={3}
                    />
                    <button
                      onClick={handleSend}
                      disabled={isRunning || !inputPrompt.trim()}
                      className="self-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isRunning ? '...' : 'Send'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showCreateFlowModal && (
        <SimpleFlowCreator
          onClose={() => setShowCreateFlowModal(false)}
          onFlowCreated={(flowId) => {
            setShowCreateFlowModal(false);
            // Add success message to chat
            const message: ChatMessage = {
              id: Date.now().toString(),
              type: 'assistant',
              content: `Flow created successfully! Flow ID: ${flowId}`,
              timestamp: new Date()
            };
            setChatMessages(prev => [...prev, message]);
          }}
        />
      )}

      {/* Edit Flow Modal */}
      {showEditFlowModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-800">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-100">Edit Flow: rules_are_rules</h3>
                <button
                  onClick={() => setShowEditFlowModal(false)}
                  className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Flow Name</label>
                  <input
                    type="text"
                    defaultValue="rules_are_rules"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Description</label>
                  <textarea
                    defaultValue="Flow for processing chat prompts and creating tasks"
                    rows={3}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-100 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Flow Steps</label>
                  <div className="space-y-4">
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-gray-300">Step 1: Task Creation</h4>
                        <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded">task_creation</span>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Flow ID</label>
                          <input
                            type="text"
                            defaultValue="rules_are_rules"
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Task Title Template</label>
                          <input
                            type="text"
                            defaultValue="Chat: {prompt}"
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Task Description</label>
                          <textarea
                            defaultValue="User prompt from chat"
                            rows={2}
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent resize-none"
                          />
                        </div>
                      </div>
                    </div>
                    
                    <button
                      type="button"
                      className="w-full py-2 border border-dashed border-gray-700 rounded-lg text-gray-400 hover:text-gray-300 hover:border-gray-600 transition-colors text-sm"
                    >
                      + Add Another Step
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-800 flex justify-end space-x-3">
              <button
                onClick={() => setShowEditFlowModal(false)}
                className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowEditFlowModal(false);
                  // Add success message to chat
                  const message: ChatMessage = {
                    id: Date.now().toString(),
                    type: 'assistant',
                    content: 'Flow updated successfully!',
                    timestamp: new Date()
                  };
                  setChatMessages(prev => [...prev, message]);
                }}
                className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flow Run Details Modal */}
      {selectedFlowRun && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-800">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-gray-100">Flow Run: {selectedFlowRun.flow_id}</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Started {formatRelativeTime(selectedFlowRun.started_at)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedFlowRun(null)}
                  className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Flow Run Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Flow ID</h4>
                    <p className="text-gray-200">{selectedFlowRun.flow_id}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Status</h4>
                    <div className="flex items-center">
                      {renderStatusIndicator(selectedFlowRun.status)}
                      <span className="ml-2 text-gray-200 capitalize">{selectedFlowRun.status}</span>
                    </div>
                  </div>
                </div>

                {/* Input Prompt */}
                {selectedFlowRun.input_prompt && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Input Prompt</h4>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                      <p className="text-gray-200 whitespace-pre-wrap">{selectedFlowRun.input_prompt}</p>
                    </div>
                  </div>
                )}

                {/* Output Response */}
                {selectedFlowRun.output_response && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Output Response</h4>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                      <pre className="text-sm text-gray-300 whitespace-pre-wrap">{selectedFlowRun.output_response}</pre>
                    </div>
                  </div>
                )}

                {/* Chat Messages for this flow run */}
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Chat Messages</h4>
                  <div className="space-y-3">
                    {chatMessages
                      .filter(msg => msg.content.includes(selectedFlowRun.flow_id) || msg.content.includes(selectedFlowRun.id))
                      .map(message => (
                        <div
                          key={message.id}
                          className={`p-3 rounded-lg ${
                            message.type === 'user'
                              ? 'bg-blue-600/20 border border-blue-600/30'
                              : message.type === 'assistant'
                              ? 'bg-gray-800 border border-gray-700'
                              : message.type === 'api_call'
                              ? 'bg-yellow-500/20 border border-yellow-500/30'
                              : 'bg-green-500/10 border border-green-500/20'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="text-sm text-gray-200 whitespace-pre-wrap">{message.content}</div>
                            </div>
                            <div className="text-xs text-gray-500 ml-2">
                              {formatTime(message.timestamp)}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-800 flex justify-end">
              <button
                onClick={() => setSelectedFlowRun(null)}
                className="px-4 py-2 bg-gray-800 text-gray-300 font-medium rounded-lg hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}