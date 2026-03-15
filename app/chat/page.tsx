'use client';

export const runtime = 'edge';
import { useState, useEffect } from 'react';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  stepId?: string;
  stepName?: string;
}

export default function ChatPage() {
  const [flows, setFlows] = useState<any[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<string>('');
  const [steps, setSteps] = useState<any[]>([]);
  const [selectedStep, setSelectedStep] = useState<string>('');
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [outputResponse, setOutputResponse] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [showOutput, setShowOutput] = useState<boolean>(false);
  const [flowRuns, setFlowRuns] = useState<any[]>([]);

  // Fetch flows on component mount
  useEffect(() => {
    fetchFlows();
    fetchFlowRuns();
    
    // Auto-refresh flow runs every 30 seconds
    const interval = setInterval(() => {
      fetchFlowRuns();
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

  const handleSend = async () => {
    if (!inputPrompt.trim()) return;
    
    const prompt = inputPrompt.trim();
    const step = steps.find(s => s.id === selectedStep);
    
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
      // Prepare request data
      const requestData: any = {
        input_prompt: prompt
      };
      
      // Add step instructions if a step is selected
      if (selectedStep && step) {
        requestData.step_id = step.id;
        requestData.step_instructions = step.prompt;
      }
      
      // Start flow run
      const response = await fetch('/api/proxy/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flow_id: selectedFlow || undefined,
          ...requestData
        }),
      });
      
      if (!response.ok) throw new Error('Failed to start flow');
      
      const result = await response.json();
      
      // Add assistant message to chat
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: result.output_response || 'Flow executed successfully',
        timestamp: new Date(),
        stepId: selectedStep,
        stepName: step?.step_id
      };
      
      setChatMessages(prev => [...prev, assistantMessage]);
      setOutputResponse(result.output_response || '');
      setShowOutput(true);
      
    } catch (error) {
      console.error('Error executing flow:', error);
      
      // Add error message to chat
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
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

  const handleRemoveOutput = () => {
    setShowOutput(false);
    setOutputResponse('');
  };

  const handleUseOutput = () => {
    if (outputResponse) {
      setInputPrompt(prev => prev + '\n\nPrevious output:\n' + outputResponse);
      setShowOutput(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Chat Mode</h1>
            <p className="text-gray-600 mt-2">Start any flow and select steps manually</p>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">
              {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
            </span>
            <button
              onClick={fetchFlows}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left sidebar - Steps */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Flows & Steps</h2>
              
              {/* Flow Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Flow
                </label>
                <select
                  value={selectedFlow}
                  onChange={(e) => setSelectedFlow(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-- Select a flow --</option>
                  {flows.map(flow => (
                    <option key={flow.id} value={flow.id}>
                      {flow.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Steps List */}
              {selectedFlow && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Steps</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {steps.length > 0 ? (
                      steps.map(step => (
                        <div
                          key={step.id}
                          className={`p-3 rounded-lg cursor-pointer transition-colors ${
                            selectedStep === step.id
                              ? 'bg-blue-50 border border-blue-200'
                              : 'bg-gray-50 hover:bg-gray-100'
                          }`}
                          onClick={() => setSelectedStep(step.id)}
                        >
                          <div className="flex items-center">
                            <div className={`h-3 w-3 rounded-full mr-3 ${
                              selectedStep === step.id ? 'bg-blue-500' : 'bg-gray-300'
                            }`} />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">
                                {step.step_id}
                              </div>
                              {step.prompt && (
                                <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                                  {step.prompt}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        No steps found for this flow
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Recent Flow Runs */}
              <div className="mt-8">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Recent Runs</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {flowRuns.slice(0, 5).map(run => (
                    <div key={run.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs font-medium text-gray-900 truncate">
                        {run.flow_id}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 truncate">
                        {run.input_prompt || 'No input'}
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          run.status === 'completed' ? 'bg-green-100 text-green-800' :
                          run.status === 'failed' ? 'bg-red-100 text-red-800' :
                          run.status === 'running' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {run.status}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(run.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))}
                  {flowRuns.length === 0 && (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      No recent runs
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Main chat area */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow flex flex-col h-[calc(100vh-12rem)]">
              {/* Chat header */}
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Chat</h2>
                    {selectedFlow && (
                      <p className="text-sm text-gray-500 mt-1">
                        Flow: {flows.find(f => f.id === selectedFlow)?.name}
                        {selectedStep && ` • Step: ${steps.find(s => s.id === selectedStep)?.step_id}`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {selectedStep && (
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                        Step Selected
                      </span>
                    )}
                    {isRunning && (
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full flex items-center">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-yellow-600 mr-2"></div>
                        Running...
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Chat messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
                      <svg className="h-full w-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Start a conversation</h3>
                    <p className="text-gray-500 max-w-md mx-auto">
                      Select a flow and step, then type your prompt below. The selected step instructions will be included with your prompt.
                    </p>
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
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        {message.stepName && (
                          <div className={`text-xs font-medium mb-1 ${
                            message.type === 'user' ? 'text-blue-200' : 'text-gray-500'
                          }`}>
                            Step: {message.stepName}
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

              {/* Output display (when available) */}
              {showOutput && outputResponse && (
                <div className="mx-6 mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-sm font-medium text-green-800">Output Response</h3>
                    <div className="flex space-x-2">
                      <button
                        onClick={handleUseOutput}
                        className="text-xs px-3 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded-md"
                      >
                        Use in Prompt
                      </button>
                      <button
                        onClick={handleRemoveOutput}
                        className="text-xs px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded-md"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">
                    {outputResponse}
                  </div>
                </div>
              )}

              {/* Chat input */}
              <div className="px-6 py-4 border-t border-gray-200">
                <div className="flex space-x-4">
                  <textarea
                    value={inputPrompt}
                    onChange={(e) => setInputPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Type your prompt here..."
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={3}
                  />
                  <button
                    onClick={handleSend}
                    disabled={isRunning || !inputPrompt.trim()}
                    className="self-end px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isRunning ? 'Sending...' : 'Send'}
                  </button>
                </div>
                <div className="mt-2 text-sm text-gray-500">
                  Press Enter to send, Shift+Enter for new line
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
