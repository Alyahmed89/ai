// Shared in-memory storage for API routes

export let nodes: any[] = [];

export function addNode(node: any) {
  nodes.push(node);
}

export function getNodesByProjectId(projectId: string) {
  return nodes.filter(node => node.project_id === projectId);
}

export function getNodeById(id: string) {
  return nodes.find(node => node.id === id);
}