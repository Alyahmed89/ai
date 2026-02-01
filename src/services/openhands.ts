// OpenHands API service - pure, stateless wrapper
import { OPENHANDS_TIMEOUT } from '../constants';
import { OpenHandsCreateResult, OpenHandsStatusResult, OpenHandsInjectResult } from '../types';

/**
 * Create a new OpenHands conversation
 * @param apiUrl OpenHands API base URL
 * @param initialMessage Initial message to seed the conversation
 * @param repository Repository to work on
 * @param branch Optional branch
 * @returns OpenHandsCreateResult with conversation ID or error
 */
export async function createOpenHandsConversation(
  apiUrl: string,
  initialMessage: string,
  repository: string,
  branch?: string
): Promise<OpenHandsCreateResult> {
  try {
    const createUrl = apiUrl.endsWith('/') 
      ? `${apiUrl}conversations`
      : `${apiUrl}/conversations`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OPENHANDS_TIMEOUT);

    const body: any = {
      initial_user_msg: initialMessage,
      repository: repository
    };

    if (branch) {
      body.selected_branch = branch;
    }

    const response = await fetch(createUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenHands create error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as any;
    const conversationId = data.conversation_id;

    return {
      success: true,
      conversationId
    };

  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown OpenHands create error'
    };
  }
}

/**
 * Get OpenHands conversation status and events
 * @param apiUrl OpenHands API base URL
 * @param conversationId Conversation ID to check
 * @returns OpenHandsStatusResult with events or error
 */
export async function getOpenHandsConversation(
  apiUrl: string,
  conversationId: string
): Promise<OpenHandsStatusResult> {
  try {
    // Get conversation status with retry logic
    const statusUrl = apiUrl.endsWith('/') 
      ? `${apiUrl}conversations/${conversationId}`
      : `${apiUrl}/conversations/${conversationId}`;

    // Add retry logic for status endpoint (same as events endpoint)
    let statusRetryCount = 0;
    const maxStatusRetries = 2;
    let statusResponse: Response;
    
    while (statusRetryCount <= maxStatusRetries) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), OPENHANDS_TIMEOUT);

        statusResponse = await fetch(statusUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!statusResponse.ok) {
          // If 500/502 error and we have retries left, retry
          if ((statusResponse.status === 500 || statusResponse.status === 502) && statusRetryCount < maxStatusRetries) {
            statusRetryCount++;
            console.log(`OpenHands status ${statusResponse.status} error, retry ${statusRetryCount}/${maxStatusRetries}`);
            await new Promise(resolve => setTimeout(resolve, 1000 * statusRetryCount)); // Exponential backoff
            continue;
          }
          
          const errorText = await statusResponse.text();
          throw new Error(`OpenHands status error: ${statusResponse.status} - ${errorText}`);
        }
        
        // Success, break out of retry loop
        break;
      } catch (error) {
        if (statusRetryCount >= maxStatusRetries) {
          throw error;
        }
        statusRetryCount++;
        console.log(`OpenHands status fetch error, retry ${statusRetryCount}/${maxStatusRetries}: ${error}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * statusRetryCount));
      }
    }

    const statusData = await statusResponse!.json() as any;
    
    // Get recent agent events for better context
    // Use /events?limit=3&reverse=true to get last 3 events
    let agentEvents: any[] = [];
    let retryCount = 0;
    const maxRetries = 2;
    
    while (retryCount <= maxRetries) {
      try {
        const eventsUrl = apiUrl.endsWith('/') 
          ? `${apiUrl}conversations/${conversationId}/events?limit=3&reverse=true`
          : `${apiUrl}/conversations/${conversationId}/events?limit=3&reverse=true`;

        const eventsController = new AbortController();
        const eventsTimeoutId = setTimeout(() => eventsController.abort(), OPENHANDS_TIMEOUT);

        const eventsResponse = await fetch(eventsUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: eventsController.signal
        });

        clearTimeout(eventsTimeoutId);

        if (!eventsResponse.ok) {
          // If 500 error and we have retries left, retry
          if (eventsResponse.status === 500 && retryCount < maxRetries) {
            retryCount++;
            console.log(`OpenHands events 500 error, retry ${retryCount}/${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
            continue;
          }
          
          const errorText = await eventsResponse.text();
          throw new Error(`OpenHands events error: ${eventsResponse.status} - ${errorText}`);
        }

        const eventsData = await eventsResponse.json() as any;
        
        // Process all agent events for better context
        if (eventsData.events && eventsData.events.length > 0) {
          for (const event of eventsData.events) {
            if (event.source === 'agent') {
              // Case 1: Direct message action
              if (event.action === 'message') {
                agentEvents.push(event);
              }
              // Case 2: Check for nested content in tool_call_metadata
              else if (event.tool_call_metadata?.model_response?.choices?.[0]?.message?.content) {
                // Create a synthetic message event from the nested content
                const nestedContent = event.tool_call_metadata.model_response.choices[0].message.content;
                agentEvents.push({
                  ...event,
                  action: 'message',
                  args: {
                    content: nestedContent,
                    wait_for_response: false,
                    file_urls: null,
                    image_urls: []
                  },
                  message: nestedContent
                });
              }
              // Case 3: Tool calls without nested content (simplify)
              else if (event.action === 'tool_call') {
                // Create a simplified message for tool calls
                const toolName = event.tool_call_metadata?.tool_name || 'unknown_tool';
                agentEvents.push({
                  ...event,
                  action: 'message',
                  args: {
                    content: `[Tool call: ${toolName}]`,
                    wait_for_response: false,
                    file_urls: null,
                    image_urls: []
                  },
                  message: `[Tool call: ${toolName}]`
                });
              }
            }
          }
        }
        
        break; // Success, exit retry loop
        
      } catch (error: any) {
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`OpenHands events fetch error: ${error.message}, retry ${retryCount}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          continue;
        }
        throw error; // Re-throw after max retries
      }
    }

    // Return all agent events for better context (reverse to chronological order)
    const events = agentEvents.reverse();

    return {
      success: true,
      agent_state: statusData.runtime_status, // Use runtime_status instead of agent_state
      events
    };

  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown OpenHands status error'
    };
  }
}

/**
 * Inject a message into an OpenHands conversation
 * @param apiUrl OpenHands API base URL
 * @param conversationId Conversation ID
 * @param message Message to inject
 * @returns OpenHandsInjectResult with success or error
 */
export async function injectMessageToOpenHands(
  apiUrl: string,
  conversationId: string,
  message: string
): Promise<OpenHandsInjectResult> {
  try {
    const injectUrl = apiUrl.endsWith('/') 
      ? `${apiUrl}conversations/${conversationId}/events`
      : `${apiUrl}/conversations/${conversationId}/events`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OPENHANDS_TIMEOUT);

    const response = await fetch(injectUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'user',
        action: 'message',
        message: message,
        args: {
          content: message,
          wait_for_response: false,
          file_urls: null,
          image_urls: []
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenHands inject error: ${response.status} - ${errorText}`);
    }

    return {
      success: true
    };

  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown OpenHands inject error'
    };
  }
}