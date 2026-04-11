// Message parsing utilities - moved from chat page
import { ChatMessage, ExecutionEvent, ConversationData } from './types';

// Parse raw chat messages into structured messages (from chat page)
export const parseChatMessage = (message: ChatMessage): any => {
  const { id, type, content, timestamp } = message;
  
  if (type === 'user') {
    return {
      id,
      type: 'user',
      content,
      timestamp
    };
  }
  
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
  
  if (content.includes('[COMMAND:')) {
    const commandMatch = content.match(/\[COMMAND:([^\]]+)\]\s*params:\s*(\{[^]*\})/);
    if (commandMatch) {
      const commandName = commandMatch[1];
      let commandParams = {};
      try {
        commandParams = JSON.parse(commandMatch[2]);
      } catch (e) {
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
  
  if (type === 'step') {
    return {
      id,
      type: 'step',
      content,
      timestamp
    };
  }
  
  if (type === 'assistant' && content.includes('Flow Run:')) {
    return {
      id,
      type: 'system',
      content,
      timestamp
    };
  }
  
  return {
    id,
    type: 'response',
    content,
    timestamp
  };
};

// Convert conversation data to events (from FlowRun)
export const mapConversationToEvents = (conversation: ConversationData | null): ExecutionEvent[] => {
  try {
    if (!conversation) return [];

    const events: ExecutionEvent[] = [];

    // Add FLOW_STATUS event
    if (conversation.state) {
      events.push({
        key: `FLOW_STATUS_${conversation.state}`,
        type: 'FLOW_STATUS',
        content: `Flow Status: ${conversation.state.toUpperCase()}`,
        metadata: {
          statusType: conversation.state,
          timestamp: Date.now()
        }
      });
    }

    // Add FLOW_RUNNING event if flow is not completed
    if (conversation.flow_completed !== true && conversation.state && conversation.state !== 'not_initialized') {
      events.push({
        key: `FLOW_RUNNING_${Date.now()}`,
        type: 'FLOW_RUNNING',
        metadata: {
          statusType: conversation.state,
          timestamp: Date.now()
        }
      });
    }

    // Add STEP_PROMPT and STEP_RESPONSE events for each flow step
    if (conversation.flow_steps && Array.isArray(conversation.flow_steps)) {
      conversation.flow_steps.forEach((step, index) => {
        // Add STEP_STATUS event
        if (step.status) {
          events.push({
            key: `STEP_STATUS:${step.id || index}:${step.status}`,
            type: 'STEP_STATUS',
            content: `Step ${index + 1} Status: ${step.status.toUpperCase()}`,
            metadata: {
              stepIndex: index + 1,
              stepTitle: step.title,
              stepStatus: step.status,
              timestamp: Date.now()
            }
          });
        }

        // Add STEP_PROMPT event
        if (step.instructions && !step.instructions.includes('ƐĐᜃ')) {
          events.push({
            key: `STEP_PROMPT:${step.id || index}`,
            type: 'STEP_PROMPT',
            content: step.instructions,
            metadata: {
              timestamp: Date.now(),
              stepIndex: index + 1,
              stepTitle: step.title,
              stepStatus: step.status
            }
          });
        }

        // Add STEP_RESPONSE event
        if (step.response) {
          events.push({
            key: `STEP_RESPONSE:${step.id || index}`,
            type: 'STEP_RESPONSE',
            content: step.response,
            metadata: {
              timestamp: Date.now(),
              stepIndex: index + 1,
              stepTitle: step.title,
              stepStatus: step.status
            }
          });
        }

        // Add API_CALL events
        if (step.api_calls && Array.isArray(step.api_calls)) {
          step.api_calls.forEach((apiCall, apiIndex) => {
            events.push({
              key: `API_CALL:${step.id || index}:${apiIndex}`,
              type: 'API_CALL',
              content: `${apiCall.method} ${apiCall.endpoint}`,
              metadata: {
                apiEndpoint: apiCall.endpoint,
                apiMethod: apiCall.method,
                apiParams: apiCall.params,
                timestamp: apiCall.timestamp,
                duration: apiCall.duration,
                stepIndex: index + 1,
                stepTitle: step.title
              }
            });

            if (apiCall.response) {
              events.push({
                key: `API_RESPONSE:${step.id || index}:${apiIndex}`,
                type: 'API_RESPONSE',
                content: typeof apiCall.response === 'string' ? apiCall.response : JSON.stringify(apiCall.response, null, 2),
                metadata: {
                  apiResponse: apiCall.response,
                  timestamp: apiCall.timestamp + (apiCall.duration || 0),
                  duration: apiCall.duration,
                  stepIndex: index + 1,
                  stepTitle: step.title
                }
              });
            }
          });
        }
      });
    }

    // Add FLOW_COMPLETED event
    if (conversation.flow_completed === true) {
      events.push({
        key: `FLOW_COMPLETED_${Date.now()}`,
        type: 'FLOW_COMPLETED',
        metadata: {
          timestamp: Date.now()
        }
      });
    }

    return events;
  } catch (error) {
    console.error('Error mapping conversation to events:', error);
    return [];
  }
};

// Convert chat messages to events
export const mapChatMessagesToEvents = (chatMessages: ChatMessage[] = []): ExecutionEvent[] => {
  const events: ExecutionEvent[] = [];
  
  chatMessages.forEach((message) => {
    const parsed = parseChatMessage(message);
    
    switch (parsed.type) {
      case 'user':
        events.push({
          key: `USER_${message.id}`,
          type: 'USER_MESSAGE',
          content: parsed.content,
          metadata: {
            timestamp: parsed.timestamp.getTime()
          }
        });
        break;
        
      case 'status':
        events.push({
          key: `STATUS_${message.id}`,
          type: 'STATUS_UPDATE',
          content: parsed.content,
          metadata: {
            statusType: parsed.metadata?.statusType,
            stepName: parsed.metadata?.stepName,
            progress: parsed.metadata?.progress,
            timestamp: parsed.timestamp.getTime()
          }
        });
        break;
        
      case 'command':
        events.push({
          key: `COMMAND_${message.id}`,
          type: 'COMMAND_CALL',
          content: parsed.content,
          metadata: {
            commandName: parsed.metadata?.commandName,
            commandParams: parsed.metadata?.commandParams,
            timestamp: parsed.timestamp.getTime()
          }
        });
        break;
        
      case 'response':
        events.push({
          key: `AI_${message.id}`,
          type: 'AI_RESPONSE',
          content: parsed.content,
          metadata: {
            isThinking: parsed.metadata?.isThinking,
            timestamp: parsed.timestamp.getTime()
          }
        });
        break;
        
      case 'step':
        events.push({
          key: `STEP_MSG_${message.id}`,
          type: 'STEP_MESSAGE',
          content: parsed.content,
          metadata: {
            timestamp: parsed.timestamp.getTime()
          }
        });
        break;
        
      case 'system':
        events.push({
          key: `SYSTEM_${message.id}`,
          type: 'SYSTEM_MESSAGE',
          content: parsed.content,
          metadata: {
            timestamp: parsed.timestamp.getTime()
          }
        });
        break;
    }
  });
  
  return events;
};

// Combine all data into events
export const mapAllToEvents = (
  conversation: ConversationData | null,
  chatMessages: ChatMessage[] = []
): ExecutionEvent[] => {
  const flowEvents = mapConversationToEvents(conversation);
  const chatEvents = mapChatMessagesToEvents(chatMessages);
  
  const allEvents = [...flowEvents, ...chatEvents];
  allEvents.sort((a, b) => {
    const timeA = a.metadata?.timestamp || 0;
    const timeB = b.metadata?.timestamp || 0;
    return timeA - timeB;
  });
  
  return allEvents;
};