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

export default function ChatPage() {
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [flowRuns, setFlowRuns] = useState<FlowRun[]>([]);
  const [showCreateFlowModal, setShowCreateFlowModal] = useState<boolean>(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Fetch flow runs on component mount
  useEffect(() => {
    fetchFlowRuns();
    
    // Auto-refresh flow runs every 30 seconds
    const interval = setInterval(() => {
      fetchFlowRuns();
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
        {/* Left sidebar - Flow Runs */}
        <div className="w-80 border-r border-gray-900 bg-black overflow-y-auto">
          <div className="p-6">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">Flow Runs</h3>
            <div className="space-y-3">
              {flowRuns.slice(0, 20).map(run => (
                <div 
                  key={run.id} 
                  className="p-3 rounded-lg bg-gray-900/50 hover:bg-gray-900 border border-gray-800 hover:border-gray-700 cursor-pointer transition-all"
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
                  </div>
                </div>
              ))}
              {flowRuns.length === 0 && (
                <div className="text-center py-4 text-gray-500 text-sm">
                  No flow runs yet
                </div>
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
                      className="self-end px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
    </div>
  );
}