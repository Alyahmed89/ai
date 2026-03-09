export interface Node {
  id: string;
  title: string;
  content: string;
  parentId: string | null;
  children: ChildNode[];
  leftLinks: HorizontalLink[];
  rightLinks: HorizontalLink[];
  createdAt: string;
  updatedAt: string;
}

export interface ChildNode {
  nodeId: string;
  condition?: string;
}

export interface HorizontalLink {
  targetId: string;
  description?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  rootNodeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface BreadcrumbItem {
  id: string;
  title: string;
}