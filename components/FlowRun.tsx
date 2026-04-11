'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ChatMessage,
  ExecutionEvent,
  ConversationData,
  FlowRunProps
} from './FlowRun/types';
import {
  mapAllToEvents
} from './FlowRun/parsing';
import { FlowRunPoller } from './poller';
import { renderEvent } from './FlowRun/renderers';

// Re-export types for backward compatibility
export type { ExecutionEvent, ConversationData, ChatMessage };

const FlowRun: React.FC<FlowRunProps> = ({ 
  data,
  chatMessages = [],
  conversationId,
  flowRunId,
  onSendMessage,
  isRunning = false,
  selectedFlowId
}) => {
  // TEST SIGNAL: Set global flag when FlowRun renders
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__FLOW_RENDERED__ = true;
      console.log('TEST SIGNAL: window.__FLOW_RENDERED__ = true');
    }
  }, []);
  
  // State to track which events are collapsed
  const [collapsedEvents, setCollapsedEvents] = React.useState<Record<string, boolean>>({});
  // State to track which STATUS_UPDATE events should be hidden (flashed away)
  const [hiddenStatusEvents, setHiddenStatusEvents] = React.useState<Set<string>>(new Set());
  // State to track which events are currently showing (for animation)
  const [showingEvents, setShowingEvents] = React.useState<Set<string>>(new Set());
  
  // Internal state for data - ONLY internalData drives UI
  const [internalData, setInternalData] = useState<ConversationData | null>(null);
  const [internalChatMessages, setInternalChatMessages] = useState<ChatMessage[]>(chatMessages);
  const pollerRef = useRef(new FlowRunPoller());
  
  // Initialize with prop data once (only on mount)
  useEffect(() => {
    if (data) {
      setInternalData(data);
    }
  }, []); // Only on mount
  
  useEffect(() => {
    setInternalChatMessages(chatMessages);
  }, [chatMessages]);
  
  // Transform all data to events
  const events = React.useMemo(() => {
    const events = mapAllToEvents(internalData, internalChatMessages);
    return events;
  }, [internalData, internalChatMessages]);

  // Poller effect - updates internalData only
  useEffect(() => {
    if (!conversationId) return;
    
    console.log('=== FLOWRUN: Starting polling for conversation:', conversationId);
    
    pollerRef.current.start(conversationId, (polledData) => {
      console.log('=== FLOWRUN: Polled data received:', polledData);
      setInternalData(polledData);
    });
    
    return () => {
      pollerRef.current.stop();
    };
  }, [conversationId]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pollerRef.current.stop();
    };
  }, []);

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

  // Empty state
  if (events.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-sm max-w-md">
            {selectedFlowId 
              ? `Type a prompt below to begin. Your message will create a task for the "${selectedFlowId}" flow and start execution.`
              : 'Select a flow first.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map(event => {
        // Skip hidden STATUS_UPDATE events
        if (event.type === 'STATUS_UPDATE' && hiddenStatusEvents.has(event.key)) {
          return null;
        }
        
        // Skip if not showing yet
        if (!showingEvents.has(event.key)) {
          return null;
        }
        
        return renderEvent({ 
          event, 
          collapsedEvents, 
          setCollapsedEvents 
        });
      })}
    </div>
  );
};

export default FlowRun;