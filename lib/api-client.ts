/**
 * API Client for Cloudflare Worker backend
 * 
 * This client replaces all direct calls to Next.js API routes
 * with calls to the Cloudflare Worker backend.
 */

const API_BASE = "https://deepseek-agent.alghamdimo89.workers.dev";

export async function apiFetch(path: string, options: RequestInit = {}) {
  const url = `${API_BASE}${path}`;
  
  console.log(`API Call: ${options.method || 'GET'} ${url}`);
  
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  
  // Log response for debugging
  console.log(`API Response: ${response.status} ${response.statusText}`);
  
  return response;
}

// Helper functions for common API operations
export const apiClient = {
  // Tasks
  getTasks: (limit?: number) => 
    apiFetch(`/api/tasks${limit ? `?limit=${limit}` : ''}`),
  
  getTask: (id: string) => 
    apiFetch(`/api/tasks/${id}`),
  
  // Flow Definitions
  getFlowDefinitions: (limit?: number) => 
    apiFetch(`/api/flow-definitions${limit ? `?limit=${limit}` : ''}`),
  
  getFlowDefinition: (id: string) => 
    apiFetch(`/api/flow-definitions/${id}`),
  
  getFlowSteps: (flowId: string) => 
    apiFetch(`/api/flow-definitions/${flowId}/steps`),
  
  // Flow Steps
  getFlowStepsList: (limit?: number) => 
    apiFetch(`/api/flow-steps${limit ? `?limit=${limit}` : ''}`),
  
  getFlowStep: (id: string) => 
    apiFetch(`/api/flow-steps/${id}`),
  
  getStepConditions: (stepId: string) => 
    apiFetch(`/api/flow-steps/${stepId}/conditions`),
  
  getStepInput: (stepId: string) => 
    apiFetch(`/api/flow-steps/${stepId}/input`),
  
  // D1 Items
  getD1Items: () => 
    apiFetch('/api/d1/items'),
  
  createD1Item: (data: { name: string; description: string }) => 
    apiFetch('/api/d1/items', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  
  initializeDatabase: () => 
    apiFetch('/api/d1/init'),
  
  // Test Request Proxy
  testRequest: (data: { url: string; requestBody: any; apiKey?: string }) => 
    apiFetch('/api/test-request', {
      method: 'POST',
      body: JSON.stringify(data)
    })
};