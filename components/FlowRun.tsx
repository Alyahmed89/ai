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
import { FlowRunPoller } from './FlowRun/polling';
import { renderEvent } from './FlowRun/renderers';

// Re-export types for backward compatibility
export type { ExecutionEvent, ConversationData };

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
  
  // Internal state for data
  const [internalData, setInternalData] = useState<ConversationData | null>(data);
  const [internalChatMessages, setInternalChatMessages] = useState<ChatMessage[]>(chatMessages);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollerRef = useRef<FlowRunPoller | null>(null);
  
  // Update internal state when props change
  useEffect(() => {
    setInternalData(data);
  }, [data]);
  
  useEffect(() => {
    setInternalChatMessages(chatMessages);
  }, [chatMessages]);
  
  // Transform all data to events
  const events = React.useMemo(() => {
    const events = mapAllToEvents(internalData, internalChatMessages);
    return events;
  }, [internalData, internalChatMessages]);

  // Polling effect
  useEffect(() => {
    if (!conversationId) return;
    
    console.log('=== FLOWRUN: Starting polling for conversation:', conversationId);
    
    const poller = new FlowRunPoller({
      onConversationUpdate: (conversation) => {
        console.log('=== FLOWRUN: Conversation update received:', conversation);
        setInternalData({
          ...conversation,
          _updatedAt: Date.now()
        });
      },
      onChatMessage: (message) => {
        console.log('=== FLOWRUN: Chat message received:', message);
        setInternalChatMessages(prev => [...prev, message]);
      },
      onPollingComplete: () => {
        console.log('=== FLOWRUN: Polling completed');
        if (pollerRef.current) {
          pollerRef.current.stopPolling();
        }
      },
      onPollingError: (error) => {
        console.error('=== FLOWRUN: Polling error:', error);
      }
    });
    
    pollerRef.current = poller;
    poller.startPolling(conversationId);
    
    return () => {
      if (pollerRef.current) {
        pollerRef.current.stopPolling();
        pollerRef.current = null;
      }
    };
  }, [conversationId]);

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