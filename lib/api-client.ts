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
export async function getNodes() {
  return fetchFromBackend('/graph/nodes');
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
