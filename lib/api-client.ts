/**
 * API Client for local backend
 * 
 * This client uses local Next.js API routes for development.
 */

const API_BASE = typeof window !== 'undefined' ? '' : 'http://localhost:42452';

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
    }),
  
  // Flow Runs
  getFlowRuns: (limit?: number, flowId?: string) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (flowId) params.append('flowId', flowId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiFetch(`/api/flow-runs${query}`);
  },
  
  getFlowRun: (id: string) => 
    apiFetch(`/api/flow-runs/${id}`),
  
  createFlowRun: (data: any) => 
    apiFetch('/api/flow-runs', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  
  updateFlowRun: (id: string, data: any) => 
    apiFetch(`/api/flow-runs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  
  deleteFlowRun: (id: string) => 
    apiFetch(`/api/flow-runs/${id}`, {
      method: 'DELETE'
    }),
  
  getFlowRunIterations: (flowRunId: string) => 
    apiFetch(`/api/flow-runs/${flowRunId}/iterations`),
  
  // New endpoints from user requirements
  startFlow: () =>
    apiFetch('/start', {
      method: 'GET'
    }),
  
  getConversationStatus: (conversationId: string) =>
    apiFetch(`/status/${conversationId}`),
  
  // Flow endpoints (different from flow-definitions)
  getFlows: (limit?: number) =>
    apiFetch(`/api/flows${limit ? `?limit=${limit}` : ''}`),
  
  getFlow: (id: string) =>
    apiFetch(`/api/flows/${id}`),
  
  // Note: getFlowSteps already exists for flow-definitions
  // This is for the new /api/flows/{id}/steps endpoint
  getFlowStepsByFlowId: (flowId: string) =>
    apiFetch(`/api/flows/${flowId}/steps`),
  
  // Flow steps list - alias for getFlowStepsList
  getAllFlowSteps: (limit?: number) =>
    apiFetch(`/api/flow-steps${limit ? `?limit=${limit}` : ''}`),
  
  // Stop flow endpoints
  stopFlow: (conversationId: string) => {
    // Note: This would need to be implemented differently for Durable Object
    // For now, we'll provide a placeholder
    console.warn('Stopping flow via Durable Object requires direct Durable Object fetch');
    return apiFetch(`/api/stop/${conversationId}`, {
      method: 'POST'
    });
  },
  
  updateFlowRunStatus: (flowRunId: string, data: { status: string; completed_at?: number }) =>
    apiFetch(`/api/flow-runs/${flowRunId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  
  deleteFlowRunRecord: (flowRunId: string) =>
    apiFetch(`/api/flow-runs/${flowRunId}`, {
      method: 'DELETE'
    }),
  
  createFlowRunManual: (data: any) =>
    apiFetch('/api/flow-runs', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // Project Management
  getProjects: (limit?: number) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiFetch(`/api/graph/projects${query}`);
  },

  getProject: (id: string) =>
    apiFetch(`/api/graph/projects/${id}`),

  createProject: (data: { name: string; status: string; metadata: string }) =>
    apiFetch('/api/graph/projects', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updateProject: (id: string, data: { status?: string; metadata?: string }) =>
    apiFetch(`/api/graph/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),

  deleteProject: (id: string) =>
    apiFetch(`/api/graph/projects/${id}`, {
      method: 'DELETE'
    }),

  // Node Management
  getNodes: (limit?: number, projectId?: string) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (projectId) params.append('project_id', projectId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiFetch(`/api/graph/nodes${query}`);
  },

  getNode: (id: string) =>
    apiFetch(`/api/graph/nodes/${id}`),

  createNode: (data: {
    project_id: string;
    type: string;
    title: string;
    content: string;
    status: string;
    metadata: string;
  }) =>
    apiFetch('/api/graph/nodes', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updateNode: (id: string, data: {
    type?: string;
    title?: string;
    content?: string;
    status?: string;
    metadata?: string;
  }) =>
    apiFetch(`/api/graph/nodes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),

  deleteNode: (id: string) =>
    apiFetch(`/api/graph/nodes/${id}`, {
      method: 'DELETE'
    }),

  // Node Hierarchy Management
  getNodeChildren: (id: string) =>
    apiFetch(`/api/graph/nodes/${id}/children`),

  getNodeParent: (id: string) =>
    apiFetch(`/api/graph/nodes/${id}/parent`),

  addNodeChild: (id: string, childId: string) =>
    apiFetch(`/api/graph/nodes/${id}/children`, {
      method: 'POST',
      body: JSON.stringify({ child_id: childId })
    }),

  removeNodeChild: (id: string, childId: string) =>
    apiFetch(`/api/graph/nodes/${id}/children/${childId}`, {
      method: 'DELETE'
    }),

  // Project Hierarchy
  getProjectRootNodes: (projectId: string) =>
    apiFetch(`/api/graph/projects/${projectId}/root-nodes`),

  getNodeBreadcrumbs: (id: string) =>
    apiFetch(`/api/graph/nodes/${id}/breadcrumbs`)
};