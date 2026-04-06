'use client';

import { useState, useEffect, useRef } from 'react';
import HierarchicalNav from '@/components/HierarchicalNav';
import SimpleFlowCreator from '@/components/SimpleFlowCreator';
import EditFlowModal from '@/components/EditFlowModal';
import CreateProjectModal from '@/components/CreateProjectModal';
import FlowRun, { ConversationData } from '@/components/FlowRun';
import IntelligentTextarea from '@/components/ui/IntelligentTextarea';
import { FlowRun as SharedFlowRun, CommandItem } from '@/types';

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

// Use any for props to handle both Next.js PageProps and our custom props
export default function ChatPage(props: any) {
  // Extract our custom props from props
  const initialProjectId = props.initialProjectId as string | undefined;
  const initialFlowId = props.initialFlowId as string | undefined;
  const initialFlowRunId = props.initialFlowRunId as string | undefined;
  // Next.js page props (might be Promises)
  const params = props.params;
  const searchParams = props.searchParams;
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [flowRuns, setFlowRuns] = useState<SharedFlowRun[]>([]);
  const [flowDefinitions, setFlowDefinitions] = useState<FlowDefinition[]>([]);
  const [variables, setVariables] = useState<CommandItem[]>([]);
  const [showCreateFlowModal, setShowCreateFlowModal] = useState<boolean>(false);
  const [showEditFlowModal, setShowEditFlowModal] = useState<boolean>(false);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState<boolean>(false);
  const [selectedFlowRun, setSelectedFlowRun] = useState<SharedFlowRun | null>(null);
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialProjectId || null);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(initialFlowId || null);
  const [selectedFlowRunId, setSelectedFlowRunId] = useState<string | null>(initialFlowRunId || null);
  const [conversationData, setConversationData] = useState<ConversationData | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch flow definitions, flow runs, and variables on component mount
  useEffect(() => {
    fetchFlowDefinitions();
    fetchFlowRuns();
    fetchVariables();
    
    // Auto-refresh flow definitions, flow runs, and variables every 30 seconds
    const interval = setInterval(() => {
      fetchFlowDefinitions();
      fetchFlowRuns();
      fetchVariables();
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
    console.log('DEBUG: useEffect triggered with selectedFlowRunId:', selectedFlowRunId);
    const fetchFlowRunConversation = async () => {
      if (!selectedFlowRunId) {
        // Clear chat messages when no flow run is selected
        console.log('DEBUG: No flow run selected, clearing chat');
        setChatMessages([]);
        setConversationData(null);
        return;
      }

      try {
        console.log('DEBUG: Fetching flow run details for:', selectedFlowRunId);
        // Fetch flow run details to get conversation_id
        const flowRunResponse = await fetch(`/api/proxy/api/flow-runs/${selectedFlowRunId}`);
        if (!flowRunResponse.ok) {
          console.error('Failed to fetch flow run details');
          return;
        }

        const flowRunData = await flowRunResponse.json();
        const flowRun = flowRunData.flow_run;
        const conversationId = flowRun.conversation_id;
        
        // Extract step runs from flow run data
        const stepRuns = flowRunData.step_runs || [];
        console.log('Flow run step_runs:', stepRuns.length, 'steps available');
        
        // Transform step_runs into flow_steps format for FlowRun component
        const transformedFlowSteps = stepRuns.map((stepRun: any, index: number) => {
          // Extract step title from step_id or prompt
          let title = stepRun.step_id || `Step ${index + 1}`;
          if (stepRun.prompt && stepRun.prompt.includes('Execute step:')) {
            const titleMatch = stepRun.prompt.match(/Execute step:\s*(.+?)\n/);
            if (titleMatch) {
              title = titleMatch[1];
            }
          }
          
          // Extract API calls from step run data
          let api_calls = [];
          if (stepRun.api_calls && Array.isArray(stepRun.api_calls)) {
            api_calls = stepRun.api_calls.map((apiCall: any) => ({
              endpoint: apiCall.endpoint || apiCall.url || '',
              method: apiCall.method || 'GET',
              params: apiCall.params || apiCall.parameters || {},
              response: apiCall.response || apiCall.result || null,
              timestamp: apiCall.timestamp || Date.now(),
              duration: apiCall.duration || 0
            }));
          }
          
          return {
            id: stepRun.id,
            title: title,
            instructions: stepRun.prompt || '',
            response: stepRun.response || null,
            status: stepRun.status || 'unknown',
            api_calls: api_calls.length > 0 ? api_calls : undefined
          };
        });
        
        console.log('Transformed flow steps:', transformedFlowSteps.length);

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
          
          // Create conversation data with transformed flow steps for FlowRun component
          const conversationDataForFlowRun = {
            flow_completed: flowRun.status === 'completed',
            state: flowRun.status,
            flow_steps: transformedFlowSteps,
            last_step_response: flowRun.output_response || ''
          };
          
          setConversationData(conversationDataForFlowRun);
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
        console.log('Full API response:', JSON.stringify(conversationData, null, 2));
        
        if (conversationData.success && conversationData.data?.conversation) {
          const conversation = conversationData.data.conversation;
          console.log('Conversation:', JSON.stringify(conversation, null, 2));
          const flowSteps = conversation.flow_steps || [];
          const lastStepResponse = conversation.last_step_response || '';
          console.log('Flow steps from conversation API:', flowSteps.length, 'Last step response:', lastStepResponse);
          
          // Merge conversation data with transformed flow steps from step_runs
          // Use step_runs data if conversation flow_steps is empty
          const mergedConversation = {
            ...conversation,
            // Override flow_completed and state from flow run data since conversation API
            // returns incorrect values (not_initialized, false)
            flow_completed: flowRun.status === 'completed',
            state: flowRun.status,
            flow_steps: flowSteps.length > 0 ? flowSteps : transformedFlowSteps,
            last_step_response: lastStepResponse || flowRun.output_response || ''
          };
          
          console.log('Merged conversation data:', {
            hasFlowSteps: !!mergedConversation.flow_steps,
            flowStepsCount: mergedConversation.flow_steps?.length || 0,
            hasLastStepResponse: !!mergedConversation.last_step_response,
            flowCompleted: mergedConversation.flow_completed,
            state: mergedConversation.state
          });
          
          // DEBUG: Show alert with flow steps count
          if (typeof window !== 'undefined') {
            console.log('DEBUG ALERT: Flow steps count =', mergedConversation.flow_steps?.length || 0);
          }
          
          // Store merged conversation data for FlowRun component
          setConversationData(mergedConversation);
          
          // DEBUG: Log conversation data structure
          console.log('DEBUG - Conversation data structure:', {
            hasFlowSteps: !!mergedConversation.flow_steps,
            flowStepsCount: mergedConversation.flow_steps?.length || 0,
            hasLastStepResponse: !!mergedConversation.last_step_response,
            lastStepResponseLength: mergedConversation.last_step_response?.length || 0,
            lastStepResponsePreview: mergedConversation.last_step_response ? mergedConversation.last_step_response.substring(0, 100) + '...' : 'EMPTY',
            flowCompleted: mergedConversation.flow_completed,
            state: mergedConversation.state,
            conversationId: conversation.id,
            rawFlowSteps: mergedConversation.flow_steps?.map((step: any, i: number) => ({
              index: i,
              title: step.title,
              hasInstructions: !!step.instructions,
              instructionsLength: step.instructions?.length || 0,
              hasResponse: !!step.response,
              responseLength: step.response?.length || 0,
              status: step.status
            }))
          });
          
          // DEBUG: Log step responses
          if (mergedConversation.flow_steps) {
            console.log('DEBUG - Step responses:');
            mergedConversation.flow_steps.forEach((step: any, index: number) => {
              console.log(`  Step ${index + 1}:`, {
                title: step.title,
                hasInstructions: !!step.instructions,
                instructionsPreview: step.instructions ? step.instructions.substring(0, 100) + '...' : 'NO INSTRUCTIONS',
                hasResponse: !!step.response,
                responseLength: step.response?.length || 0,
                responsePreview: step.response ? step.response.substring(0, 100) + '...' : 'NO RESPONSE',
                status: step.status
              });
            });
          }
          
          // Build chat messages from conversation (for backward compatibility)
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
          mergedConversation.flow_steps.forEach((step: any, index: number) => {
            console.log(`Step ${index}:`, JSON.stringify(step, null, 2));
            if (step.instructions) {
              messages.push({
                id: `step-${step.id}-${index}`,
                type: 'assistant',
                content: `Step ${index + 1}: ${step.title || 'Untitled'}\n\n${step.instructions}`,
                timestamp: new Date(flowRun.started_at * 1000 + index * 1000) // Stagger timestamps
              });
            } else {
              console.log(`Step ${index} has no instructions property`);
            }
          });

          // Add last step response if available
          if (mergedConversation.last_step_response) {
            messages.push({
              id: `response-${flowRun.id}`,
              type: 'assistant',
              content: mergedConversation.last_step_response,
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
          
          // Create conversation data with transformed flow steps for FlowRun component
          const conversationDataForFlowRun = {
            flow_completed: flowRun.status === 'completed',
            state: flowRun.status,
            flow_steps: transformedFlowSteps,
            last_step_response: flowRun.output_response || ''
          };
          
          setConversationData(conversationDataForFlowRun);
          setChatMessages(messages);
        }
      } catch (error) {
        console.error('Error fetching flow run conversation:', error);
      }
    };

    fetchFlowRunConversation();
  }, [selectedFlowRunId]);

  // Clear conversation data when a new flow is selected
  useEffect(() => {
    if (selectedFlowId) {
      setConversationData(null);
      setConversationId(null); // Clear conversationId when flow changes
    }
  }, [selectedFlowId]);

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
      const sortedRuns = data.sort((a: SharedFlowRun, b: SharedFlowRun) => 
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
      );
      setFlowRuns(sortedRuns);
    } catch (error) {
      console.error('Error fetching flow runs:', error);
    }
  };

  // Poll to find flow run by conversation ID and automatically select it
  const pollForFlowRunByConversationId = async (conversationId: string, maxAttempts = 20, interval = 1000) => {
    console.log(`Starting to poll for flow run with conversation_id: ${conversationId}`);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`Polling attempt ${attempt}/${maxAttempts} for flow run with conversation_id: ${conversationId}`);
        
        const response = await fetch('/api/proxy/api/flow-runs');
        if (!response.ok) throw new Error('Failed to fetch flow runs');
        
        const flowRuns = await response.json();
        
        // Find flow run with matching conversation_id
        const matchingFlowRun = flowRuns.find((run: any) => run.conversation_id === conversationId);
        
        if (matchingFlowRun) {
          console.log(`Found matching flow run: ${matchingFlowRun.id} for conversation_id: ${conversationId}`);
          console.log('Flow run details:', matchingFlowRun);
          
          // Automatically select this flow run
          setSelectedFlowRunId(matchingFlowRun.id);
          
          // Update flow runs list
          const sortedRuns = flowRuns.sort((a: SharedFlowRun, b: SharedFlowRun) => 
            new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
          );
          setFlowRuns(sortedRuns);
          
          console.log(`Automatically selected flow run: ${matchingFlowRun.id}`);
          return; // Success, stop polling
        } else {
          console.log(`No matching flow run found for conversation_id: ${conversationId} (attempt ${attempt}/${maxAttempts})`);
        }
      } catch (error) {
        console.error(`Error polling for flow run (attempt ${attempt}):`, error);
      }
      
      // Wait before next attempt
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
    
    console.warn(`Failed to find flow run for conversation_id: ${conversationId} after ${maxAttempts} attempts`);
  };

  const fetchVariables = async () => {
    try {
      const response = await fetch('/api/proxy/variables');
      if (!response.ok) throw new Error('Failed to fetch variables');
      const data = await response.json();
      
      // Convert variables to CommandItem format
      const variableItems: CommandItem[] = data.map((variable: any) => ({
        id: variable.id || variable.key,
        label: variable.key,
        description: variable.value ? `Value: ${variable.value}` : 'No value set',
        value: `{${variable.key}}`,
        type: 'variable' as const
      }));
      
      setVariables(variableItems);
      console.log('Fetched variables:', variableItems.length);
    } catch (error) {
      console.error('Error fetching variables:', error);
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
    
    // Check for #variable_name pattern in the prompt
    const variableMatch = prompt.match(/^#(\w+)\s+(.+)$/);
    let variableName = null;
    let variableValue = null;
    
    if (variableMatch) {
      variableName = variableMatch[1];
      variableValue = variableMatch[2];
      
      console.log('Detected variable creation:', { variableName, variableValue });
    }
    
    // Check for ƐĐᜃvariableƐĐᜃ pattern in the prompt
    const variablePattern = /ƐĐᜃ(\w+)ƐĐᜃ/g;
    const variableMatches = [...prompt.matchAll(variablePattern)];
    const variablesToUpdate: Array<{name: string, value: string}> = [];
    
    if (variableMatches.length > 0) {
      console.log('Detected variables in prompt:', variableMatches.map(m => m[1]));
      // For each variable found in the prompt, update it with the entire prompt value
      for (const match of variableMatches) {
        variablesToUpdate.push({
          name: match[1],
          value: prompt
        });
      }
    }
    
    // Add user message to chat
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: prompt,
      timestamp: new Date(),
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    setConversationData(null); // Reset conversation data for new flow
    setInputPrompt('');
    setIsRunning(true);
    
    // Store the assistant message ID so we can update it later
    const assistantMessageId = (Date.now() + 2.5).toString();
    
    // Variables that need to be accessible in catch block
    let originalInstructions: Record<string, string> = {};
    let restoreOriginalInstructions: (() => Promise<void>) | null = null;
    
    try {
      // Create or update variables if detected
      if (variableMatch || variablesToUpdate.length > 0) {
        // Update variables found in {variable} syntax
        for (const variable of variablesToUpdate) {
          try {
            const variableResponse = await fetch('/api/proxy/api/variables', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                key: variable.name,
                value: variable.value,
                source: 'user',
                flow_id: selectedFlowId
              }),
            });
            
            if (!variableResponse.ok) {
              const errorText = await variableResponse.text();
              console.error('Failed to update variable:', variable.name, errorText);
              // Don't throw error, just log it
            } else {
              const variableResult = await variableResponse.json();
              console.log('Variable updated successfully:', variable.name, variableResult);
              
              // Add variable update confirmation message
              const variableMessage: ChatMessage = {
                id: `${Date.now()}_variable_${variable.name}`,
                type: 'assistant',
                content: `✅ Variable updated: \`${variable.name}\` = "${variable.value.substring(0, 50)}${variable.value.length > 50 ? '...' : ''}"`,
                timestamp: new Date(),
              };
              setChatMessages(prev => [...prev, variableMessage]);
            }
          } catch (error) {
            console.error('Error updating variable:', variable.name, error);
          }
        }
        
        // Also handle #variable_name syntax for backward compatibility
        if (variableMatch) {
          const variableResponse = await fetch('/api/proxy/api/variables', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              key: variableName,
              value: variableValue,
              source: 'user',
              flow_id: selectedFlowId
            }),
          });
          
          if (!variableResponse.ok) {
            const errorText = await variableResponse.text();
            console.error('Failed to create variable:', errorText);
            throw new Error(`Failed to create variable: ${variableResponse.status}`);
          }
          
          const variableResult = await variableResponse.json();
          console.log('Variable created successfully:', variableResult);
          
          // Add variable creation confirmation message
          const variableMessage: ChatMessage = {
            id: `${Date.now()}_variable`,
            type: 'assistant',
            content: `✅ Variable created: \`${variableName}\` = "${variableValue}"`,
            timestamp: new Date(),
          };
          setChatMessages(prev => [...prev, variableMessage]);
        }
      }
      
      // Note: Flow steps endpoint has been removed
      // Variables from flow steps are no longer fetched
      const variablesFromSteps: Set<string> = new Set();
      
      console.log('Variables from flow steps: (endpoint removed)');
      
      // Update variables found in flow steps with the prompt value
      for (const variableName of variablesFromSteps) {
        try {
          const variableResponse = await fetch('/api/proxy/api/variables', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              key: variableName,
              value: prompt,
              source: 'user',
              flow_id: selectedFlowId
            }),
          });
          
          if (!variableResponse.ok) {
            const errorText = await variableResponse.text();
            console.error('Failed to update variable from flow step:', variableName, errorText);
          } else {
            const variableResult = await variableResponse.json();
            console.log('Variable updated from flow step:', variableName, variableResult);
            
            // Add variable update confirmation message
            const variableMessage: ChatMessage = {
              id: `${Date.now()}_variable_${variableName}`,
              type: 'assistant',
              content: `✅ Variable updated from flow step: \`${variableName}\` = "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`,
              timestamp: new Date(),
            };
            setChatMessages(prev => [...prev, variableMessage]);
          }
        } catch (error) {
          console.error('Error updating variable from flow step:', variableName, error);
        }
      }
      
      // Save original instructions and update with resolved placeholders
      originalInstructions = {};
      const updatePromises = [];
      
      // Note: Steps are no longer fetched from API
      const steps: any[] = [];
      
      for (const step of steps) {
        console.log('Checking step:', step.id, 'instructions:', step.instructions);
        // Check for new [input:...] format placeholders
        const inputPlaceholderRegex = /\[input:([^\]]+)\]/g;
        const hasInputPlaceholders = step.instructions && inputPlaceholderRegex.test(step.instructions);
        
        if (step.instructions && hasInputPlaceholders) {
          // Save original instructions
          originalInstructions[step.id] = step.instructions;
          
          // Resolve placeholders
          let resolvedInstructions = step.instructions;
          if (prompt) {
            // Replace [input:user_prompt] placeholder with the user's prompt
            // For now, we'll replace any [input:...] with the user prompt
            // In a more advanced system, we'd parse the input name and map it to specific values
            resolvedInstructions = resolvedInstructions.replace(/\[input:([^\]]+)\]/g, prompt);
            console.log('Replaced [input:...] placeholders with:', prompt);
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
          
          // Note: Flow steps endpoint has been removed
          // Step updates are no longer performed
          console.log('Would update step:', step.id, 'with instructions:', resolvedInstructions);
          // Simulate update with a resolved promise
          const updatePromise = Promise.resolve({ success: true, message: 'Step update simulated (endpoint removed)' });
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
          
          // Note: Flow steps endpoint has been removed
          // Step restoration is no longer performed
          console.log('Would restore step:', stepId, 'with original instructions');
          // Simulate restore with a resolved promise
          const restorePromise = Promise.resolve({ success: true, message: 'Step restore simulated (endpoint removed)' });
          
          restorePromises.push(restorePromise);
        }
        
        if (restorePromises.length > 0) {
          await Promise.all(restorePromises);
          console.log('All original instructions restored');
        }
      };
      
      // Skip task creation - we're updating variables instead
      let createdTaskId = null;
      console.log('Skipping task creation - updating variables instead');
      
      // NEW: Get first step's variables and update them with prompt value
      try {
        console.log('Getting first step for flow:', selectedFlowId);
        const stepsResponse = await fetch(`/api/proxy/api/flow-steps?flow_id=${selectedFlowId}`);
        if (stepsResponse.ok) {
          const stepsData = await stepsResponse.json();
          console.log('Steps data:', stepsData);
          
          if (stepsData.success && stepsData.data && stepsData.data.length > 0) {
            const firstStep = stepsData.data[0];
            console.log('First step instructions:', firstStep.instructions);
            
            // Parse ƐĐᜃvariableKeyƐĐᜃ from step instructions
            const variablePattern = /ƐĐᜃ([^ƐĐᜃ]+)ƐĐᜃ/g;
            const variableMatches = [...firstStep.instructions.matchAll(variablePattern)];
            console.log('Variables found in first step:', variableMatches.map(m => m[1]));
            
            // Update each variable with prompt as value
            for (const match of variableMatches) {
              const variableKey = match[1];
              try {
                const variableResponse = await fetch('/api/proxy/api/variables', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    key: variableKey,
                    value: prompt,
                    flow_id: selectedFlowId
                  }),
                });
                
                if (!variableResponse.ok) {
                  const errorText = await variableResponse.text();
                  console.error('Failed to update variable from step:', variableKey, errorText);
                } else {
                  const variableResult = await variableResponse.json();
                  console.log('Variable updated from first step:', variableKey, variableResult);
                  
                  // Add variable update confirmation message
                  const variableMessage: ChatMessage = {
                    id: `${Date.now()}_stepvar_${variableKey}`,
                    type: 'assistant',
                    content: `✅ Variable from step updated: \`${variableKey}\` = "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`,
                    timestamp: new Date(),
                  };
                  setChatMessages(prev => [...prev, variableMessage]);
                }
              } catch (error) {
                console.error('Error updating variable from step:', variableKey, error);
              }
            }
          } else {
            console.log('No steps found for flow or API error');
          }
        } else {
          console.log('Failed to fetch steps for flow');
        }
      } catch (error) {
        console.error('Error fetching steps:', error);
      }
      
      // ALSO: Get latest flow run and parse variables from last step's response
      try {
        console.log('Getting latest flow run for flow:', selectedFlowId);
        const flowRunsResponse = await fetch(`/api/proxy/api/flow-runs?flow_id=${selectedFlowId}`);
        if (flowRunsResponse.ok) {
          const flowRunsData = await flowRunsResponse.json();
          console.log('Flow runs data:', flowRunsData);
          
          if (Array.isArray(flowRunsData) && flowRunsData.length > 0) {
            // Get latest flow run (sort by created_at to get most recent)
            const sortedFlowRuns = [...flowRunsData].sort((a, b) => 
              (b.created_at || 0) - (a.created_at || 0)
            );
            const latestFlowRun = sortedFlowRuns[0];
            const flowRunId = latestFlowRun.id;
            console.log('Latest flow run:', flowRunId);
            
            // Get step runs for this flow run
            const stepRunsResponse = await fetch(`/api/proxy/api/flow-runs/${flowRunId}`);
            if (stepRunsResponse.ok) {
              const stepRunsData = await stepRunsResponse.json();
              console.log('Step runs data:', stepRunsData);
              
              if (stepRunsData.step_runs && Array.isArray(stepRunsData.step_runs) && stepRunsData.step_runs.length > 0) {
                // Get last step run (sort by created_at to get most recent)
                const sortedStepRuns = [...stepRunsData.step_runs].sort((a, b) => 
                  (b.created_at || 0) - (a.created_at || 0)
                );
                const lastStepRun = sortedStepRuns[0];
                const lastStepResponse = lastStepRun.response;
                console.log('Last step response:', lastStepResponse);
                
                if (lastStepResponse) {
                  // Parse variables from response (same pattern as from instructions)
                  const variablePattern = /ƐĐᜃ([^ƐĐᜃ]+)ƐĐᜃ/g;
                  const variableMatches = [...lastStepResponse.matchAll(variablePattern)];
                  console.log('Variables found in last step response:', variableMatches.map(m => m[1]));
                  
                  // Update each variable with prompt as value
                  for (const match of variableMatches) {
                    const variableKey = match[1];
                    try {
                      const variableResponse = await fetch('/api/proxy/api/variables', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          key: variableKey,
                          value: prompt,
                          flow_id: selectedFlowId
                        }),
                      });
                      
                      if (!variableResponse.ok) {
                        const errorText = await variableResponse.text();
                        console.error('Failed to update variable from last step response:', variableKey, errorText);
                      } else {
                        const variableResult = await variableResponse.json();
                        console.log('Variable updated from last step response:', variableKey, variableResult);
                        
                        // Add variable update confirmation message
                        const variableMessage: ChatMessage = {
                          id: `${Date.now()}_laststepvar_${variableKey}`,
                          type: 'assistant',
                          content: `✅ Variable from last step response updated: \`${variableKey}\` = "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`,
                          timestamp: new Date(),
                        };
                        setChatMessages(prev => [...prev, variableMessage]);
                      }
                    } catch (error) {
                      console.error('Error updating variable from last step response:', variableKey, error);
                    }
                  }
                }
              } else {
                console.log('No step runs found for flow run');
              }
            } else {
              console.log('Failed to fetch step runs for flow run');
            }
          } else {
            console.log('No flow runs found for flow');
          }
        } else {
          console.log('Failed to fetch flow runs');
        }
      } catch (error) {
        console.error('Error parsing variables from last step response:', error);
        // Continue anyway - this is optional enhancement
      }
      
      // Start or resume the flow with inputs
      let flowResponse;
      if (selectedFlowRunId) {
        // Resume existing flow run
        flowResponse = await fetch('/api/proxy/resume', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            flow_run_id: selectedFlowRunId,
            step_id: "(last)",
            input: prompt
          }),
        });
      } else {
        // Start new flow
        flowResponse = await fetch('/api/proxy/start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            flow_id: selectedFlowId,
            inputs: {
              user_prompt: prompt
            }
          }),
        });
      }
      
      if (!flowResponse.ok) throw new Error('Failed to start/resume flow');
      
      const flowResult = await flowResponse.json();
      
      // Debug log
      console.log('Flow start result:', flowResult);
      console.log('Flow data:', flowResult.data);
      
      // Check if flow actually started successfully
      if (!flowResult.success) {
        throw new Error(flowResult.error || 'Failed to start flow execution');
      }
      
      const newConversationId = flowResult.data?.conversation_id;
      const flowRunId = flowResult.data?.flow_run_id;
      
      // Update conversationId state if we got a new one
      if (newConversationId) {
        setConversationId(newConversationId);
      }
      
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
      
      // If we have flowRunId from the response, use it directly
      if (flowRunId) {
        console.log('Setting flow run ID from response:', flowRunId);
        setSelectedFlowRunId(flowRunId);
      }
      
      // Start polling for actual results if we have a conversation ID
      if (newConversationId) {
        startPollingForResults(newConversationId, assistantMessageId, prompt, restoreOriginalInstructions);
        
        // Only poll for flow run if we don't already have the flowRunId
        if (!flowRunId) {
          pollForFlowRunByConversationId(newConversationId);
        }
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
      setConversationId(null); // Clear conversationId on error
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
      // Skip task creation - we're not creating tasks anymore
      console.log('Skipping task creation for "Start flow without prompt"');
      const createdTaskId = null;
      
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
      
      const newConversationId = flowResult.data?.conversation_id;
      const flowRunId = flowResult.data?.flow_run_id;
      
      // Update conversationId state if we got a new one
      if (newConversationId) {
        setConversationId(newConversationId);
      }
      
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
      
      // If we have flowRunId from the response, use it directly
      if (flowRunId) {
        console.log('Setting flow run ID from response:', flowRunId);
        setSelectedFlowRunId(flowRunId);
      }
      
      // Start polling for actual results if we have a conversation ID
      if (newConversationId) {
        startPollingForResults(newConversationId, assistantMessageId, "");
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
      setConversationId(null); // Clear conversationId on error
    } finally {
      setIsRunning(false);
    }
  };

  const startPollingForResults = (conversationId: string, assistantMessageId: string, userMessage: string = '', restoreInstructions?: () => Promise<void>) => {
    console.log('=== SIMPLIFIED POLLING STARTED ===');
    console.log('Conversation ID:', conversationId);
    
    let pollCount = 0;
    const maxPolls = 30;
    const pollInterval = 2000;
    
    // Create a simple polling function
    const pollForCompletion = async () => {
      try {
        pollCount++;
        console.log(`Poll #${pollCount} for ${conversationId}`);
        
        // Fetch status
        const response = await fetch(`/api/proxy/status/${conversationId}`);
        if (!response.ok) {
          console.error(`Status fetch failed: ${response.status}`);
          return false;
        }
        
        const data = await response.json();
        console.log('Status response:', JSON.stringify(data, null, 2));
        
        // Add debug message to show polling is working
        const debugMsg: ChatMessage = {
          id: `debug_${conversationId}_${Date.now()}`,
          type: 'api_response',
          content: `🔍 Poll #${pollCount}: Checking status...\n**Status:** running`,
          timestamp: new Date(),
        };
        setChatMessages(prev => [...prev, debugMsg]);
        
        // Check if we have valid conversation data
        // Note: The response has data.success (top level) and data.data.success (nested)
        if (data.success && data.data?.success && data.data?.conversation) {
          const conversation = data.data.conversation;
          console.log(`State: ${conversation.state}, Flow Completed: ${conversation.flow_completed}`);
          
          // Store conversation data for FlowRun component
          setConversationData(conversation);
          
          // Check for completion
          if (conversation.flow_completed || conversation.state === 'DONE' || conversation.state === 'COMPLETED') {
            console.log('✅ FLOW COMPLETED DETECTED!');
            
            // Clear conversationId when flow is completed
            setConversationId(null);
            
            // Update UI to show completion - SIMPLIFIED VERSION
            const completionMsg: ChatMessage = {
              id: `completion_${conversationId}_${Date.now()}`,
              type: 'api_response',
              content: `✅ **FLOW COMPLETED!**\n**Status:** ${conversation.state}\n**Time:** ${new Date().toLocaleTimeString()}`,
              timestamp: new Date(),
            };
            
            // Direct update - no filtering
            console.log('Adding completion message:', completionMsg);
            setChatMessages(prev => {
              console.log('Previous messages before adding completion:', prev.length);
              const newMessages = [...prev, completionMsg];
              console.log('New messages after adding completion:', newMessages.length);
              return newMessages;
            });
            
            return true; // Completed
          }
          
          // Check if conversation expired
          if (conversation.state === 'not_initialized') {
            console.log('Conversation expired/cleared');
            return true; // Stop polling
          }
        } else {
          console.log('Invalid response structure:', data);
        }
        
        // Check max polls
        if (pollCount >= maxPolls) {
          console.log(`Max polls reached (${maxPolls})`);
          if (restoreInstructions) {
            restoreInstructions().catch(err => console.error('Restore failed:', err));
          }
          return true; // Stop polling
        }
        
        return false; // Not completed, continue polling
      } catch (error) {
        console.error('Polling error:', error);
        return false;
      }
    };
    
    // Start polling immediately and set up interval
    pollForCompletion().then(completed => {
      if (completed) {
        console.log('Flow completed on first check');
        return;
      }
      
      console.log('Starting polling interval...');
      const intervalId = setInterval(async () => {
        const completed = await pollForCompletion();
        if (completed) {
          console.log('Stopping polling interval');
          clearInterval(intervalId);
        }
      }, pollInterval);
      
      // Store interval ID for cleanup if needed
      console.log('Polling interval ID:', intervalId);
    });
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

  const formatRelativeTime = (dateInput: string | number): string => {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : new Date(dateInput * 1000);
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
          return 'bg-gray-600 text-white justify-end';
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
        case 'user': return 'text-gray-200';
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
      case 'running': return 'bg-gray-500/20 text-gray-400';
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
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400"></div>
          <span className="text-xs text-gray-400">Running</span>
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
                  {conversationData ? (
                    <FlowRun data={conversationData} />
                  ) : chatMessages.length === 0 ? (
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
                      <IntelligentTextarea
                        value={inputPrompt}
                        onChange={setInputPrompt}
                        placeholder={selectedFlowId ? "Type / for commands or # for variables..." : "Select a flow first to send messages"}
                        className="w-full bg-gray-800 text-gray-200 rounded-lg px-4 py-3 resize-none min-h-[60px] max-h-[200px] focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                        variables={variables}
                        commands={[]}
                        flows={[]}
                        steps={[]}
                        flowruns={[]}
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
                          className="p-2 rounded-lg bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                              ? 'bg-gray-600/20 border border-gray-600/30'
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