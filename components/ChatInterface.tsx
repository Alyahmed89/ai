'use client';

import { useState, useRef, useEffect } from 'react';
import ActivityDisplay from './ActivityDisplay';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'api_call' | 'api_response';
  content: string;
  timestamp: Date;
}

interface Activity {
  id: string;
  type: 'input' | 'output' | 'command' | 'endpoint';
  status: 'pending' | 'running' | 'success' | 'failed';
  title: string;
  description?: string;
  endpoint?: {
    name: string;
    method: string;
    url: string;
  };
  data?: Record<string, any>;
  timestamp: number;
  duration?: number;
}

interface ChatInterfaceProps {
  selectedFlowId?: string | null;
  selectedTaskId?: string | null;
  selectedFlowRunId?: string | null;
}

export default function ChatInterface({ 
  selectedFlowId, 
  selectedTaskId, 
  selectedFlowRunId 
}: ChatInterfaceProps) {
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPrompt.trim() || isRunning) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputPrompt,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setInputPrompt('');
    setIsRunning(true);

    // Add activity for the input
    const inputActivity: Activity = {
      id: `input-${Date.now()}`,
      type: 'input',
      status: 'running',
      title: 'Processing prompt',
      description: inputPrompt,
      timestamp: Date.now()
    };
    setActivities(prev => [...prev, inputActivity]);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Add endpoint activity
      const endpointActivity: Activity = {
        id: `endpoint-${Date.now()}`,
        type: 'endpoint',
        status: 'success',
        title: 'API Call',
        endpoint: {
          name: 'deepseek-agent',
          method: 'POST',
          url: 'https://deepseek-agent.alghamdimo89.workers.dev/api/run'
        },
        data: {
          prompt: inputPrompt,
          flow_id: selectedFlowId || 'default',
          timestamp: new Date().toISOString()
        },
        timestamp: Date.now(),
        duration: 850
      };
      setActivities(prev => [...prev, endpointActivity]);

      // Add output activity
      const outputActivity: Activity = {
        id: `output-${Date.now()}`,
        type: 'output',
        status: 'success',
        title: 'Response generated',
        description: 'AI response has been processed and tasks created',
        timestamp: Date.now(),
        duration: 1200
      };
      setActivities(prev => [...prev, outputActivity]);

      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `I've processed your request "${inputPrompt}". I've created tasks and started the workflow. You can check the tasks section for details.`,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, assistantMessage]);

      // Update input activity status
      setActivities(prev => prev.map(activity => 
        activity.id === inputActivity.id 
          ? { ...activity, status: 'success', duration: 2500 }
          : activity
      ));

    } catch (error) {
      console.error('Error:', error);
      
      // Update activities with failure
      setActivities(prev => prev.map(activity => 
        activity.id === inputActivity.id 
          ? { ...activity, status: 'failed', description: 'Failed to process request' }
          : activity
      ));

      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, there was an error processing your request. Please try again.',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsRunning(false);
    }
  };

  const formatTimeAgo = (date: Date) => {
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const clearChat = () => {
    setChatMessages([]);
    setActivities([]);
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <h2 className="text-lg font-semibold text-gray-200">Chat</h2>
          </div>
          <div className="flex items-center space-x-2">
            {selectedFlowId && (
              <span className="px-2 py-1 text-xs bg-gray-900/30 text-gray-300 rounded">
                Flow: {selectedFlowId.substring(0, 8)}...
              </span>
            )}
            <button
              onClick={clearChat}
              className="px-3 py-1 text-sm text-gray-400 hover:text-gray-300 hover:bg-gray-800/50 rounded"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Chat Messages */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {chatMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <p className="text-lg">Start a conversation</p>
              <p className="text-sm mt-2">Type a prompt below to begin</p>
            </div>
          ) : (
            chatMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.type === 'user'
                      ? 'bg-gray-600 text-white'
                      : message.type === 'assistant'
                      ? 'bg-gray-800 text-gray-200'
                      : message.type === 'api_call'
                      ? 'bg-purple-600 text-white'
                      : 'bg-green-600 text-white'
                  }`}
                >
                  <div className="flex items-center mb-1">
                    <span className="text-xs font-medium opacity-80">
                      {message.type === 'user' ? 'You' :
                       message.type === 'assistant' ? 'Assistant' :
                       message.type === 'api_call' ? 'API Call' : 'API Response'}
                    </span>
                    <span className="text-xs opacity-60 ml-2">
                      {formatTimeAgo(message.timestamp)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Activities Section */}
        {activities.length > 0 && (
          <div className="border-t border-gray-800 p-4">
            <div className="flex items-center mb-3">
              <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-sm font-medium text-gray-300">Activities</span>
              <span className="ml-2 text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
                {activities.length}
              </span>
            </div>
            <ActivityDisplay 
              activities={activities}
              onActivityClick={(activity) => console.log('Activity clicked:', activity)}
            />
          </div>
        )}

        {/* Input Form */}
        <div className="border-t border-gray-800 p-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your prompt here... (Shift+Enter for new line)"
                className="w-full bg-gray-800 text-gray-200 rounded-lg px-4 py-3 pr-12 resize-none min-h-[60px] max-h-[200px] focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                rows={1}
                disabled={isRunning}
              />
              <button
                type="submit"
                disabled={!inputPrompt.trim() || isRunning}
                className="absolute right-3 bottom-3 p-2 rounded-lg bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-500 mr-1"></div>
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
  );
}