'use client';

import React, { useState, useEffect } from 'react';

export type ExecutionEvent = {
  key: string; // for dedupe + react key
  type: 'FLOW_RUNNING' | 'STEP_PROMPT' | 'STEP_RESPONSE' | 'FLOW_COMPLETED' | 'API_CALL' | 'API_RESPONSE' | 'STATUS_UPDATE' | 'FLOW_STATUS' | 'STEP_STATUS';
  content?: string;
  metadata?: {
    apiEndpoint?: string;
    apiMethod?: string;
    apiParams?: any;
    apiResponse?: any;
    statusType?: string;
    duration?: number;
    timestamp?: number;
    stepIndex?: number;
    stepTitle?: string;
    stepStatus?: string;
    collapsed?: boolean;
  };
};

export type ConversationData = {
  flow_completed?: boolean;
  state?: string;
  flow_steps?: Array<{
    id?: string;
    title?: string;
    instructions?: string;
    response?: string | null;
    status?: string;
    api_calls?: Array<{
      endpoint: string;
      method: string;
      params?: any;
      response?: any;
      timestamp: number;
      duration?: number;
    }>;
  }>;
  last_step_response?: string;
  _updatedAt?: number; // Internal timestamp for React re-renders
};

interface FlowRunProps {
  data: ConversationData | null;
}

