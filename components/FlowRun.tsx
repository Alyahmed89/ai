'use client';

import React from 'react';

export type ExecutionEvent = {
  key: string; // for dedupe + react key
  type: 'FLOW_RUNNING' | 'STEP_PROMPT' | 'STEP_RESPONSE' | 'FLOW_COMPLETED';
  content?: string;
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
        type: 'FLOW_RUNNING'
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
          status: step.status
        });
        
        // Add STEP_PROMPT event for step instructions
        if (step.instructions) {
          const promptContent = step.title 
            ? `Step ${index + 1}: ${step.title}\n\n${step.instructions}`
            : `Step ${index + 1}:\n\n${step.instructions}`;
          
          console.log(`mapConversationToEvents - Adding STEP_PROMPT for step ${index + 1}`);
          events.push({
            key: `STEP_PROMPT:${step.id || index}:${promptContent}`,
            type: 'STEP_PROMPT',
            content: promptContent
          });
        }

        // Add STEP_RESPONSE event for step response (if exists and not null)
        if (step.response && step.response.trim() !== '') {
          console.log(`mapConversationToEvents - Adding STEP_RESPONSE for step ${index + 1}`);
          const status = step.status || 'unknown';
          const responseContent = step.title 
            ? `Step ${index + 1}: ${step.title}\nStatus: ${status}\n\n${step.response}`
            : `Step ${index + 1}\nStatus: ${status}\n\n${step.response}`;
          
          events.push({
            key: `STEP_RESPONSE:${step.id || index}:${step.response.substring(0, 50)}`,
            type: 'STEP_RESPONSE',
            content: responseContent
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
        key: `STEP_RESPONSE:LAST:${conversation.last_step_response.substring(0, 50)}`,
        type: 'STEP_RESPONSE',
        content: conversation.last_step_response
      });
    } else if (conversation.flow_completed === true && conversation.flow_steps && conversation.flow_steps.length > 0) {
      // If flow is completed but no last_step_response, add a placeholder response
      console.log('mapConversationToEvents - Adding placeholder STEP_RESPONSE');
      events.push({
        key: 'STEP_RESPONSE_PLACEHOLDER',
        type: 'STEP_RESPONSE',
        content: 'Flow completed. Step responses are not available in the current data.'
      });
    }

    // Add FLOW_COMPLETED event if flow is completed
    if (conversation.flow_completed === true) {
      console.log('mapConversationToEvents - Adding FLOW_COMPLETED event');
      events.push({
        key: 'FLOW_COMPLETED',
        type: 'FLOW_COMPLETED'
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
  // Debug log to see what data we're receiving
  React.useEffect(() => {
    console.log('FlowRun component received data:', JSON.stringify(data, null, 2));
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
          status: step.status
        }))
      });
    }
  }, [data]);
  
  // Transform conversation data to events
  const events = React.useMemo(() => {
    const events = mapConversationToEvents(data);
    console.log('FlowRun - Generated events:', events.map(e => ({ type: e.type, key: e.key, contentLength: e.content?.length || 0 })));
    return events;
  }, [data]);

  // Render events as chat messages
  const renderEvent = (event: ExecutionEvent) => {
    switch (event.type) {
      case 'FLOW_RUNNING':
        return (
          <div key={event.key} className="flex items-start gap-3 p-4 border-b border-gray-200">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-blue-600 text-sm font-semibold">⏳</span>
            </div>
            <div className="flex-1">
              <div className="font-medium text-gray-900">Flow Status</div>
              <div className="mt-1 text-gray-700">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  RUNNING
                </span>
              </div>
            </div>
          </div>
        );

      case 'STEP_PROMPT':
        return (
          <div key={event.key} className="flex items-start gap-3 p-4 border-b border-gray-200">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
              <span className="text-purple-600 text-sm font-semibold">AI</span>
            </div>
            <div className="flex-1">
              <div className="font-medium text-gray-900">AI Prompt</div>
              <div className="mt-1 text-gray-700 whitespace-pre-wrap">{event.content}</div>
            </div>
          </div>
        );

      case 'STEP_RESPONSE':
        return (
          <div key={event.key} className="flex items-start gap-3 p-4 border-b border-gray-200">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-green-600 text-sm font-semibold">AI</span>
            </div>
            <div className="flex-1">
              <div className="font-medium text-gray-900">AI Response</div>
              <div className="mt-1 text-gray-700 whitespace-pre-wrap">{event.content}</div>
            </div>
          </div>
        );

      case 'FLOW_COMPLETED':
        return (
          <div key={event.key} className="flex items-start gap-3 p-4 border-b border-gray-200">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-green-600 text-sm font-semibold">✓</span>
            </div>
            <div className="flex-1">
              <div className="font-medium text-gray-900">Flow Status</div>
              <div className="mt-1 text-gray-700">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  COMPLETED
                </span>
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
      <div className="p-8 text-center text-gray-500">
        No flow events to display
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200">
      {events.map(renderEvent)}
    </div>
  );
};

export default FlowRun;