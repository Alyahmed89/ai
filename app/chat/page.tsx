'use client';

import { useState, useEffect, useRef } from 'react';
import SimpleFlowCreator from '@/components/SimpleFlowCreator';
import EditFlowModal from '@/components/EditFlowModal';
import CreateProjectModal from '@/components/CreateProjectModal';
import HierarchicalNav from '@/components/HierarchicalNav';

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
  const [showCreateProjectModal, setShowCreateProjectModal] = useState<boolean>(false);
  const [selectedFlowRun, setSelectedFlowRun] = useState<FlowRun | null>(null);
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedFlowRunId, setSelectedFlowRunId] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputPrompt]);

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
      
      // Execute the first step of the flow directly
      const stepExecutionMessage: ChatMessage = {
        id: (Date.now() + 1.5).toString(),
        type: 'api_call',
        content: `Executing step: Process chat prompt - FINAL TEST`,
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, stepExecutionMessage]);
      
      // Execute the step directly
      const stepResponse = await fetch('/api/proxy/api/execute-step', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          step_id: 'step-1773683777886-al61qkgbb',
          flow_id: 'rules_are_rules',
          user_prompt: prompt
        }),
      });
      
      if (!stepResponse.ok) throw new Error('Failed to execute step');
      
      const stepResult = await stepResponse.json();
      
      // Add step execution details to chat
      if (stepResult.success && stepResult.data) {
        // Show the prompt that was sent to the step
        const stepPromptMessage: ChatMessage = {
          id: (Date.now() + 2).toString(),
          type: 'api_response',
          content: `Step Prompt Sent:\n${stepResult.data.prompt_sent}`,
          timestamp: new Date(),
        };
        setChatMessages(prev => [...prev, stepPromptMessage]);
        
        // Show the step response
        const stepResponseMessage: ChatMessage = {
          id: (Date.now() + 2.5).toString(),
          type: 'assistant',
          content: `Step Response:\n${stepResult.data.deepseek_response}`,
          timestamp: new Date(),
        };
        setChatMessages(prev => [...prev, stepResponseMessage]);
        
        // Show OpenHands response if available
        if (stepResult.data.openhands_response) {
          const openhandsMessage: ChatMessage = {
            id: (Date.now() + 3).toString(),
            type: 'api_response',
            content: `OpenHands Response: ${JSON.stringify(stepResult.data.openhands_response, null, 2)}`,
            timestamp: new Date(),
          };
          setChatMessages(prev => [...prev, openhandsMessage]);
        }
      } else {
        // Fallback to original flow execution if step execution fails
        const flowStartMessage: ChatMessage = {
          id: (Date.now() + 2).toString(),
          type: 'api_call',
          content: `Starting flow: rules_are_rules`,
          timestamp: new Date(),
        };
        setChatMessages(prev => [...prev, flowStartMessage]);
        
        // Start the flow as fallback
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
          id: (Date.now() + 2.5).toString(),
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
      }
      
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

  const handleEditFlow = (flowId: string) => {
    setEditingFlowId(flowId);
    setShowEditFlowModal(true);
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

    if (diffDay > 0) return `${diffDay}d ago`;
    if (diffHour > 0) return `${diffHour}h ago`;
    if (diffMin > 0) return `${diffMin}m ago`;
    return `${diffSec}s ago`;
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
    } else if (statusLower === 'running' || statusLower === 'active') {
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
        {/* Left sidebar - Hierarchical Navigation */}
        <div className="w-64 flex-shrink-0">
          <HierarchicalNav
            onSelectProject={setSelectedProjectId}
            onSelectFlow={setSelectedFlowId}
            onSelectTask={setSelectedTaskId}
            onSelectFlowRun={setSelectedFlowRunId}
            onSelectStep={() => {}} // TODO: Implement step selection
            onCreateProject={() => setShowCreateProjectModal(true)}
            onCreateFlow={() => setShowCreateFlowModal(true)}
            onCreateStep={() => {}} // TODO: Implement create step
          />
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col">
          {/* Chat header */}
          <div className="bg-gray-900 p-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <h2 className="text-lg font-semibold text-gray-200">Chat</h2>
                {selectedFlowId && (
                  <span className="ml-3 px-2 py-1 text-xs bg-blue-900/30 text-blue-300 rounded">
                    Flow: {selectedFlowId.substring(0, 8)}...
                  </span>
                )}
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
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  New Flow
                </button>
                {selectedFlowId && (
                  <button
                    onClick={() => handleEditFlow(selectedFlowId)}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium rounded-lg transition-colors flex items-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Flow
                  </button>
                )}
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
                <div className="p-4">
                  <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="space-y-3">
                    <div className="relative">
                      <textarea
                        ref={textareaRef}
                        value={inputPrompt}
                        onChange={(e) => setInputPrompt(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="tell me what you are thinking .."
                        className="w-full bg-gray-800 text-gray-200 rounded-lg px-4 py-3 pr-12 resize-none min-h-[60px] max-h-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={1}
                        disabled={isRunning}
                      />
                      <button
                        type="submit"
                        disabled={!inputPrompt.trim() || isRunning}
                        className="absolute right-3 bottom-3 p-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Send message"
                      >
                        {isRunning ? (
                          <svg className="w-5 h-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center space-x-4">
                        <span>Press Enter to send</span>
                        {isRunning && (
                          <span className="flex items-center">
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500 mr-1"></div>
                            Processing...
                          </span>
                        )}
                      </div>
                      <span>{inputPrompt.length}/2000</span>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Project Modal */}
      {showCreateProjectModal && (
        <CreateProjectModal
          onClose={() => setShowCreateProjectModal(false)}
          onProjectCreated={(projectId) => {
            setShowCreateProjectModal(false);
            // Add success message to chat
            const message: ChatMessage = {
              id: Date.now().toString(),
              type: 'assistant',
              content: `Project created successfully! Project ID: ${projectId}`,
              timestamp: new Date()
            };
            setChatMessages(prev => [...prev, message]);
          }}
        />
      )}

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
      {showEditFlowModal && editingFlowId && (
        <EditFlowModal
          flowId={editingFlowId}
          onClose={() => {
            setShowEditFlowModal(false);
            setEditingFlowId(null);
          }}
          onFlowUpdated={(updatedFlowId) => {
            // Add success message to chat
            const message: ChatMessage = {
              id: Date.now().toString(),
              type: 'assistant',
              content: `Flow "${updatedFlowId}" updated successfully!`,
              timestamp: new Date()
            };
            setChatMessages(prev => [...prev, message]);
            
            // Refresh flow runs to show any updates
            fetchFlowRuns();
          }}
        />
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