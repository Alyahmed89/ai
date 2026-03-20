'use client';

import { useState, useEffect, useRef } from 'react';
import HierarchicalNav from '@/components/HierarchicalNav';
import SimpleFlowCreator from '@/components/SimpleFlowCreator';
import EditFlowModal from '@/components/EditFlowModal';
import CreateProjectModal from '@/components/CreateProjectModal';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'api_call' | 'api_response' | 'step';
  content: string;
  timestamp: Date;
}

interface ParsedMessage {
  id: string;
  type: 'user' | 'status' | 'command' | 'response' | 'system' | 'step';
  content: string;
  timestamp: Date;
  metadata?: {
    statusType?: 'sending_step' | 'running' | 'completed' | 'error';
    stepName?: string;
    progress?: string;
    commandName?: string;
    commandParams?: any;
    isThinking?: boolean;
  };
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

interface FlowDefinition {
  id: string;
  name: string;
  description: string | null;
  max_iterations: number;
  repository: string;
  branch: string;
  created_at: string;
  updated_at: string;
  next_flow_id: string | null;
  priority: number;
  agent: string;
}

// Parse raw chat messages into structured messages
const parseChatMessage = (message: ChatMessage): ParsedMessage => {
  const { id, type, content, timestamp } = message;
  
  // User messages are straightforward
  if (type === 'user') {
    return {
      id,
      type: 'user',
      content,
      timestamp
    };
  }
  
  // Status messages (api_response type with **Status:** prefix)
  if (type === 'api_response' || (type === 'assistant' && content.includes('**Status:**'))) {
    const statusMatch = content.match(/\*\*Status:\*\*\s*(\w+)/i);
    const stepMatch = content.match(/\*\*Step:\*\*\s*(.+)/i);
    const progressMatch = content.match(/\*\*Progress:\*\*\s*(\d+\/\d+)/i);
    
    let statusType: 'sending_step' | 'running' | 'completed' | 'error' = 'running';
    if (statusMatch) {
      const status = statusMatch[1].toLowerCase();
      if (status.includes('sending') || status.includes('pending')) statusType = 'sending_step';
      else if (status.includes('complete') || status.includes('done')) statusType = 'completed';
      else if (status.includes('error') || status.includes('fail')) statusType = 'error';
      else statusType = 'running';
    }
    
    return {
      id,
      type: 'status',
      content,
      timestamp,
      metadata: {
        statusType,
        stepName: stepMatch ? stepMatch[1] : undefined,
        progress: progressMatch ? progressMatch[1] : undefined
      }
    };
  }
  
  // Command calls (contain [COMMAND:...])
  if (content.includes('[COMMAND:')) {
    const commandMatch = content.match(/\[COMMAND:([^\]]+)\]\s*params:\s*(\{[^]*\})/);
    if (commandMatch) {
      const commandName = commandMatch[1];
      let commandParams = {};
      try {
        commandParams = JSON.parse(commandMatch[2]);
      } catch (e) {
        // If JSON parsing fails, use raw text
        commandParams = { raw: commandMatch[2] };
      }
      
      return {
        id,
        type: 'command',
        content,
        timestamp,
        metadata: {
          commandName,
          commandParams
        }
      };
    }
    
    // Simple command format without params
    const simpleCommandMatch = content.match(/\[COMMAND:([^\]]+)\]/);
    if (simpleCommandMatch) {
      return {
        id,
        type: 'command',
        content,
        timestamp,
        metadata: {
          commandName: simpleCommandMatch[1],
          commandParams: {}
        }
      };
    }
  }
  
  // AI responses with thinking/analysis
  if (type === 'assistant' && content.includes('**Response:**')) {
    const responseContent = content.replace('**Response:**', '').trim();
    const isThinking = responseContent.toLowerCase().includes('i\'ll try') || 
                      responseContent.toLowerCase().includes('let me') ||
                      responseContent.toLowerCase().includes('thinking') ||
                      responseContent.toLowerCase().includes('analyzing');
    
    return {
      id,
      type: 'response',
      content: responseContent,
      timestamp,
      metadata: {
        isThinking
      }
    };
  }
  
  // Step messages
  if (type === 'step') {
    return {
      id,
      type: 'step',
      content,
      timestamp
    };
  }
  
  // System messages (flow run info, etc.)
  if (type === 'assistant' && content.includes('Flow Run:')) {
    return {
      id,
      type: 'system',
      content,
      timestamp
    };
  }
  
  // Default: treat as response
  return {
    id,
    type: 'response',
    content,
    timestamp
  };
};

