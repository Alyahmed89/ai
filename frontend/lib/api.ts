import axios from 'axios';

// Use environment variable for API URL, fallback to production URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://deepseek-agent.alghamdimo89.workers.dev';

// Ensure the URL ends with /api for consistency
const BASE_URL = API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${API_BASE_URL}/api`;

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Flows API
export const flowsApi = {
  getAll: () => api.get('/flows'),
  getById: (id: string) => api.get(`/flows/${id}`),
  create: (data: any) => api.post('/flows', data),
  update: (id: string, data: any) => api.put(`/flows/${id}`, data),
  delete: (id: string) => api.delete(`/flows/${id}`),
  getSteps: (flowId: string) => api.get(`/flows/${flowId}/steps`),
};

// Tasks API
export const tasksApi = {
  getAll: () => api.get('/tasks'),
  getById: (id: string) => api.get(`/tasks/${id}`),
  create: (data: any) => api.post('/tasks', data),
  update: (id: string, data: any) => api.put(`/tasks/${id}`, data),
  delete: (id: string) => api.delete(`/tasks/${id}`),
};

// Flow Steps API
export const flowStepsApi = {
  getAll: () => api.get('/flow-steps'),
  getById: (id: string) => api.get(`/flow-steps/${id}`),
  create: (data: any) => api.post('/flow-steps', data),
  update: (id: string, data: any) => api.put(`/flow-steps/${id}`, data),
  delete: (id: string) => api.delete(`/flow-steps/${id}`),
};

// Flow Conditions API
export const flowConditionsApi = {
  getAll: () => api.get('/flow-conditions'),
  getById: (id: string) => api.get(`/flow-conditions/${id}`),
  create: (data: any) => api.post('/flow-conditions', data),
  update: (id: string, data: any) => api.put(`/flow-conditions/${id}`, data),
  delete: (id: string) => api.delete(`/flow-conditions/${id}`),
  getByFlowAndStep: (flowId: string, stepId: string) => 
    api.get(`/flows/${flowId}/steps/${stepId}/conditions`),
};

// Flow Runs API
export const flowRunsApi = {
  getAll: () => api.get('/flow-runs'),
};

// Health check
export const healthApi = {
  check: () => api.get('/health'),
};

export default api;