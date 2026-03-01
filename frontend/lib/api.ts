import axios from 'axios';

const API_BASE_URL = 'http://localhost:48647/api';

const api = axios.create({
  baseURL: API_BASE_URL,
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

// Flow Conditions API
export const flowConditionsApi = {
  getAll: () => api.get('/flow-conditions'),
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