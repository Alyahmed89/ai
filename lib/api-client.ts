const BACKEND_URL = process.env.BACKEND_URL || 'https://deepseek-agent.alghamdimo89.workers.dev';

export async function fetchFromBackend(endpoint: string, options?: RequestInit) {
  const url = `${BACKEND_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Backend request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Projects API
export async function getProjects() {
  return fetchFromBackend('/graph/projects');
}

// Nodes API
export async function getNodes(projectId?: string) {
  const endpoint = projectId ? `/graph/nodes?project_id=${projectId}` : '/graph/nodes';
  return fetchFromBackend(endpoint);
}

export async function getNode(id: string) {
  return fetchFromBackend(`/graph/nodes/${id}`);
}

export async function getNodeChildren(id: string) {
  return fetchFromBackend(`/graph/nodes/${id}/children`);
}

export async function getNodeParent(id: string) {
  return fetchFromBackend(`/graph/nodes/${id}/parent`);
}

export async function getNodeLinks(id: string) {
  return fetchFromBackend(`/graph/nodes/${id}/links`);
}

export async function getNodeRelationships(id: string) {
  return fetchFromBackend(`/graph/nodes/${id}/relationships`);
}

export async function getNodeDependencies(id: string) {
  return fetchFromBackend(`/graph/nodes/${id}/dependencies`);
}

// Tasks API
export async function getTasks() {
  return fetchFromBackend('/api/tasks');
}

// Flows API
export async function getFlows() {
  return fetchFromBackend('/api/flows');
}

// Flow Definitions API
export async function getFlowDefinitions() {
  return fetchFromBackend('/api/flow-definitions');
}

// Flow Steps API
export async function getFlowSteps() {
  return fetchFromBackend('/api/flow-steps');
}

export async function getFlowStep(id: string) {
  return fetchFromBackend(`/api/flow-steps/${id}`);
}

export async function getFlowStepInput(id: string) {
  return fetchFromBackend(`/api/flow-steps/${id}/input`);
}

export async function getFlowStepConditions(id: string) {
  return fetchFromBackend(`/api/flow-steps/${id}/conditions`);
}

// Flow Runs API
export async function getFlowRuns() {
  return fetchFromBackend('/api/flow-runs');
}

export async function getFlowRun(id: string) {
  return fetchFromBackend(`/api/flow-runs/${id}`);
}

// Step Runs API
export async function getStepRuns(flowRunId?: string) {
  const endpoint = flowRunId ? `/api/step-runs?flow_run_id=${flowRunId}` : '/api/step-runs';
  return fetchFromBackend(endpoint);
}

// Start Flow API
export async function startFlow(flowId: string, data: any) {
  return fetchFromBackend('/start', {
    method: 'POST',
    body: JSON.stringify({
      flow_id: flowId,
      ...data
    }),
  });
}
