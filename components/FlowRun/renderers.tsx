// Event renderers for FlowRun
import React from 'react';
import { ExecutionEvent } from './types';

interface RenderersProps {
  event: ExecutionEvent;
  collapsedEvents: Record<string, boolean>;
  setCollapsedEvents: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

export const renderEvent = ({ event, collapsedEvents, setCollapsedEvents }: RenderersProps) => {
  const isCollapsed = collapsedEvents[event.key] ?? (event.metadata?.collapsed ?? false);
  
  switch (event.type) {
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
        <div key={event.key} className="flex items-start gap-3 p-4 border border-blue-700 bg-gradient-to-r from-blue-900/20 to-blue-800/10 rounded-xl mb-3 shadow-sm transition-all duration-300 opacity-0 animate-fade-in">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-700 to-blue-800 flex items-center justify-center shadow-sm">
            <span className="text-blue-300 text-lg">📊</span>
          </div>
          <div className="flex-1">
            <div className="font-semibold text-blue-100 flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-blue-300 bg-blue-900/50 px-2 py-0.5 rounded-full">
                STEP STATUS
              </span>
            </div>
            <div className="space-y-2">
              <div className="text-blue-100 whitespace-pre-wrap font-medium">{event.content}</div>
              {event.metadata?.timestamp && (
                <div className="text-xs text-blue-400">
                  {new Date(event.metadata.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
              )}
            </div>
          </div>
        </div>
      );

    case 'STEP_PROMPT':
      return (
        <div key={event.key} className="flex items-start gap-3 p-4 border border-gray-700 bg-gray-800 rounded-xl mb-3 shadow-sm ml-auto max-w-3/4 transition-all duration-300 opacity-0 animate-fade-in">
          <div className="flex-1">
            <div className="font-semibold text-gray-100 flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCollapsedEvents(prev => ({ ...prev, [event.key]: !isCollapsed }))}
                  className="text-xs font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 px-2 py-0.5 rounded-full transition-colors"
                >
                  {isCollapsed ? 'Show' : 'Hide'}
                </button>
              </div>
              <span className="text-xs font-semibold text-gray-300 bg-gray-700 px-2 py-0.5 rounded-full">
                PROMPT
              </span>
            </div>
            {!isCollapsed && (
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
      return (
        <div key={event.key} className="flex items-start gap-3 p-4 border border-gray-700 bg-gray-800 rounded-xl mb-3 shadow-sm mr-auto max-w-3/4 transition-all duration-300 opacity-0 animate-fade-in">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center shadow-sm">
            <span className="text-gray-300 text-lg font-bold">✓</span>
          </div>
          <div className="flex-1">
            <div className="font-semibold text-gray-100 flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCollapsedEvents(prev => ({ ...prev, [event.key]: !isCollapsed }))}
                  className="text-xs font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 px-2 py-0.5 rounded-full transition-colors"
                >
                  {isCollapsed ? 'Show' : 'Hide'}
                </button>
              </div>
              <span className="text-xs font-semibold text-gray-300 bg-gray-700 px-2 py-0.5 rounded-full">
                RESPONSE
              </span>
            </div>
            {!isCollapsed && (
              <div className="bg-gray-900/30 rounded-lg p-3 border border-gray-700">
                <div 
                  data-test="flow-result"
                  className="text-gray-100 whitespace-pre-wrap font-mono text-sm leading-relaxed"
                >
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

    default:
      return (
        <div key={event.key} className="flex items-start gap-3 p-4 border border-gray-700 bg-gray-800 rounded-xl mb-3 shadow-sm transition-all duration-300 opacity-0 animate-fade-in">
          <div className="flex-1">
            <div className="font-semibold text-gray-100 flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-300 bg-gray-700 px-2 py-0.5 rounded-full">
                {event.type}
              </span>
            </div>
            <div className="text-gray-100 whitespace-pre-wrap">{event.content}</div>
          </div>
        </div>
      );
  }
};