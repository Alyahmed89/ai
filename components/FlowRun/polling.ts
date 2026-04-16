// Polling logic - moved from chat page
import { ChatMessage, ConversationData } from './types';

export interface PollingCallbacks {
  onConversationUpdate: (conversation: ConversationData) => void;
  onChatMessage: (message: ChatMessage) => void;
  onPollingComplete: () => void;
  onPollingError: (error: Error) => void;
}

export class FlowRunPoller {
  private pollingInterval: NodeJS.Timeout | null = null;
  private pollCount = 0;
  private maxPolls = 30;
  private pollInterval = 2000;
  private callbacks: PollingCallbacks;

  constructor(callbacks: PollingCallbacks) {
    this.callbacks = callbacks;
  }

  async startPolling(conversationId: string) {
    console.log('=== FLOWRUN POLLING STARTED ===');
    this.pollCount = 0;
    
    // Start polling immediately
    await this.pollForCompletion(conversationId);
    
    // Set up interval
    this.pollingInterval = setInterval(async () => {
      const completed = await this.pollForCompletion(conversationId);
      if (completed) {
        this.stopPolling();
      }
    }, this.pollInterval);
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('Polling stopped');
    }
  }

  private async pollForCompletion(conversationId: string): Promise<boolean> {
    try {
      this.pollCount++;
      console.log(`Poll #${this.pollCount} for ${conversationId}`);

      // Add polling status message
      this.callbacks.onChatMessage({
        id: `poll-${Date.now()}`,
        type: 'assistant',
        content: `🔍 Poll #${this.pollCount}: Checking status...\n**Status:** running`,
        timestamp: new Date()
      });

      // Fetch conversation status
      const flowRunId = conversationId;
      console.log("FLOW RUN ID USED:", flowRunId);
      const response = await fetch(`/api/proxy/api/step-runs?flow_run_id=${flowRunId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && data.data?.conversation) {
        const conversation = data.data.conversation;
        
        // Update conversation data
        this.callbacks.onConversationUpdate({
          ...conversation,
          _updatedAt: Date.now()
        });

        // Check if flow is completed
        if (conversation.flow_completed === true) {
          console.log('Flow completed detected in polling');
          this.callbacks.onPollingComplete();
          return true;
        }
      }

      // Check max polls
      if (this.pollCount >= this.maxPolls) {
        console.log(`Max polls reached (${this.maxPolls})`);
        this.callbacks.onChatMessage({
          id: `poll-max-${Date.now()}`,
          type: 'assistant',
          content: `**Status:** timeout\nMaximum polling attempts reached. Flow may still be running.`,
          timestamp: new Date()
        });
        this.callbacks.onPollingComplete();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Polling error:', error);
      this.callbacks.onPollingError(error as Error);
      return false;
    }
  }

  async pollForFlowRunByConversationId(
    conversationId: string, 
    maxAttempts = 20, 
    interval = 1000
  ): Promise<string | null> {
    console.log(`Starting to poll for flow run with conversation_id: ${conversationId}`);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`Polling attempt ${attempt}/${maxAttempts} for flow run with conversation_id: ${conversationId}`);
        
        const flowRunId = conversationId;
        console.log("FLOW RUN ID USED (flow-runs):", flowRunId);
        const response = await fetch(`/api/proxy/api/step-runs?flow_run_id=${flowRunId}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const flowRuns = data || [];
        
        if (flowRuns.length > 0) {
          const flowRun = flowRuns[0];
          console.log(`Found flow run: ${flowRun.id} with status: ${flowRun.status}`);
          return flowRun.id;
        }
        
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, interval));
        }
      } catch (error) {
        console.error(`Error polling for flow run (attempt ${attempt}):`, error);
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, interval));
        }
      }
    }
    
    console.log(`No flow run found after ${maxAttempts} attempts`);
    return null;
  }
}