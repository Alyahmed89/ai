import { NextRequest } from 'next/server';
import { proxyToWorker } from '@/lib/api-proxy';

export const runtime = 'edge';

/**
 * DEPRECATED: This endpoint is now a proxy to Cloudflare Worker backend.
 * All business logic has been moved to: https://deepseek-agent.alghamdimo89.workers.dev
 * 
 * This proxy maintains backward compatibility during migration.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyToWorker('/api/flow-steps/:id/conditions', request, { params: { id } });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyToWorker('/api/flow-steps/:id/conditions', request, { params: { id } });
}
