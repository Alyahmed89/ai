import { NextRequest } from 'next/server';
import { proxyToWorker } from '@/lib/api-proxy';

export const runtime = 'edge';

/**
 * DEPRECATED: This endpoint is now a proxy to Cloudflare Worker backend.
 * All business logic has been moved to: https://deepseek-agent.alghamdimo89.workers.dev
 * 
 * This proxy maintains backward compatibility during migration.
 */
export async function POST(request: NextRequest) {
  return proxyToWorker('/api/test-request', request);
}