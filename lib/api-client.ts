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
  
  getTasksByFlowId: (flowId: string) => 
    apiFetch(`/api/tasks?flowId=${flowId}`),
  
  getTask: (id: string) => 
    apiFetch(`/api/tasks/${id}`),
  
  createTask: (data: any) => 
    apiFetch('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  
  updateTask: (id: string, data: any) => 
    apiFetch(`/api/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  
  deleteTask: (id: string) => 
    apiFetch(`/api/tasks/${id}`, {
      method: 'DELETE'
    }),
  
  // Flow Definitions
  getFlowDefinitions: (limit?: number) => 
    apiFetch(`/api/flow-definitions${limit ? `?limit=${limit}` : ''}`),
  
  getFlowDefinition: (id: string) => 
    apiFetch(`/api/flow-definitions/${id}`),
  
  createFlowDefinition: (data: any) => 
    apiFetch('/api/flow-definitions', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  
  updateFlowDefinition: (id: string, data: any) => 
    apiFetch(`/api/flow-definitions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  
  deleteFlowDefinition: (id: string) => 
    apiFetch(`/api/flow-definitions/${id}`, {
      method: 'DELETE'
    }),
  
  getFlowSteps: (flowId: string) => 
    apiFetch(`/api/flow-definitions/${flowId}/steps`),
  
  // Flow Steps
  getFlowStepsList: (limit?: number) => 
    apiFetch(`/api/flow-steps${limit ? `?limit=${limit}` : ''}`),
  
  getFlowStep: (id: string) => 
    apiFetch(`/api/flow-steps/${id}`),
  
  // New endpoint for flow-specific steps
  getFlowSpecificSteps: (flowId: string) => 
    apiFetch(`/api/flows/${flowId}/steps`),
  
  createFlowStep: (data: any) => 
    apiFetch('/api/flow-steps', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  
  updateFlowStep: (id: string, data: any) => 
    apiFetch(`/api/flow-steps/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  
  deleteFlowStep: (id: string) => 
    apiFetch(`/api/flow-steps/${id}`, {
      method: 'DELETE'
    }),
  
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
  testRequest: (data: { method: string; url: string; requestBody: any; apiKey?: string }) => 
    apiFetch('/api/test-request', {
      method: 'POST',
      body: JSON.stringify(data)
    })
};