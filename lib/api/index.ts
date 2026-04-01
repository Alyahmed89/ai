// Consolidated API Client for AI Documentation System
// Combines functionality from local-api-client.ts and api-client.ts

import { ApiResponse, PaginatedResponse, FlowDefinition, FlowStep, FlowRun, Variable } from '@/types';

const USE_PROXY = true;

/**
 * Base fetch function with error handling and logging
 */
async function apiFetch<T = any>(
  endpoint: string, 
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    // Remove leading slash if present
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    
    // Use proxy API to reduce bundle size
    const url = USE_PROXY 
      ? `/api/proxy/${cleanEndpoint}`
      : `${process.env.BACKEND_URL || 'https://deepseek-agent.alghamdimo89.workers.dev'}${endpoint}`;
    
    console.log(`API Call: ${options?.method || 'GET'} ${url}`);
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    console.log(`API Response: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error ${response.status}: ${errorText}`);
      return { error: `Request failed: ${response.status} ${response.statusText}` };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    console.error('API fetch error:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error occurred' };
  }
}

/**
 * Local API fetch for Next.js backend endpoints
 */
async function localApiFetch<T = any>(
  path: string, 
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const url = `/api${path}`;
    console.log(`Local API Call: ${options.method || 'GET'} ${url}`);
    
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
    
    console.log(`Local API Response: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Local API Error ${response.status}: ${errorText}`);
      return { error: `Request failed: ${response.status} ${response.statusText}` };
    }
    
    const data = await response.json();
    return { data };
  } catch (error) {
    console.error('Local API fetch error:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error occurred' };
  }
}

// Helper to build query parameters
function buildQueryParams(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, value.toString());
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

// ==================== Projects API ====================
export const projectsApi = {
  getProjects: (limit?: number) => 
    localApiFetch(`/graph/projects${buildQueryParams({ limit })}`),
  
  getProject: (id: string) => 
    localApiFetch(`/graph/projects/${id}`),
};

// ==================== Flows API ====================
export const flowsApi = {
  getFlows: (limit?: number) => 
    localApiFetch(`/graph/flows${buildQueryParams({ limit })}`),
  
  getFlowsByProjectId: (projectId: string) => 
    localApiFetch(`/graph/flows`), // Note: Currently flows don't have project_id
  
  getFlowDefinitions: () => 
    apiFetch<FlowDefinition[]>('/api/flow-definitions'),
  
  createFlowDefinition: (data: Partial<FlowDefinition>) => 
    apiFetch<FlowDefinition>('/api/flow-definitions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  getFlowDefinition: (id: string) => 
    apiFetch<FlowDefinition>(`/api/flow-definitions/${id}`),
};

// ==================== Flow Steps API ====================
export const flowStepsApi = {
  getFlowSteps: () => 
    apiFetch<FlowStep[]>('/api/flow-steps'),
  
  getFlowStep: (id: string) => 
    apiFetch<FlowStep>(`/api/flow-steps/${id}`),
  
  createFlowStep: (data: Partial<FlowStep>) => 
    apiFetch<FlowStep>('/api/flow-steps', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  getFlowStepInput: (id: string) => 
    apiFetch(`/api/flow-steps/${id}/input`),
  
  getFlowStepConditions: (id: string) => 
    apiFetch(`/api/flow-steps/${id}/conditions`),
};

// ==================== Flow Runs API ====================
export const flowRunsApi = {
  getFlowRuns: (limit?: number) => 
    localApiFetch<FlowRun[]>(`/graph/flow-runs${buildQueryParams({ limit })}`),
  
  getFlowRun: (id: string) => 
    apiFetch<FlowRun>(`/api/flow-runs/${id}`),
  
  startFlow: (flowId: string, data: any) => 
    apiFetch('/start', {
      method: 'POST',
      body: JSON.stringify({
        flow_id: flowId,
        ...data
      }),
    }),
};

// ==================== Step Runs API ====================
export const stepRunsApi = {
  getStepRuns: (flowRunId?: string) => 
    apiFetch(`/api/step-runs${buildQueryParams({ flow_run_id: flowRunId })}`),
};

// ==================== Nodes API ====================
export const nodesApi = {
  getNodes: (limit?: number, projectId?: string) => 
    localApiFetch(`/graph/nodes${buildQueryParams({ limit, project_id: projectId })}`),
  
  getNodesByProjectId: (projectId: string) => 
    localApiFetch(`/graph/nodes?project_id=${projectId}`),
  
  getNode: (id: string) => 
    apiFetch(`/graph/nodes/${id}`),
  
  getNodeChildren: (id: string) => 
    apiFetch(`/graph/nodes/${id}/children`),
  
  getNodeParent: (id: string) => 
    apiFetch(`/graph/nodes/${id}/parent`),
  
  getNodeLinks: (id: string) => 
    apiFetch(`/graph/nodes/${id}/links`),
  
  getNodeRelationships: (id: string) => 
    apiFetch(`/graph/nodes/${id}/relationships`),
  
  getNodeDependencies: (id: string) => 
    apiFetch(`/graph/nodes/${id}/dependencies`),
};

// ==================== Endpoints API ====================
export const endpointsApi = {
  getEndpoints: () => 
    apiFetch('/api/endpoints'),
  
  getEndpoint: (id: string) => 
    apiFetch(`/api/endpoints/${id}`),
};

// ==================== Variables API ====================
export const variablesApi = {
  getVariables: () => 
    apiFetch<Variable[]>('/api/variables'),
  
  getVariable: (id: string) => 
    apiFetch<Variable>(`/api/variables/${id}`),
  
  createVariable: (data: Partial<Variable>) => 
    apiFetch<Variable>('/api/variables', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  updateVariable: (id: string, data: Partial<Variable>) => 
    apiFetch<Variable>(`/api/variables/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  deleteVariable: (id: string) => 
    apiFetch(`/api/variables/${id}`, {
      method: 'DELETE',
    }),
};

// ==================== Flow Step Conditions API ====================
export const flowStepConditionsApi = {
  createFlowStepCondition: (data: any) => 
    apiFetch('/api/flow-step-conditions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ==================== Combined API Client ====================
export const apiClient = {
  projects: projectsApi,
  flows: flowsApi,
  flowSteps: flowStepsApi,
  flowRuns: flowRunsApi,
  stepRuns: stepRunsApi,
  nodes: nodesApi,
  endpoints: endpointsApi,
  variables: variablesApi,
  flowStepConditions: flowStepConditionsApi,
  
  // Legacy compatibility
  fetchFromBackend: apiFetch,
  localApiFetch,
};

export default apiClient;