export default function ChatPage() {
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [flowRuns, setFlowRuns] = useState<FlowRun[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [flowDefinitions, setFlowDefinitions] = useState<FlowDefinition[]>([]);
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

  // Fetch flow definitions, flow runs and tasks on component mount
  useEffect(() => {
    fetchFlowDefinitions();
    fetchFlowRuns();
    fetchTasks();
    
    // Auto-refresh flow definitions, flow runs and tasks every 30 seconds
    const interval = setInterval(() => {
      fetchFlowDefinitions();
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

  // Handle flow run selection - fetch conversation messages
  useEffect(() => {
    const fetchFlowRunConversation = async () => {
      if (!selectedFlowRunId) {
        // Clear chat messages when no flow run is selected
        setChatMessages([]);
        return;
      }

      try {
        // Fetch flow run details to get conversation_id
        const flowRunResponse = await fetch(`/api/proxy/api/flow-runs/${selectedFlowRunId}`);
        if (!flowRunResponse.ok) {
          console.error('Failed to fetch flow run details');
          return;
        }

        const flowRunData = await flowRunResponse.json();
        const flowRun = flowRunData.flow_run;
        const conversationId = flowRun.conversation_id;

        if (!conversationId) {
          // Show flow run info in chat
          const messages: ChatMessage[] = [];
          
          // Add flow run info as a system message
          messages.push({
            id: `flow-run-info-${flowRun.id}`,
            type: 'assistant',
            content: `Flow Run: ${flowRun.flow_id}\nStatus: ${flowRun.status}\nStarted: ${new Date(flowRun.started_at * 1000).toLocaleString()}`,
            timestamp: new Date(flowRun.started_at * 1000)
          });

          // Add input prompt if available
          if (flowRun.input_prompt) {
            messages.push({
              id: `input-${flowRun.id}`,
              type: 'user',
              content: flowRun.input_prompt,
              timestamp: new Date(flowRun.started_at * 1000)
            });
          }

          // Add output response if available
          if (flowRun.output_response) {
            messages.push({
              id: `output-${flowRun.id}`,
              type: 'assistant',
              content: flowRun.output_response,
              timestamp: new Date(flowRun.completed_at ? flowRun.completed_at * 1000 : flowRun.started_at * 1000)
            });
          }

          setChatMessages(messages);
          return;
        }

        // Fetch conversation details
        const conversationResponse = await fetch(`/api/proxy/status/${conversationId}`);
        if (!conversationResponse.ok) {
          console.error('Failed to fetch conversation details');
          return;
        }

        const conversationData = await conversationResponse.json();
        
        if (conversationData.success && conversationData.data?.conversation) {
          const conversation = conversationData.data.conversation;
          const flowSteps = conversation.flow_steps || [];
          const lastStepResponse = conversation.last_step_response || '';
          
          // Build chat messages from conversation
          const messages: ChatMessage[] = [];
          
          // Add flow run info as a system message
          messages.push({
            id: `flow-run-info-${flowRun.id}`,
            type: 'assistant',
            content: `Flow Run: ${flowRun.flow_id}\nStatus: ${flowRun.status}\nStarted: ${new Date(flowRun.started_at * 1000).toLocaleString()}`,
            timestamp: new Date(flowRun.started_at * 1000)
          });

          // Add input prompt if available
          if (flowRun.input_prompt) {
            messages.push({
              id: `input-${flowRun.id}`,
              type: 'user',
              content: flowRun.input_prompt,
              timestamp: new Date(flowRun.started_at * 1000)
            });
          }

          // Add flow steps as assistant messages
          flowSteps.forEach((step: any, index: number) => {
            if (step.instructions) {
              messages.push({
                id: `step-${step.id}-${index}`,
                type: 'assistant',
                content: `Step ${index + 1}: ${step.title || 'Untitled'}\n\n${step.instructions}`,
                timestamp: new Date(flowRun.started_at * 1000 + index * 1000) // Stagger timestamps
              });
            }
          });

          // Add last step response if available
          if (lastStepResponse) {
            messages.push({
              id: `response-${flowRun.id}`,
              type: 'assistant',
              content: lastStepResponse,
              timestamp: new Date(flowRun.completed_at ? flowRun.completed_at * 1000 : flowRun.started_at * 1000)
            });
          }

          setChatMessages(messages);
        } else {
          // Fallback to showing just flow run info
          const messages: ChatMessage[] = [];
          messages.push({
            id: `flow-run-info-${flowRun.id}`,
            type: 'assistant',
            content: `Flow Run: ${flowRun.flow_id}\nStatus: ${flowRun.status}\nStarted: ${new Date(flowRun.started_at * 1000).toLocaleString()}`,
            timestamp: new Date(flowRun.started_at * 1000)
          });

          if (flowRun.input_prompt) {
            messages.push({
              id: `input-${flowRun.id}`,
              type: 'user',
              content: flowRun.input_prompt,
              timestamp: new Date(flowRun.started_at * 1000)
            });
          }

          setChatMessages(messages);
        }
      } catch (error) {
        console.error('Error fetching flow run conversation:', error);
      }
    };

    fetchFlowRunConversation();
  }, [selectedFlowRunId]);

  const fetchFlowDefinitions = async () => {
    try {
      const response = await fetch('/api/proxy/api/flow-definitions');
      if (!response.ok) throw new Error('Failed to fetch flow definitions');
      const data = await response.json();
      setFlowDefinitions(data);
    } catch (error) {
      console.error('Error fetching flow definitions:', error);
    }
  };

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
        content: 'Please select a flow first.',
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
      
      // Debug log
      console.log('Flow start result:', flowResult);
      console.log('Flow data:', flowResult.data);
      
      // Check if flow actually started successfully
      if (!flowResult.success) {
        throw new Error(flowResult.error || 'Failed to start flow execution');
      }
      
      const conversationId = flowResult.data?.conversation_id;
      
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
        content: 'Please select a flow first.',
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
      
      // Check if flow actually started successfully
      if (!flowResult.success) {
        throw new Error(flowResult.error || 'Failed to start flow execution');
      }
      
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
    
    // Track completed steps and responses to avoid duplicates
    const completedStepIndices = new Set<string>();
    
    const pollIntervalId = setInterval(async () => {
      pollCount++;
      
      console.log(`Polling attempt ${pollCount}/${maxPolls} for conversation: ${conversationId}`);
      
      try {
        const statusResponse = await fetch(`/api/proxy/status/${conversationId}`);
        
        if (!statusResponse.ok) {
          console.error(`Status check failed: ${statusResponse.status}`);
          return;
        }
        
        const statusData = await statusResponse.json();
        
        if (statusData.success && statusData.data?.conversation) {
          const conversation = statusData.data.conversation;
          
          // Debug: log conversation state
          console.log('Polling conversation:', conversationId);
          console.log('Conversation state:', conversation.state);
          console.log('Flow completed:', conversation.flow_completed);
          console.log('Poll count:', pollCount);
          console.log('Max polls:', maxPolls);
          console.log('Full conversation data:', conversation);
          
          // Get flow steps information
          const flowSteps = conversation.flow_steps || [];
          const currentStepIndex = conversation.current_step_index || 0;
          const lastStepResponse = conversation.last_step_response || '';
          
          // Debug: log step data
          console.log('Flow steps:', flowSteps);
          if (flowSteps.length > 0 && currentStepIndex < flowSteps.length) {
            console.log('Step at index', currentStepIndex, ':', flowSteps[currentStepIndex]);
          }
          
          // Add status message showing current progress
          const statusKey = `status_${conversationId}_${pollCount}`;
          
          let statusContent = '';
          if (conversation.state === 'not_initialized') {
            // Conversation was never properly initialized - flow likely failed
            statusContent = `❌ Flow failed to initialize. The conversation was not properly started.`;
            clearInterval(pollIntervalId);
            
            // Restore original step instructions if provided
            if (restoreInstructions) {
              console.log('Flow not initialized, restoring original instructions...');
              restoreInstructions().catch(error => {
                console.error('Failed to restore instructions:', error);
              });
            }
          } else if (conversation.flow_completed || conversation.state === 'DONE' || conversation.state === 'COMPLETED') {
            // Flow is completed - show completion message
            statusContent = `✅ Flow completed successfully.`;
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
            statusContent = `⏳ Flow processing... (${pollCount * 2}s)\n**Current Step:** ${stepTitle}\n**Progress:** ${progress}\n**State:** ${conversation.state || 'RUNNING'}`;
          }
          
          // Create status message
          const statusMessage: ChatMessage = {
            id: statusKey,
            type: 'api_response',
            content: statusContent,
            timestamp: new Date(),
          };
          
          // Add status message to chat, replacing previous status if it exists
          setChatMessages(prev => {
            // Remove previous status messages for this conversation
            const filteredMessages = prev.filter(msg => 
              !msg.id.startsWith(`status_${conversationId}_`)
            );
            // Add new status message
            return [...filteredMessages, statusMessage];
          });
          
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

              // Create a STEP RESPONSE message
              const stepResponseMessage: ChatMessage = {
                id: `${assistantMessageId}_step_response_${Date.now()}`,
                type: 'assistant',
                content: `**Response:**\n${lastStepResponse}`,
                timestamp: new Date(),
              };

              // Add step response message to chat
              setChatMessages(prev => {
                return [...prev, stepResponseMessage];
              });
            }
          }
          
          // Stop polling if flow is completed or failed to initialize
          if (conversation.state === 'not_initialized' || conversation.flow_completed || conversation.state === 'DONE' || conversation.state === 'COMPLETED') {
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

  // Helper function to render a parsed message
  const renderParsedMessage = (parsedMessage: ParsedMessage) => {
    const { id, type, content, timestamp, metadata } = parsedMessage;
    
    const getMessageStyles = () => {
      switch (type) {
        case 'user':
          return 'bg-blue-600 text-white justify-end';
        case 'status':
          const statusColor = metadata?.statusType === 'completed' ? 'bg-green-600' :
                            metadata?.statusType === 'error' ? 'bg-red-600' :
                            metadata?.statusType === 'sending_step' ? 'bg-yellow-600' :
                            'bg-green-700';
          return `${statusColor} text-white justify-start`;
        case 'command':
          return 'bg-purple-700 text-white justify-start';
        case 'response':
          const thinkingColor = metadata?.isThinking ? 'bg-gray-800' : 'bg-gray-900';
          return `${thinkingColor} text-gray-100 justify-start`;
        case 'step':
          return 'bg-indigo-600 text-white justify-end';
        case 'system':
          return 'bg-gray-800 text-gray-300 justify-start';
        default:
          return 'bg-gray-900 text-gray-100 justify-start';
      }
    };

    const getTimestampColor = () => {
      switch (type) {
        case 'user': return 'text-blue-200';
        case 'status': return 'text-green-200';
        case 'command': return 'text-purple-200';
        case 'response': return metadata?.isThinking ? 'text-gray-400' : 'text-gray-500';
        case 'step': return 'text-indigo-200';
        case 'system': return 'text-gray-500';
        default: return 'text-gray-500';
      }
    };

    const renderContent = () => {
      switch (type) {
        case 'status':
          return (
            <div className="space-y-1">
              <div className="font-semibold">Status: {metadata?.statusType?.toUpperCase().replace('_', ' ')}</div>
              {metadata?.stepName && <div className="text-sm opacity-90">Step: {metadata.stepName}</div>}
              {metadata?.progress && <div className="text-sm opacity-80">Progress: {metadata.progress}</div>}
            </div>
          );
        
        case 'command':
          return (
            <div className="space-y-2">
              <div className="font-semibold">Command: {metadata?.commandName}</div>
              {metadata?.commandParams && Object.keys(metadata.commandParams).length > 0 && (
                <div className="bg-black/30 rounded p-2 text-sm font-mono overflow-x-auto">
                  <div className="text-gray-400 mb-1">Parameters:</div>
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(metadata.commandParams, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          );
        
        case 'response':
          return (
            <div className="space-y-2">
              {metadata?.isThinking && (
                <div className="flex items-center text-sm text-gray-400 mb-1">
                  <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Thinking...
                </div>
              )}
              <div className="whitespace-pre-wrap">{content}</div>
            </div>
          );
        
        default:
          return <div className="whitespace-pre-wrap">{content}</div>;
      }
    };

    const alignmentClass = type === 'user' || type === 'step' ? 'justify-end' : 'justify-start';
    const styles = getMessageStyles();

    return (
      <div key={id} className={`flex ${alignmentClass}`}>
        <div className={`max-w-3xl rounded-lg px-4 py-3 ${styles}`}>
          {renderContent()}
          <div className={`text-xs mt-2 ${getTimestampColor()}`}>
            {formatTime(timestamp)}
          </div>
        </div>
      </div>
    );
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
        {/* Left sidebar */}
        <div className="w-64 bg-gray-900 border-r border-gray-800 overflow-y-auto">
          <HierarchicalNav
            onSelectProject={(projectId) => setSelectedProjectId(projectId)}
            onSelectFlow={(flowId) => setSelectedFlowId(flowId)}
            onSelectTask={(taskId) => setSelectedTaskId(taskId)}
            onSelectFlowRun={(flowRunId) => setSelectedFlowRunId(flowRunId)}
            onCreateFlow={() => setShowCreateFlowModal(true)}
            onEditFlow={(flowId) => {
              setEditingFlowId(flowId);
              setShowEditFlowModal(true);
            }}
            onCreateProject={() => setShowCreateProjectModal(true)}
          />
        </div>
        
        {/* Main content area */}
        <div className="flex-1 flex flex-col">

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
                            : 'Select a flow first.'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    chatMessages
                      .map(parseChatMessage)
                      .filter((parsedMessage: ParsedMessage) => {
                        // Show all parsed messages except empty ones
                        return parsedMessage.content.trim().length > 0;
                      })
                      .map(renderParsedMessage)
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