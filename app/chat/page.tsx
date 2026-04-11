'use client';

import { useState, useEffect, useRef } from 'react';
import HierarchicalNav from '@/components/HierarchicalNav';
import SimpleFlowCreator from '@/components/SimpleFlowCreator';
import EditFlowModal from '@/components/EditFlowModal';
import CreateProjectModal from '@/components/CreateProjectModal';
import FlowRun, { ConversationData, ChatMessage } from '@/components/FlowRun';
import IntelligentTextarea from '@/components/ui/IntelligentTextarea';
import { FlowRun as SharedFlowRun, CommandItem } from '@/types';

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
  const [conversationId, setConversationId] = useState<string | null>(null);
  // DO NOT store conversationData - FlowRun poller will handle it
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Fetch flow definitions
  useEffect(() => {
    const loadFlows = async () => {
      const res = await fetch('/api/flow-definitions');
      const data = await res.json();

      setFlowDefinitions(Array.isArray(data) ? data : []);
    };

    loadFlows();
  }, []);

  // Fetch flow runs
  useEffect(() => {
    const loadRuns = async () => {
      const res = await fetch('/api/flow-runs');
      const data = await res.json();

      setFlowRuns(Array.isArray(data) ? data : []);
    };

    loadRuns();
  }, []);

  // Fetch variables
  useEffect(() => {
    const fetchVariables = async () => {
      try {
        const response = await fetch('/api/proxy/api/variables');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        setVariables(data.variables || []);
      } catch (error) {
        console.error('Error fetching variables:', error);
      }
    };

    fetchVariables();
  }, []);

  // Handle sending a message
  const handleSendMessage = async (content: string) => {
    if (!selectedFlowId) return;
    
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: content,
      timestamp: new Date()
    };
    
    // Add user message to chat
    setChatMessages(prev => [...prev, userMessage]);
    setInputPrompt('');
    setIsRunning(true);
    
    try {
      const endpoint = selectedFlowRunId ? '/api/proxy/resume' : '/api/proxy/start';

      const body = selectedFlowRunId
        ? {
            conversation_id: conversationId,
            user_input: content
          }
        : {
            flow_id: selectedFlowId,
            input_prompt: content
          };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      setConversationId(data?.conversation_id || data?.data?.conversation_id || data?.id || null);
      setSelectedFlowRunId(data?.flow_run?.id || null);
      
      // Refresh flow runs list to show the new run
      const runsResponse = await fetch('/api/flow-runs');
      if (runsResponse.ok) {
        const runsData = await runsResponse.json();
        setFlowRuns(Array.isArray(runsData) ? runsData : []);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
      
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        type: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsRunning(false);
    }
  };

  // Handle flow run selection
  const handleFlowRunSelect = async (flowRunId: string) => {
    setSelectedFlowRunId(flowRunId);
    setConversationId(null);
    setChatMessages([]);

    try {
      // Fetch flow run details to get conversation_id
      const flowRunResponse = await fetch(`/api/proxy/api/flow-runs/${flowRunId}`);
      if (!flowRunResponse.ok) {
        console.error('Failed to fetch flow run details');
        return;
      }

      const flowRunData = await flowRunResponse.json();
      const flowRun = flowRunData.flow_run;
      const conversationId = flowRun.conversation_id;
      
      if (conversationId) {
        setConversationId(conversationId);
      }
    } catch (error) {
      console.error('Error fetching flow run:', error);
    }
  };

  // Format time helper
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Get status color helper
  const getStatusColor = (status: string): string => {
    switch (status?.toLowerCase()) {
      case 'completed': return 'bg-green-500/20 text-green-400';
      case 'running': return 'bg-blue-500/20 text-blue-400';
      case 'failed': return 'bg-red-500/20 text-red-400';
      case 'pending': return 'bg-yellow-500/20 text-yellow-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      {/* Left sidebar */}
      <div className="w-64 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold">Flows</h2>
          <button
            onClick={() => setShowCreateFlowModal(true)}
            className="mt-2 w-full bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 px-3 rounded-lg text-sm transition-colors"
          >
            + Create Flow
          </button>
        </div>
        
        <HierarchicalNav
          flowRuns={flowRuns}
          flowDefinitions={flowDefinitions}
          selectedFlowRunId={selectedFlowRunId}
          onFlowRunSelect={handleFlowRunSelect}
          onFlowSelect={(flowId) => setSelectedFlowId(flowId)}
          onEditFlow={(flowId) => {
            setEditingFlowId(flowId);
            setShowEditFlowModal(true);
          }}
          onCreateProject={() => setShowCreateProjectModal(true)}
        />
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Chat</h1>
            {selectedFlowId && (
              <p className="text-sm text-gray-400 mt-1">
                Selected flow: {selectedFlowId}
              </p>
            )}
          </div>
          {selectedFlowRunId && (
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedFlowRun?.status || '')}`}>
              {selectedFlowRun?.status || 'unknown'}
            </div>
          )}
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-6 space-y-4"
          >
            <FlowRun 
              key={conversationId || selectedFlowRunId || 'default'}
              data={null} // FlowRun will initialize from poller
              chatMessages={chatMessages}
              conversationId={conversationId}
              flowRunId={selectedFlowRunId}
              onSendMessage={handleSendMessage}
              isRunning={isRunning}
              selectedFlowId={selectedFlowId}
            />
          </div>

          {/* Chat input */}
          <div className="p-4">
            <form onSubmit={(e) => { 
              e.preventDefault(); 
              e.stopPropagation();
              handleSendMessage(inputPrompt); 
              return false;
            }} className="space-y-3">
              <div className="relative">
                <IntelligentTextarea
                  value={inputPrompt}
                  onChange={setInputPrompt}
                  placeholder={selectedFlowId ? "Type / for commands or # for variables..." : "Select a flow first to send messages"}
                  className="w-full bg-gray-800 text-gray-200 rounded-lg px-4 py-3 resize-none min-h-[60px] max-h-[200px] focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                  variables={variables}
                  commands={[]}
                />
                <button
                  type="submit"
                  disabled={!inputPrompt.trim() || !selectedFlowId || isRunning}
                  className="absolute right-2 bottom-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
                >
                  {isRunning ? 'Sending...' : 'Send'}
                </button>
              </div>
              {error && (
                <div className="text-red-400 text-sm">
                  {error}
                </div>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showCreateFlowModal && (
        <SimpleFlowCreator
          onClose={() => setShowCreateFlowModal(false)}
          onFlowCreated={() => {
            setShowCreateFlowModal(false);
            // Refresh flow definitions
            fetch('/api/proxy/api/flows').then(res => res.json()).then(data => {
              setFlowDefinitions(data.flows || []);
            });
          }}
        />
      )}

      {showEditFlowModal && editingFlowId && (
        <EditFlowModal
          flowId={editingFlowId}
          onClose={() => {
            setShowEditFlowModal(false);
            setEditingFlowId(null);
          }}
          onFlowUpdated={() => {
            setShowEditFlowModal(false);
            setEditingFlowId(null);
            // Refresh flow definitions
            fetch('/api/proxy/api/flows').then(res => res.json()).then(data => {
              setFlowDefinitions(data.flows || []);
            });
          }}
        />
      )}

      {showCreateProjectModal && (
        <CreateProjectModal
          onClose={() => setShowCreateProjectModal(false)}
          onProjectCreated={() => {
            setShowCreateProjectModal(false);
            // Refresh flow definitions
            fetch('/api/proxy/api/flows').then(res => res.json()).then(data => {
              setFlowDefinitions(data.flows || []);
            });
          }}
        />
      )}
    </div>
  );
}