export const mapConversationToEvents = (conversation: ConversationData | null): ExecutionEvent[] => {
  try {
    console.log('mapConversationToEvents - Input conversation:', conversation);
    
    if (!conversation) {
      console.log('mapConversationToEvents - Conversation is null or undefined');
      return [];
    }

    const events: ExecutionEvent[] = [];

    // Add FLOW_STATUS event to show overall flow status (always visible, in green)
    if (conversation.state) {
      console.log('mapConversationToEvents - Adding FLOW_STATUS event');
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
      console.log('mapConversationToEvents - Adding FLOW_RUNNING event');
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
      console.log(`mapConversationToEvents - Processing ${conversation.flow_steps.length} flow steps`);
      
      conversation.flow_steps.forEach((step, index) => {
        console.log(`mapConversationToEvents - Step ${index + 1}:`, {
          title: step.title,
          hasInstructions: !!step.instructions,
          hasResponse: !!step.response,
          responseType: typeof step.response,
          responseValue: step.response,
          status: step.status,
          apiCalls: step.api_calls?.length || 0
        });
        
        // Add STEP_STATUS event to show step status (always visible, in green)
        if (step.status) {
          console.log(`mapConversationToEvents - Adding STEP_STATUS for step ${index + 1}`);
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

        // Add STEP_PROMPT event for step instructions (only if it doesn't contain raw ƐĐᜃ syntax)
        if (step.instructions) {
          const promptContent = step.instructions;
          
          // Check if instructions contain raw ƐĐᜃ syntax
          const hasRawSyntax = promptContent.includes('ƐĐᜃ');
          
          if (!hasRawSyntax) {
            console.log(`mapConversationToEvents - Adding STEP_PROMPT for step ${index + 1}`);
            events.push({
              key: `STEP_PROMPT:${step.id || index}`,
              type: 'STEP_PROMPT',
              content: promptContent,
              metadata: {
                timestamp: Date.now(),
                stepIndex: index + 1,
                stepTitle: step.title,
                stepStatus: step.status
              }
            });
          } else {
            console.log(`mapConversationToEvents - Skipping STEP_PROMPT for step ${index + 1} (contains raw ƐĐᜃ syntax)`);
          }
        }

        // Add API calls for this step (if any) - attached to the prompt
        if (step.api_calls && Array.isArray(step.api_calls)) {
          step.api_calls.forEach((apiCall, apiIndex) => {
            // API call event - attached to step
            events.push({
              key: `API_CALL:${step.id || index}:${apiIndex}:${apiCall.endpoint}`,
              type: 'API_CALL',
              content: `${apiCall.method} ${apiCall.endpoint}`,
              metadata: {
                apiEndpoint: apiCall.endpoint,
                apiMethod: apiCall.method,
                apiParams: apiCall.params,
                timestamp: apiCall.timestamp,
                stepIndex: index + 1
              }
            });
            
            // API response event - attached to step
            if (apiCall.response) {
              events.push({
                key: `API_RESPONSE:${step.id || index}:${apiIndex}:${apiCall.endpoint}`,
                type: 'API_RESPONSE',
                content: typeof apiCall.response === 'string' ? apiCall.response : JSON.stringify(apiCall.response, null, 2),
                metadata: {
                  apiEndpoint: apiCall.endpoint,
                  apiMethod: apiCall.method,
                  apiResponse: apiCall.response,
                  duration: apiCall.duration,
                  timestamp: apiCall.timestamp + (apiCall.duration || 0),
                  stepIndex: index + 1
                }
              });
            }
          });
        }

        // Add STEP_RESPONSE event for step response (if exists and not null)
        if (step.response && step.response.trim() !== '') {
          console.log(`mapConversationToEvents - Adding STEP_RESPONSE for step ${index + 1}`);
          const responseContent = step.response;
          
          events.push({
            key: `STEP_RESPONSE:${step.id || index}`,
            type: 'STEP_RESPONSE',
            content: responseContent,
            metadata: {
              stepIndex: index + 1,
              stepTitle: step.title,
              stepStatus: step.status,
              timestamp: Date.now()
            }
          });
          
          // Add STATUS_UPDATE for step completion (will flash and disappear)
          events.push({
            key: `STATUS_UPDATE_STEP_${step.id || index}_${Date.now()}`,
            type: 'STATUS_UPDATE',
            content: `Step ${index + 1} completed`,
            metadata: {
              statusType: 'STEP_COMPLETED',
              timestamp: Date.now(),
              stepIndex: index + 1,
              stepTitle: step.title
            }
          });
        } else if (step.response === null || step.response === undefined) {
          console.log(`mapConversationToEvents - Step ${index + 1} response is null or undefined`);
        } else if (step.response.trim() === '') {
          console.log(`mapConversationToEvents - Step ${index + 1} response is empty or whitespace`);
        }
      });
    } else {
      console.log('mapConversationToEvents - No flow_steps or flow_steps is not an array');
    }

    // Add STEP_RESPONSE event if last_step_response exists (fallback)
    if (conversation.last_step_response && conversation.last_step_response.trim() !== '') {
      console.log('mapConversationToEvents - Adding STEP_RESPONSE from last_step_response');
      events.push({
        key: `STEP_RESPONSE:LAST`,
        type: 'STEP_RESPONSE',
        content: conversation.last_step_response,
        metadata: {
          timestamp: Date.now()
        }
      });
    }

    // Add FLOW_COMPLETED event if flow is completed
    if (conversation.flow_completed === true) {
      console.log('mapConversationToEvents - Adding FLOW_COMPLETED event');
      events.push({
        key: 'FLOW_COMPLETED',
        type: 'FLOW_COMPLETED',
        metadata: {
          timestamp: Date.now()
        }
      });
      
      // Also add a STATUS_UPDATE for flow completion (will flash and disappear)
      events.push({
        key: `STATUS_UPDATE_FLOW_COMPLETED_${Date.now()}`,
        type: 'STATUS_UPDATE',
        content: 'Flow completed',
        metadata: {
          statusType: 'FLOW_COMPLETED',
          timestamp: Date.now()
        }
      });
    }

    console.log('mapConversationToEvents - Returning events:', events.length, 'events');
    return events;
  } catch (error) {
    console.error('mapConversationToEvents - Error:', error);
    return [];
  }
};

const FlowRun: React.FC<FlowRunProps> = ({ data }) => {
  // State to track which events are collapsed
  const [collapsedEvents, setCollapsedEvents] = React.useState<Record<string, boolean>>({});
  // State to track which STATUS_UPDATE events should be hidden (flashed away)
  const [hiddenStatusEvents, setHiddenStatusEvents] = React.useState<Set<string>>(new Set());
  // State to track which events are currently showing (for animation)
  const [showingEvents, setShowingEvents] = React.useState<Set<string>>(new Set());
  
  // Transform conversation data to events
  const events = React.useMemo(() => {
    const events = mapConversationToEvents(data);
    return events;
  }, [data]);

  // Auto-show events with delay for sequential appearance
  React.useEffect(() => {
    if (events.length === 0) return;

    const timers: NodeJS.Timeout[] = [];
    
    events.forEach((event, index) => {
      const timer = setTimeout(() => {
        setShowingEvents(prev => {
          const newSet = new Set(prev);
          newSet.add(event.key);
          return newSet;
        });
      }, index * 300); // Show each event 300ms after previous
      
      timers.push(timer);
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [events]);

  // Auto-hide STATUS_UPDATE events after 5 seconds (flash effect)
  React.useEffect(() => {
    const statusEvents = events.filter(event => event.type === 'STATUS_UPDATE');
    if (statusEvents.length === 0) return;

    const timers: NodeJS.Timeout[] = [];
    
    statusEvents.forEach(event => {
      // Don't hide if already hidden
      if (hiddenStatusEvents.has(event.key)) return;
      
      const timer = setTimeout(() => {
        setHiddenStatusEvents(prev => {
          const newSet = new Set(prev);
          newSet.add(event.key);
          return newSet;
        });
      }, 5000); // Hide after 5 seconds
      
      timers.push(timer);
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [events, hiddenStatusEvents]);

  // Render events as chat messages
  const renderEvent = (event: ExecutionEvent) => {
    // Skip hidden STATUS_UPDATE events
    if (event.type === 'STATUS_UPDATE' && hiddenStatusEvents.has(event.key)) {
      return null;
    }
    
    // Skip if not showing yet
    if (!showingEvents.has(event.key)) {
      return null;
    }
    
    switch (event.type) {
      case 'FLOW_RUNNING':
        return (
          <div key={event.key} className="animate-pulse flex items-start gap-3 p-4 border-b border-green-700 bg-gradient-to-r from-green-900/20 to-green-800/10 rounded-lg mb-3 transition-all duration-300 opacity-0 animate-fade-in">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-green-700 to-green-800 flex items-center justify-center shadow-sm">
              <span className="text-green-300 text-lg">⏳</span>
            </div>
            <div className="flex-1">
              <div className="font-semibold text-green-100 flex items-center gap-2">
                <span className="text-xs font-medium text-green-400 bg-green-900/50 px-2 py-0.5 rounded-full">
                  LIVE
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-green-600 to-green-700 text-white shadow-sm">
                  RUNNING
                </span>
                <span className="text-xs text-green-400">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        );

      case 'STEP_PROMPT':
        const isStepPromptCollapsed = collapsedEvents[event.key] ?? (event.metadata?.collapsed ?? false);
        return (
          <div key={event.key} className="flex items-start gap-3 p-4 border border-gray-700 bg-gray-800 rounded-xl mb-3 shadow-sm ml-auto max-w-3/4 transition-all duration-300 opacity-0 animate-fade-in">
            <div className="flex-1">
              <div className="font-semibold text-gray-100 flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCollapsedEvents(prev => ({ ...prev, [event.key]: !isStepPromptCollapsed }))}
                    className="text-xs font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 px-2 py-0.5 rounded-full transition-colors"
                  >
                    {isStepPromptCollapsed ? 'Show' : 'Hide'}
                  </button>
                </div>
                <span className="text-xs font-semibold text-gray-300 bg-gray-700 px-2 py-0.5 rounded-full">
                  PROMPT
                </span>
              </div>
              {!isStepPromptCollapsed && (
                <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                  <div className="text-gray-100 whitespace-pre-wrap font-mono text-sm leading-relaxed">
                    {event.content}
                  </div>
                </div>
              )}
            </div>
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center shadow-sm">
              <span className="text-gray-300 text-lg font-bold">AI</span>
            </div>
          </div>
        );

      case 'STEP_RESPONSE':
        const isStepResponseCollapsed = collapsedEvents[event.key] ?? (event.metadata?.collapsed ?? false);
        return (
          <div key={event.key} className="flex items-start gap-3 p-4 border border-gray-700 bg-gray-800 rounded-xl mb-3 shadow-sm mr-auto max-w-3/4 transition-all duration-300 opacity-0 animate-fade-in">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center shadow-sm">
              <span className="text-gray-300 text-lg font-bold">✓</span>
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-100 flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCollapsedEvents(prev => ({ ...prev, [event.key]: !isStepResponseCollapsed }))}
                    className="text-xs font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 px-2 py-0.5 rounded-full transition-colors"
                  >
                    {isStepResponseCollapsed ? 'Show' : 'Hide'}
                  </button>
                </div>
                <span className="text-xs font-semibold text-gray-300 bg-gray-700 px-2 py-0.5 rounded-full">
                  RESPONSE
                </span>
              </div>
              {!isStepResponseCollapsed && (
                <div className="bg-gray-900/30 rounded-lg p-3 border border-gray-700">
                  <div className="text-gray-100 whitespace-pre-wrap font-mono text-sm leading-relaxed">
                    {event.content}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 'FLOW_COMPLETED':
        return (
          <div key={event.key} className="flex items-start gap-3 p-4 border border-green-700 bg-gradient-to-r from-green-900/20 to-green-800/10 rounded-xl mb-3 shadow-sm transition-all duration-300 opacity-0 animate-fade-in">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-green-700 to-green-800 flex items-center justify-center shadow-sm">
              <span className="text-green-300 text-lg font-bold">✓</span>
            </div>
            <div className="flex-1">
              <div className="font-semibold text-green-100 flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-green-300 bg-green-900/50 px-2 py-0.5 rounded-full">
                  FLOW COMPLETED
                </span>
              </div>
              <div className="space-y-2">
                <div className="text-green-100 whitespace-pre-wrap font-medium">Flow execution completed successfully</div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-green-600 to-green-700 text-white shadow-sm">
                    COMPLETED
                  </span>
                  <span className="text-xs text-green-400">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'API_CALL':
        const isApiCallCollapsed = collapsedEvents[event.key] ?? (event.metadata?.collapsed ?? true);
        return (
          <div key={event.key} className="flex items-start gap-3 p-4 border border-gray-700 bg-gray-800 rounded-xl mb-3 shadow-sm ml-auto max-w-3/4 transition-all duration-300 opacity-0 animate-fade-in">
            <div className="flex-1">
              <div className="font-semibold text-gray-100 flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCollapsedEvents(prev => ({ ...prev, [event.key]: !isApiCallCollapsed }))}
                    className="text-xs font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 px-2 py-0.5 rounded-full transition-colors"
                  >
                    {isApiCallCollapsed ? 'Show' : 'Hide'}
                  </button>
                </div>
                <span className="text-xs font-semibold text-gray-300 bg-gray-700 px-2 py-0.5 rounded-full">
                  {event.metadata?.apiMethod || 'CALL'}
                </span>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="text-sm font-medium text-gray-300 mb-1">Endpoint</div>
                  <div className="bg-gray-900 rounded px-3 py-2 font-mono text-sm text-gray-100">
                    {event.metadata?.apiEndpoint || event.content}
                  </div>
                </div>
                {!isApiCallCollapsed && event.metadata?.apiParams && (
                  <div>
                    <div className="text-sm font-medium text-gray-300 mb-1">Parameters</div>
                    <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                      <pre className="text-xs text-gray-100 overflow-x-auto">
                        {JSON.stringify(event.metadata.apiParams, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center shadow-sm">
              <span className="text-gray-300 text-lg">↗️</span>
            </div>
          </div>
        );

      case 'API_RESPONSE':
        const isApiResponseCollapsed = collapsedEvents[event.key] ?? (event.metadata?.collapsed ?? true);
        return (
          <div key={event.key} className="flex items-start gap-3 p-4 border border-gray-700 bg-gray-800 rounded-xl mb-3 shadow-sm mr-auto max-w-3/4 transition-all duration-300 opacity-0 animate-fade-in">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center shadow-sm">
              <span className="text-gray-300 text-lg">↙️</span>
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-100 flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCollapsedEvents(prev => ({ ...prev, [event.key]: !isApiResponseCollapsed }))}
                    className="text-xs font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 px-2 py-0.5 rounded-full transition-colors"
                  >
                    {isApiResponseCollapsed ? 'Show' : 'Hide'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {event.metadata?.duration && (
                    <span className="text-xs font-medium text-gray-300 bg-gray-700 px-2 py-0.5 rounded-full">
                      {event.metadata.duration}ms
                    </span>
                  )}
                  <span className="text-xs font-semibold text-gray-300 bg-gray-700 px-2 py-0.5 rounded-full">
                    RESPONSE
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="text-sm font-medium text-gray-300 mb-1">Endpoint</div>
                  <div className="bg-gray-900 rounded px-3 py-2 font-mono text-sm text-gray-100">
                    {event.metadata?.apiEndpoint || event.content}
                  </div>
                </div>
                {!isApiResponseCollapsed && event.metadata?.apiResponse && (
                  <div>
                    <div className="text-sm font-medium text-gray-300 mb-1">Response Data</div>
                    <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                      <pre className="text-xs text-gray-100 overflow-x-auto">
                        {JSON.stringify(event.metadata.apiResponse, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'STATUS_UPDATE':
        return (
          <div key={event.key} className="animate-pulse flex items-start gap-3 p-4 border border-gray-700 bg-gradient-to-r from-gray-800 to-gray-900/30 rounded-xl mb-3 shadow-sm transition-all duration-300 opacity-0 animate-fade-in">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center shadow-sm">
              <span className="text-gray-300 text-lg">📊</span>
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-100 flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-300 bg-gray-800 px-2 py-0.5 rounded-full">
                  {event.metadata?.statusType || 'UPDATE'}
                </span>
              </div>
              <div className="space-y-2">
                <div className="text-gray-100 whitespace-pre-wrap">{event.content}</div>
                {event.metadata?.timestamp && (
                  <div className="text-xs text-gray-400">
                    {new Date(event.metadata.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'FLOW_STATUS':
        return (
          <div key={event.key} className="flex items-start gap-3 p-4 border border-green-700 bg-gradient-to-r from-green-900/20 to-green-800/10 rounded-xl mb-3 shadow-sm transition-all duration-300 opacity-0 animate-fade-in">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-green-700 to-green-800 flex items-center justify-center shadow-sm">
              <span className="text-green-300 text-lg">📈</span>
            </div>
            <div className="flex-1">
              <div className="font-semibold text-green-100 flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-green-300 bg-green-900/50 px-2 py-0.5 rounded-full">
                  FLOW STATUS
                </span>
              </div>
              <div className="space-y-2">
                <div className="text-green-100 whitespace-pre-wrap font-medium">{event.content}</div>
                {event.metadata?.timestamp && (
                  <div className="text-xs text-green-400">
                    {new Date(event.metadata.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'STEP_STATUS':
        return (
          <div key={event.key} className="flex items-start gap-3 p-4 border border-green-700 bg-gradient-to-r from-green-900/20 to-green-800/10 rounded-xl mb-3 shadow-sm transition-all duration-300 opacity-0 animate-fade-in">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-green-700 to-green-800 flex items-center justify-center shadow-sm">
              <span className="text-green-300 text-lg">✓</span>
            </div>
            <div className="flex-1">
              <div className="font-semibold text-green-100 flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-green-300 bg-green-900/50 px-2 py-0.5 rounded-full">
                  STEP STATUS
                </span>
                {event.metadata?.stepTitle && (
                  <span className="text-xs text-green-400 ml-2">{event.metadata.stepTitle}</span>
                )}
              </div>
              <div className="space-y-2">
                <div className="text-green-100 whitespace-pre-wrap font-medium">{event.content}</div>
                {event.metadata?.timestamp && (
                  <div className="text-xs text-green-400">
                    {new Date(event.metadata.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (events.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 mb-4">
          <span className="text-gray-400 text-2xl">📊</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-100 mb-2">No Flow Events</h3>
        <p className="text-gray-400 mb-4 max-w-md mx-auto">
          The flow execution visualization will appear here when a flow is running.
        </p>
      </div>
    );
  }



  return (
    <div className="space-y-3">
      {events.map(renderEvent)}
    </div>
  );
};

export default FlowRun;