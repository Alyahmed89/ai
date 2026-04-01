/**
 * Local API Client for Next.js backend
 * 
 * This client uses local API endpoints for development.
 */

const API_BASE = '';

export async function localApiFetch(path: string, options: RequestInit = {}) {
  const url = `/api${path}`;
  
  console.log(`Local API Call: ${options.method || 'GET'} ${url}`);
  
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  
  // Log response for debugging
  console.log(`Local API Response: ${response.status} ${response.statusText}`);
  
  return response;
}

// Helper functions for common API operations
export const localApiClient = {
  // Projects
  getProjects: (limit?: number) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return localApiFetch(`/graph/projects${query}`);
  },

  getProject: (id: string) =>
    localApiFetch(`/graph/projects/${id}`),

  // Flows
  getFlows: (limit?: number) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return localApiFetch(`/graph/flows${query}`);
  },

  getFlowsByProjectId: (projectId: string) => {
    // Note: Currently flows don't have project_id, so we return all flows
    return localApiFetch(`/graph/flows`);
  },

  // Nodes (for backward compatibility)
  getNodes: (limit?: number, projectId?: string) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (projectId) params.append('project_id', projectId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return localApiFetch(`/graph/nodes${query}`);
  },

  getNodesByProjectId: (projectId: string) => {
    return localApiFetch(`/graph/nodes?project_id=${projectId}`);
  },

  // Flow Runs
  getFlowRuns: (limit?: number) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return localApiFetch(`/graph/flow-runs${query}`);
  },

  // Step Runs
  getStepRuns: (limit?: number) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return localApiFetch(`/graph/step-runs${query}`);
  }
};