import { apiClient } from '@/lib/api-client';

export interface Project {
  id: string;
  name: string;
  status: string;
  metadata: string | null;
  created_at: number;
  updated_at: number;
}

export interface Node {
  id: string;
  project_id: string;
  type: string;
  title: string;
  content: string;
  status: string;
  metadata: string;
  created_at: string;
  updated_at: string;
}

export async function fetchProjects(): Promise<Project[]> {
  try {
    const response = await apiClient.getProjects(50);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.success && data.data) {
      return data.data;
    } else {
      return data;
    }
  } catch (error) {
    console.error('Error fetching projects:', error);
    return [];
  }
}

export async function fetchNodes(projectId?: string): Promise<Node[]> {
  try {
    const response = await apiClient.getNodes(50, projectId);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.success && data.data) {
      return data.data;
    } else {
      return data;
    }
  } catch (error) {
    console.error('Error fetching nodes:', error);
    return [];
  }
}

export async function fetchProject(projectId: string): Promise<Project | null> {
  try {
    const response = await apiClient.getProject(projectId);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.success && data.data) {
      return data.data;
    } else {
      return data;
    }
  } catch (error) {
    console.error('Error fetching project:', error);
    return null;
  }
}

export async function fetchNode(nodeId: string): Promise<Node | null> {
  try {
    const response = await apiClient.getNode(nodeId);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.success && data.data) {
      return data.data;
    } else {
      return data;
    }
  } catch (error) {
    console.error('Error fetching node:', error);
    return null;
  }
}

export async function fetchNodeChildren(nodeId: string): Promise<Node[]> {
  try {
    const response = await apiClient.getNodeChildren(nodeId);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.success && data.data) {
      return data.data;
    } else {
      return data;
    }
  } catch (error) {
    console.error('Error fetching node children:', error);
    return [];
  }
}

export async function fetchProjectRootNodes(projectId: string): Promise<Node[]> {
  try {
    const response = await apiClient.getProjectRootNodes(projectId);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.success && data.data) {
      return data.data;
    } else {
      return data;
    }
  } catch (error) {
    console.error('Error fetching project root nodes:', error);
    return [];
  }
}