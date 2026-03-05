import { NextRequest } from 'next/server';
import { proxyToWorker } from '@/lib/api-proxy';

export const runtime = 'edge';

/**
 * DEPRECATED: This endpoint is now a proxy to Cloudflare Worker backend.
 * All business logic has been moved to: https://deepseek-agent.alghamdimo89.workers.dev
 * 
 * This proxy maintains backward compatibility during migration.
 */

// GET all items
export async function GET(request: NextRequest) {
  return proxyToWorker('/api/d1/items', request);
}

// POST create new item
export async function POST(request: NextRequest) {
  return proxyToWorker('/api/d1/items', request);
}

// PUT update item
export async function PUT(request: NextRequest) {
  return proxyToWorker('/api/d1/items', request);
}

// DELETE item
export async function DELETE(request: NextRequest) {
  return proxyToWorker('/api/d1/items', request);
}