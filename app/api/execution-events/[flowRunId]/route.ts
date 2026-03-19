import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ flowRunId: string }> }
) {
  const params = await context.params;
  const { flowRunId } = params;

  // Create a ReadableStream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'connected',
        data: {
          flow_run_id: flowRunId,
          timestamp: new Date().toISOString(),
          message: 'Connected to execution events stream'
        }
      })}\n\n`));

      // Send mock events every 2 seconds
      const eventTypes = ['step_started', 'step_completed', 'step_failed', 'flow_completed'];
      let eventCount = 0;
      
      const intervalId = setInterval(() => {
        if (eventCount >= 5) {
          clearInterval(intervalId);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'flow_completed',
            data: {
              flow_run_id: flowRunId,
              timestamp: new Date().toISOString(),
              status: 'completed',
              duration_ms: 5000
            }
          })}\n\n`));
          controller.close();
          return;
        }

        const eventType = eventTypes[eventCount % eventTypes.length];
        const eventData = {
          type: eventType,
          data: {
            flow_run_id: flowRunId,
            step_run_id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            step_id: `step_${eventCount + 1}`,
            status: eventType === 'step_started' ? 'running' : 
                   eventType === 'step_completed' ? 'completed' : 'failed',
            response: eventType === 'step_completed' ? `Step ${eventCount + 1} completed successfully` : 
                     eventType === 'step_failed' ? `Step ${eventCount + 1} failed` : '',
            duration_ms: eventType === 'step_completed' ? 1000 + (eventCount * 500) : undefined,
            timestamp: new Date().toISOString()
          }
        };

        controller.enqueue(encoder.encode(`data: ${JSON.stringify(eventData)}\n\n`));
        eventCount++;
      }, 2000);

      // Clean up on client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(intervalId);
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}