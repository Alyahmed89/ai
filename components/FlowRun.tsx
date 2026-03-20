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
  }>;
  last_step_response?: string;
};

interface FlowRunProps {
  data: ConversationData | null;
}

export const mapConversationToEvents = (conversation: ConversationData | null): ExecutionEvent[] => {
  if (!conversation) {
    return [];
  }

  const events: ExecutionEvent[] = [];

  // Add FLOW_RUNNING event if state is "running" (only once)
  if (conversation.state === 'running') {
    events.push({
      key: 'FLOW_RUNNING',
      type: 'FLOW_RUNNING'
    });
  }

  // Add STEP_PROMPT events for each flow step with instructions
  if (conversation.flow_steps && Array.isArray(conversation.flow_steps)) {
    conversation.flow_steps.forEach((step, index) => {
      if (step.instructions) {
        const content = step.title 
          ? `Step ${index + 1}: ${step.title}\n\n${step.instructions}`
          : `Step ${index + 1}:\n\n${step.instructions}`;
        
        events.push({
          key: `STEP_PROMPT:${content}`,
          type: 'STEP_PROMPT',
          content
        });
      }
    });
  }

  // Add STEP_RESPONSE event if last_step_response exists
  if (conversation.last_step_response) {
    events.push({
      key: `STEP_RESPONSE:${conversation.last_step_response}`,
      type: 'STEP_RESPONSE',
      content: conversation.last_step_response
    });
  }

  // Add FLOW_COMPLETED event if flow is completed
  if (conversation.flow_completed === true) {
    events.push({
      key: 'FLOW_COMPLETED',
      type: 'FLOW_COMPLETED'
    });
  }

  return events;
};

const FlowRun: React.FC<FlowRunProps> = ({ data }) => {
  // Transform conversation data to events
  const events = React.useMemo(() => {
    return mapConversationToEvents(data);
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