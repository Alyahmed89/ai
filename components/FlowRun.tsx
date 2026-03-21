'use client';

import React, { useState, useEffect } from 'react';

export type ExecutionEvent = {
  key: string; // for dedupe + react key
  type: 'FLOW_RUNNING' | 'STEP_PROMPT' | 'STEP_RESPONSE' | 'FLOW_COMPLETED' | 'API_CALL' | 'API_RESPONSE' | 'STATUS_UPDATE';
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
        
        // Add STEP_PROMPT event for step instructions
        if (step.instructions) {
          const promptContent = step.instructions;
          
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
  
  // Debug log to see what data we're receiving
  React.useEffect(() => {
    console.log('FlowRun component received data:', data);
    if (data) {
      console.log('FlowRun - Data analysis:', {
        hasFlowSteps: !!data.flow_steps,
        flowStepsCount: data.flow_steps?.length || 0,
        flowCompleted: data.flow_completed,
        state: data.state,
        stepResponses: data.flow_steps?.map((step, i) => ({
          step: i + 1,
          hasResponse: !!step.response,
          responseLength: step.response?.length || 0,
          status: step.status,
          apiCalls: step.api_calls?.length || 0
        }))
      });
    } else {
      console.log('FlowRun - Data is null or undefined');
    }
  }, [data]);
  
  // Transform conversation data to events
  const events = React.useMemo(() => {
    const events = mapConversationToEvents(data);
    console.log('FlowRun - Generated events:', events.map(e => ({ type: e.type, key: e.key, contentLength: e.content?.length || 0 })));
    return events;
  }, [data]);

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
    
    switch (event.type) {
      case 'FLOW_RUNNING':
        return (
          <div key={event.key} className="animate-pulse flex items-start gap-3 p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100/50 rounded-lg mb-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-200 to-blue-300 flex items-center justify-center shadow-sm">
              <span className="text-blue-700 text-lg">⏳</span>
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900 flex items-center gap-2">
                Flow Status
                <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                  LIVE
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm">
                  RUNNING
                </span>
                <span className="text-xs text-gray-600">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        );

      case 'STEP_PROMPT':
        const isStepPromptCollapsed = collapsedEvents[event.key] ?? (event.metadata?.collapsed ?? false);
        return (
          <div key={event.key} className="flex items-start gap-3 p-4 border border-purple-200 bg-white rounded-xl mb-3 shadow-sm">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center shadow-sm">
              <span className="text-purple-700 text-lg font-bold">AI</span>
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900 flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span>Step Prompt</span>
                  <button
                    onClick={() => setCollapsedEvents(prev => ({ ...prev, [event.key]: !isStepPromptCollapsed }))}
                    className="text-xs font-medium text-purple-700 bg-purple-100 hover:bg-purple-200 px-2 py-0.5 rounded-full transition-colors"
                  >
                    {isStepPromptCollapsed ? 'Show Details' : 'Hide Details'}
                  </button>
                </div>
                <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                  PROMPT
                </span>
              </div>
              {!isStepPromptCollapsed && (
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="text-gray-800 whitespace-pre-wrap font-mono text-sm leading-relaxed">
                    {event.content}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 'STEP_RESPONSE':
        const isStepResponseCollapsed = collapsedEvents[event.key] ?? (event.metadata?.collapsed ?? false);
        return (
          <div key={event.key} className="flex items-start gap-3 p-4 border border-green-200 bg-white rounded-xl mb-3 shadow-sm">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center shadow-sm">
              <span className="text-green-700 text-lg font-bold">✓</span>
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900 flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span>Step Response</span>
                  <button
                    onClick={() => setCollapsedEvents(prev => ({ ...prev, [event.key]: !isStepResponseCollapsed }))}
                    className="text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 px-2 py-0.5 rounded-full transition-colors"
                  >
                    {isStepResponseCollapsed ? 'Show Details' : 'Hide Details'}
                  </button>
                </div>
                <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                  RESPONSE
                </span>
              </div>
              {!isStepResponseCollapsed && (
                <div className="bg-green-50/30 rounded-lg p-3 border border-green-200">
                  <div className="text-gray-800 whitespace-pre-wrap font-mono text-sm leading-relaxed">
                    {event.content}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 'FLOW_COMPLETED':
        return (
          <div key={event.key} className="flex items-start gap-3 p-4 border border-green-200 bg-gradient-to-r from-green-50 to-green-100/30 rounded-xl mb-3 shadow-sm">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-green-200 to-green-300 flex items-center justify-center shadow-sm">
              <span className="text-green-800 text-lg font-bold">✓</span>
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900 flex items-center justify-between mb-2">
                <span>Flow Completed</span>
                <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                  SUCCESS
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-green-500 to-green-600 text-white shadow-sm">
                  COMPLETED
                </span>
                <span className="text-xs text-gray-600">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        );

      case 'API_CALL':
        const isApiCallCollapsed = collapsedEvents[event.key] ?? (event.metadata?.collapsed ?? true);
        return (
          <div key={event.key} className="flex items-start gap-3 p-4 border border-amber-200 bg-white rounded-xl mb-3 shadow-sm">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center shadow-sm">
              <span className="text-amber-700 text-lg">↗️</span>
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900 flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span>API Call</span>
                  <button
                    onClick={() => setCollapsedEvents(prev => ({ ...prev, [event.key]: !isApiCallCollapsed }))}
                    className="text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-full transition-colors"
                  >
                    {isApiCallCollapsed ? 'Show Details' : 'Hide Details'}
                  </button>
                </div>
                <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                  {event.metadata?.apiMethod || 'CALL'}
                </span>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Endpoint</div>
                  <div className="bg-gray-50 rounded px-3 py-2 font-mono text-sm text-gray-800">
                    {event.metadata?.apiEndpoint || event.content}
                  </div>
                </div>
                {!isApiCallCollapsed && event.metadata?.apiParams && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-1">Parameters</div>
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <pre className="text-xs text-gray-700 overflow-x-auto">
                        {JSON.stringify(event.metadata.apiParams, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'API_RESPONSE':
        const isApiResponseCollapsed = collapsedEvents[event.key] ?? (event.metadata?.collapsed ?? true);
        return (
          <div key={event.key} className="flex items-start gap-3 p-4 border border-emerald-200 bg-white rounded-xl mb-3 shadow-sm">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center shadow-sm">
              <span className="text-emerald-700 text-lg">↙️</span>
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900 flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span>API Response</span>
                  <button
                    onClick={() => setCollapsedEvents(prev => ({ ...prev, [event.key]: !isApiResponseCollapsed }))}
                    className="text-xs font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded-full transition-colors"
                  >
                    {isApiResponseCollapsed ? 'Show Details' : 'Hide Details'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {event.metadata?.duration && (
                    <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      {event.metadata.duration}ms
                    </span>
                  )}
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    RESPONSE
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Endpoint</div>
                  <div className="bg-gray-50 rounded px-3 py-2 font-mono text-sm text-gray-800">
                    {event.metadata?.apiEndpoint || event.content}
                  </div>
                </div>
                {!isApiResponseCollapsed && event.metadata?.apiResponse && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-1">Response Data</div>
                    <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                      <pre className="text-xs text-gray-700 overflow-x-auto">
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
          <div key={event.key} className="animate-pulse flex items-start gap-3 p-4 border border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100/30 rounded-xl mb-3 shadow-sm">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-200 to-blue-300 flex items-center justify-center shadow-sm">
              <span className="text-blue-700 text-lg">📊</span>
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900 flex items-center justify-between mb-2">
                <span>Status Update</span>
                <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                  {event.metadata?.statusType || 'UPDATE'}
                </span>
              </div>
              <div className="space-y-2">
                <div className="text-gray-700 whitespace-pre-wrap">{event.content}</div>
                {event.metadata?.timestamp && (
                  <div className="text-xs text-gray-500">
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
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 mb-4">
          <span className="text-gray-500 text-2xl">📊</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Flow Events</h3>
        <p className="text-gray-600 mb-4 max-w-md mx-auto">
          The flow execution visualization will appear here when a flow is running.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left max-w-md mx-auto">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-blue-600 text-sm">ℹ️</span>
            </div>
            <div>
              <div className="font-medium text-gray-900 mb-1">Debug Information</div>
              <div className="text-sm text-gray-700 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Data received:</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${data ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {data ? 'YES' : 'NO'}
                  </span>
                </div>
                {data && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Flow steps:</span>
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        {data.flow_steps?.length || 0}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Flow completed:</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${data.flow_completed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {data.flow_completed ? 'YES' : 'NO'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Helper functions for expand/collapse all
  const expandAll = () => {
    const newCollapsed: Record<string, boolean> = {};
    events.forEach(event => {
      newCollapsed[event.key] = false;
    });
    setCollapsedEvents(newCollapsed);
  };

  const collapseAll = () => {
    const newCollapsed: Record<string, boolean> = {};
    events.forEach(event => {
      newCollapsed[event.key] = true;
    });
    setCollapsedEvents(newCollapsed);
  };

  // Count how many events are currently collapsed
  const collapsedCount = Object.values(collapsedEvents).filter(Boolean).length;
  const totalCollapsibleEvents = events.filter(event => 
    ['STEP_PROMPT', 'STEP_RESPONSE', 'API_CALL', 'API_RESPONSE'].includes(event.type)
  ).length;
  
  // Count hidden status events
  const hiddenStatusCount = events.filter(event => 
    event.type === 'STATUS_UPDATE' && hiddenStatusEvents.has(event.key)
  ).length;
  const totalStatusEvents = events.filter(event => event.type === 'STATUS_UPDATE').length;

  return (
    <div className="space-y-3">
      {(totalCollapsibleEvents > 0 || hiddenStatusCount > 0) && (
        <div className="flex items-center justify-between mb-2 p-2 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600 space-y-1">
            {totalCollapsibleEvents > 0 && (
              <div>
                {collapsedCount === 0 ? 'All details expanded' : 
                 collapsedCount === totalCollapsibleEvents ? 'All details collapsed' : 
                 `${collapsedCount} of ${totalCollapsibleEvents} details collapsed`}
              </div>
            )}
            {hiddenStatusCount > 0 && (
              <div className="text-amber-600">
                {hiddenStatusCount} status update{hiddenStatusCount !== 1 ? 's' : ''} hidden
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {hiddenStatusCount > 0 && (
              <button
                onClick={() => setHiddenStatusEvents(new Set())}
                className="text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1 rounded-full transition-colors"
              >
                Show Hidden Status
              </button>
            )}
            {totalCollapsibleEvents > 0 && (
              <>
                <button
                  onClick={expandAll}
                  className="text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 px-3 py-1 rounded-full transition-colors"
                >
                  Expand All
                </button>
                <button
                  onClick={collapseAll}
                  className="text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-full transition-colors"
                >
                  Collapse All
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {events.map(renderEvent)}
    </div>
  );
};

export default FlowRun;