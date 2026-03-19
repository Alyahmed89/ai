'use client';

import { useState, useEffect, useRef } from 'react';
import SimpleFlowCreator from '@/components/SimpleFlowCreator';
import EditFlowModal from '@/components/EditFlowModal';
import CreateProjectModal from '@/components/CreateProjectModal';
import HierarchicalNav from '@/components/HierarchicalNav';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'api_call' | 'api_response' | 'step';
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
    
    // Check if a flow is selected
    if (!selectedFlowId) {
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'assistant',
        content: 'Please select a flow first. Click on a project, then select a flow from the sidebar.',
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
      return;
    }
    
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
    
    // Store the assistant message ID so we can update it later
    const assistantMessageId = (Date.now() + 2.5).toString();
    
    // Variables that need to be accessible in catch block
    let originalInstructions: Record<string, string> = {};
    let restoreOriginalInstructions: (() => Promise<void>) | null = null;
    
    try {
      // First, fetch all flow steps and filter by flow_id
      const stepsResponse = await fetch('/api/proxy/api/flow-steps');
      if (!stepsResponse.ok) throw new Error('Failed to fetch flow steps');
      const stepsData = await stepsResponse.json();
      const steps = stepsData.data.filter((step: any) => step.flow_id === selectedFlowId);
      console.log('Fetched steps for flow', selectedFlowId, ':', steps);
      
      // Save original instructions and update with resolved placeholders
      originalInstructions = {};
      const updatePromises = [];
      
      for (const step of steps) {
        console.log('Checking step:', step.id, 'instructions:', step.instructions);
        if (step.instructions && (step.instructions.includes('{input_prompt}') || step.instructions.includes('{user.message}'))) {
          // Save original instructions
          originalInstructions[step.id] = step.instructions;
          
          // Resolve placeholders
          let resolvedInstructions = step.instructions;
          if (prompt) {
            // Replace {input_prompt} placeholder
            if (resolvedInstructions.includes('{input_prompt}')) {
              resolvedInstructions = resolvedInstructions.replace(/\{input_prompt\}/g, prompt);
              console.log('Replaced {input_prompt} with:', prompt);
            }
            // Replace {user.message} placeholder
            if (resolvedInstructions.includes('{user.message}')) {
              resolvedInstructions = resolvedInstructions.replace(/\{user\.message\}/g, prompt);
              console.log('Replaced {user.message} with:', prompt);
            }
          }
          
          console.log('Original instructions:', step.instructions);
          console.log('Resolved instructions:', resolvedInstructions);
          
          // Update step with resolved instructions
          // Convert numeric fields to booleans for API compatibility
          const stepData = {
            ...step,
            instructions: resolvedInstructions,
            blocking: step.blocking === 1,
            auto_fail_on_error: step.auto_fail_on_error === 1,
            retryable: step.retryable === 1,
            output: step.output === 1,
            requires_task: step.requires_task === 1,
            extra_step: step.extra_step === 1
          };
          
          const updatePromise = fetch(`/api/proxy/api/flow-steps/${step.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(stepData),
          }).then(async (response) => {
            if (!response.ok) {
              const errorText = await response.text();
              console.error('Failed to update step:', step.id, 'Status:', response.status, 'Error:', errorText);
              throw new Error(`Failed to update step ${step.id}: ${response.status}`);
            }
            console.log('Successfully updated step:', step.id);
            return response.json();
          }).catch(error => {
            console.error('Error updating step:', step.id, error);
            throw error;
          });
          updatePromises.push(updatePromise);
        }
      }
      
      // Wait for all step updates to complete
      if (updatePromises.length > 0) {
        console.log('Waiting for', updatePromises.length, 'step updates to complete...');
        await Promise.all(updatePromises);
        console.log('All step updates completed');
        // Add a small delay to ensure updates are propagated
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        console.log('No steps with placeholders found');
      }
      
      // Function to restore original instructions
      restoreOriginalInstructions = async () => {
        if (Object.keys(originalInstructions).length === 0) return;
        
        console.log('Restoring original instructions for steps:', Object.keys(originalInstructions));
        const restorePromises = [];
        
        for (const [stepId, originalInstruction] of Object.entries(originalInstructions)) {
          const step = steps.find((s: any) => s.id === stepId);
          if (!step) continue;
          
          const stepData = {
            ...step,
            instructions: originalInstruction,
            blocking: step.blocking === 1,
            auto_fail_on_error: step.auto_fail_on_error === 1,
            retryable: step.retryable === 1,
            output: step.output === 1,
            requires_task: step.requires_task === 1,
            extra_step: step.extra_step === 1
          };
          
          const restorePromise = fetch(`/api/proxy/api/flow-steps/${stepId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stepData)
          }).then(async (response) => {
            if (!response.ok) {
              const errorText = await response.text();
              console.error('Failed to restore step:', stepId, 'Status:', response.status, 'Error:', errorText);
            } else {
              console.log('Successfully restored step:', stepId);
            }
            return response.json();
          }).catch(error => {
            console.error('Error restoring step:', stepId, error);
          });
          
          restorePromises.push(restorePromise);
        }
        
        if (restorePromises.length > 0) {
          await Promise.all(restorePromises);
          console.log('All original instructions restored');
        }
      };
      
      // Create task with proper title and description
      const taskResponse = await fetch('/api/proxy/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: prompt.length > 50 ? prompt.substring(0, 47) + '...' : prompt,
          description: prompt,
          flow_id: selectedFlowId,
          status: 'pending'
        }),
      });
      
      if (!taskResponse.ok) throw new Error('Failed to create task');
      
      const taskResult = await taskResponse.json();
      const createdTaskId = taskResult.id;
      
      // Start the flow
      const flowResponse = await fetch('/api/proxy/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flow_id: selectedFlowId,
          input_prompt: prompt
        }),
      });
      
      if (!flowResponse.ok) throw new Error('Failed to start flow');
      
      const flowResult = await flowResponse.json();
      const conversationId = flowResult.data?.conversation_id;
      
      // Debug log
      console.log('Flow start result:', flowResult);
      console.log('Flow data:', flowResult.data);
      
      // Add status message (api_response type) for flow start
      const statusMessage: ChatMessage = {
        id: `${assistantMessageId}_status`,
        type: 'api_response',
        content: `STATUS: Flow execution started successfully!`,
        timestamp: new Date(),
      };
      
      console.log('Adding status message:', statusMessage);
      console.log('assistantMessageId:', assistantMessageId);
      console.log('Status message ID:', statusMessage.id);
      setChatMessages(prev => {
        console.log('Previous messages count:', prev.length);
        console.log('Previous messages:', prev.map(m => ({id: m.id, type: m.type, content: m.content.substring(0, 50)})));
        const newMessages = [...prev, statusMessage];
        console.log('New messages count:', newMessages.length);
        console.log('New messages:', newMessages.map(m => ({id: m.id, type: m.type, content: m.content.substring(0, 50)})));
        return newMessages;
      });
      
      // Don't add initial assistant message - we'll only show step instructions and responses
      // The assistantMessageId is still used for polling but won't create a visible message
      
      // Note: Task status should remain "pending" for the flow to process it
      // The flow will update the task status when it completes
      
      // Refresh flow runs to show new run
      fetchFlowRuns();
      
      // Start polling for actual results if we have a conversation ID
      if (conversationId) {
        startPollingForResults(conversationId, assistantMessageId, prompt, restoreOriginalInstructions);
      }
      
    } catch (error) {
      console.error('Error executing request:', error);
      
      // Restore original instructions if update failed
      if (Object.keys(originalInstructions).length > 0 && restoreOriginalInstructions) {
        console.log('Error occurred, attempting to restore original instructions...');
        try {
          await restoreOriginalInstructions();
        } catch (restoreError) {
          console.error('Failed to restore instructions after error:', restoreError);
        }
      }
      
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

  const handlePlay = async () => {
    // Check if a flow is selected
    if (!selectedFlowId) {
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'assistant',
        content: 'Please select a flow first. Click on a project, then select a flow from the sidebar.',
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
      return;
    }
    
    setIsRunning(true);
    
    // Store the assistant message ID so we can update it later
    const assistantMessageId = (Date.now() + 2.5).toString();
    
    try {
      // Create task with default title and description
      const taskResponse = await fetch('/api/proxy/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: `Run ${selectedFlowId} flow`,
          description: `Starting ${selectedFlowId} flow without prompt`,
          flow_id: selectedFlowId,
          status: 'pending'
        }),
      });
      
      if (!taskResponse.ok) throw new Error('Failed to create task');
      
      const taskResult = await taskResponse.json();
      const createdTaskId = taskResult.id;
      
      // Start the flow with empty prompt
      const flowResponse = await fetch('/api/proxy/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flow_id: selectedFlowId,
          input_prompt: ''
        }),
      });
      
      if (!flowResponse.ok) throw new Error('Failed to start flow');
      
      const flowResult = await flowResponse.json();
      const conversationId = flowResult.data?.conversation_id;
      
      // Add status message (api_response type) for flow start
      const statusMessage: ChatMessage = {
        id: assistantMessageId,
        type: 'api_response',
        content: `STATUS: Flow execution started successfully!`,
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, statusMessage]);
      
      // Note: Task status should remain "pending" for the flow to process it
      // The flow will update the task status when it completes
      
      // Refresh flow runs to show new run
      fetchFlowRuns();
      
      // Start polling for actual results if we have a conversation ID
      if (conversationId) {
        startPollingForResults(conversationId, assistantMessageId, "");
      }
      
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

  const startPollingForResults = (conversationId: string, assistantMessageId: string, userMessage: string = '', restoreInstructions?: () => Promise<void>) => {
    let pollCount = 0;
    const maxPolls = 30; // 30 polls * 2 seconds = 60 seconds total
    const pollInterval = 2000; // Poll every 2 seconds
    
    // Track completed steps to avoid duplicates
    const completedStepIndices = new Set<number>();
    
    const pollIntervalId = setInterval(async () => {
      pollCount++;
      
      try {
        const statusResponse = await fetch(`/api/proxy/status/${conversationId}`);
        
        if (!statusResponse.ok) {
          console.error(`Status check failed: ${statusResponse.status}`);
          return;
        }
        
        const statusData = await statusResponse.json();
        
        if (statusData.success && statusData.data?.conversation) {
          const conversation = statusData.data.conversation;
          
          // Get flow steps information
          const flowSteps = conversation.flow_steps || [];
          const currentStepIndex = conversation.current_step_index || 0;
          const lastStepResponse = conversation.last_step_response || '';
          
          // Debug: log step data
          console.log('Flow steps:', flowSteps);
          if (flowSteps.length > 0 && currentStepIndex < flowSteps.length) {
            console.log('Step at index', currentStepIndex, ':', flowSteps[currentStepIndex]);
          }
          
          // Update the initial assistant message with overall progress
          setChatMessages(prev => prev.map(msg => {
            if (msg.id === assistantMessageId) {
              let content = '';
              
              if (conversation.flow_completed || conversation.state === 'DONE' || conversation.state === 'COMPLETED') {
                // Flow is completed - show completion message
                content = `✅ Flow completed successfully.`;
                clearInterval(pollIntervalId);
                
                // Restore original step instructions if provided
                if (restoreInstructions) {
                  console.log('Flow completed, restoring original instructions...');
                  restoreInstructions().catch(error => {
                    console.error('Failed to restore instructions:', error);
                  });
                }
              } else {
                // Flow is still running - show detailed progress
                const completedSteps = Math.max(0, currentStepIndex);
                const totalSteps = flowSteps.length;
                const progress = totalSteps > 0 ? `${completedSteps}/${totalSteps} steps` : 'processing';
                const currentStep = flowSteps[currentStepIndex];
                const stepTitle = currentStep?.title || `Step ${currentStepIndex + 1}`;
                content = `⏳ Flow processing... (${pollCount * 2}s)\n**Current Step:** ${stepTitle}\n**Progress:** ${progress}\n**State:** ${conversation.state || 'RUNNING'}`;
              }
              
              return {
                ...msg,
                content: content
              };
            }
            return msg;
          }));
          
          // Check if we have a new step response to display
          if (lastStepResponse && lastStepResponse.trim()) {
            // Track responses by their content hash to avoid duplicates
            const responseHash = btoa(lastStepResponse).substring(0, 32);
            const responseKey = `response_${responseHash}`;
            
            if (!completedStepIndices.has(responseKey)) {
              // Mark this response as displayed
              completedStepIndices.add(responseKey);

              // Get current step details (the step that generated this response)
              const currentStep = flowSteps[currentStepIndex] || flowSteps[Math.max(0, currentStepIndex - 1)];
              const stepTitle = currentStep?.title || `Step ${currentStepIndex + 1}`;
              const stepInstructions = currentStep?.description || currentStep?.instructions || '';

              // Replace placeholders with actual user message
              let stepInstructionsWithUserMessage = stepInstructions || 'Processing step...';
              if (userMessage) {
                // Replace {user.message} placeholder
                if (stepInstructionsWithUserMessage.includes('{user.message}')) {
                  stepInstructionsWithUserMessage = stepInstructionsWithUserMessage.replace(/\{user\.message\}/g, userMessage);
                }
                // Replace {input_prompt} placeholder
                if (stepInstructionsWithUserMessage.includes('{input_prompt}')) {
                  stepInstructionsWithUserMessage = stepInstructionsWithUserMessage.replace(/\{input_prompt\}/g, userMessage);
                }
              }

              // Create a STATUS message showing the current state
              const statusMessage: ChatMessage = {
                id: `${assistantMessageId}_status_${Date.now()}`,
                type: 'api_response',
                content: `**Status:** ${conversation.state || 'RUNNING'}\n**Step:** ${stepTitle}\n**Progress:** ${currentStepIndex + 1}/${flowSteps.length}`,
                timestamp: new Date(),
              };

              // Create a STEP RESPONSE message
              const stepResponseMessage: ChatMessage = {
                id: `${assistantMessageId}_step_response_${Date.now()}`,
                type: 'assistant',
                content: `**Response:**\n${lastStepResponse}`,
                timestamp: new Date(),
              };

              // Add both messages to chat
              setChatMessages(prev => {
                let newMessages = [...prev];

                // Add status message
                newMessages.push(statusMessage);

                // Add step response message
                newMessages.push(stepResponseMessage);

                return newMessages;
              });
            }
          }
          
          // Stop polling if flow is completed
          if (conversation.flow_completed || conversation.state === 'DONE' || conversation.state === 'COMPLETED') {
            clearInterval(pollIntervalId);
            // Don't add final completion message - we only show step instructions and responses
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
        clearInterval(pollIntervalId);
        
        // Restore original step instructions if provided
        if (restoreInstructions) {
          console.log('Polling error, restoring original instructions...');
          restoreInstructions().catch(err => {
            console.error('Failed to restore instructions:', err);
          });
        }
      }
      
      // Stop polling after max attempts
      if (pollCount >= maxPolls) {
        clearInterval(pollIntervalId);
        // Don't show timeout message - we only show step instructions and responses
        
        // Restore original step instructions if provided
        if (restoreInstructions) {
          console.log('Polling timeout, restoring original instructions...');
          restoreInstructions().catch(error => {
            console.error('Failed to restore instructions:', error);
          });
        }
      }
    }, pollInterval);
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
            onEditFlow={handleEditFlow}
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
                          {selectedFlowId 
                            ? `Type a prompt below to begin. Your message will create a task for the "${selectedFlowId}" flow and start execution.`
                            : 'Select a flow first. Click on a project in the sidebar, then select a flow to send messages to it.'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    chatMessages
                      .filter((message: ChatMessage) => {
                        // Show user messages
                        if (message.type === 'user') return true;
                        // Show step messages
                        if (message.type === 'step') return true;
                        // Show assistant messages that are step responses (contain "**Response:**")
                        if (message.type === 'assistant' && message.content.includes('**Response:**')) return true;
                        // Show api_response messages (status messages)
                        if (message.type === 'api_response') return true;
                        // Don't show other assistant messages (like flow status messages)
                        return false;
                      })
                      .map((message: ChatMessage) => (
                        <div
                          key={message.id}
                          className={`flex ${
                            message.type === 'user' || message.type === 'step' 
                              ? 'justify-end' 
                              : 'justify-start'
                          }`}
                        >
                          <div
                            className={`max-w-3xl rounded-lg px-4 py-3 ${
                              message.type === 'user'
                                ? 'bg-blue-600 text-white'
                                : message.type === 'step'
                                ? 'bg-purple-600 text-white'
                                : message.type === 'api_response'
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-900 text-gray-100'
                            }`}
                          >
                            <div className="whitespace-pre-wrap">{message.content}</div>
                            <div className={`text-xs mt-2 ${
                              message.type === 'user' 
                                ? 'text-blue-200' 
                                : message.type === 'step'
                                ? 'text-purple-200'
                                : message.type === 'api_response'
                                ? 'text-green-200'
                                : 'text-gray-500'
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
                        placeholder={selectedFlowId ? "tell me what you are thinking .." : "Select a flow first to send messages"}
                        className="w-full bg-gray-800 text-gray-200 rounded-lg px-4 py-3 pr-24 resize-none min-h-[60px] max-h-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={1}
                        disabled={isRunning}
                      />
                      <div className="absolute right-3 bottom-3 flex space-x-2">
                        <button
                          type="button"
                          onClick={handlePlay}
                          disabled={isRunning || !selectedFlowId}
                          className="p-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title={!selectedFlowId ? "Select a flow first" : "Start flow without prompt"}
                        >
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        <button
                          type="submit"
                          disabled={!inputPrompt.trim() || isRunning || !selectedFlowId}
                          className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title={!selectedFlowId ? "Select a flow first" : "Send message"}
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
                      <div className="flex items-center space-x-4">
                        <button
                          onClick={handlePlay}
                          disabled={isRunning || !selectedFlowId}
                          className="text-green-400 hover:text-green-300 disabled:opacity-50 disabled:cursor-not-allowed text-xs flex items-center"
                          title="Start flow without prompt"
                        >
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          </svg>
                          Start flow
                        </button>
                        <span>{inputPrompt.length}/2000</span>
                      </div>
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
                      .filter((msg: ChatMessage) => msg.content.includes(selectedFlowRun.flow_id) || msg.content.includes(selectedFlowRun.id))
                      .map((message: ChatMessage) => (
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