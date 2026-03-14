// Graph API for Projects, Nodes, Relationships, Dependencies, Tags, Rules, Contexts, etc.
// Implements the complete API specification with 19 categories
import { Hono } from 'hono';
import { CloudflareBindings } from './types';
import { 
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse
} from './response';
import { z } from 'zod';

// Helper function to handle database errors
function handleDbError(error: any) {
  console.error('Database error:', error);
  return {
    success: false,
    error: error.message || 'Database error'
  };
}

// Helper function to convert undefined to null for database
function dbValue(value: any): any {
  return value === undefined ? null : value;
}

// Helper function for consistent API responses
function apiResponse(success: boolean, data?: any, error?: string, statusCode: number = 200) {
  return {
    success,
    data,
    error,
    statusCode
  };
}

// Validation schemas for Graph API entities
const projectCreateSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1, 'name is required'),
  status: z.enum(['active', 'archived', 'deleted']).default('active'),
  metadata: z.string().optional().nullable()
});

const projectUpdateSchema = projectCreateSchema.partial().extend({
  id: z.string().min(1, 'id is required for update')
});

const nodeCreateSchema = z.object({
  id: z.string().min(1).optional(),
  project_id: z.string().min(1, 'project_id is required'),
  type: z.enum(['task', 'doc', 'api', 'concept', 'rule', 'context', 'data', 'ui', 'system']),
  title: z.string().min(1, 'title is required'),
  content: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive', 'completed', 'failed']).default('active'),
  metadata: z.string().optional().nullable()
});

const nodeUpdateSchema = nodeCreateSchema.partial().extend({
  id: z.string().min(1, 'id is required for update')
});

const levelCreateSchema = z.object({
  id: z.string().min(1).optional(),
  parent_node_id: z.string().min(1, 'parent_node_id is required'),
  child_node_id: z.string().min(1, 'child_node_id is required'),
  order_index: z.number().int().default(0)
});

const relationshipCreateSchema = z.object({
  id: z.string().min(1).optional(),
  source_node_id: z.string().min(1, 'source_node_id is required'),
  target_node_id: z.string().min(1, 'target_node_id is required'),
  relation_type: z.string().min(1, 'relation_type is required'),
  weight: z.number().min(0).max(1).default(1.0),
  metadata: z.string().optional().nullable()
});

const dependencyCreateSchema = z.object({
  id: z.string().min(1).optional(),
  node_id: z.string().min(1, 'node_id is required'),
  depends_on_node_id: z.string().min(1, 'depends_on_node_id is required'),
  dependency_type: z.string().min(1, 'dependency_type is required'),
  metadata: z.string().optional().nullable()
});

const tagCreateSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1, 'name is required'),
  color: z.string().optional().nullable()
});

const nodeTagCreateSchema = z.object({
  node_id: z.string().min(1, 'node_id is required'),
  tag_id: z.string().min(1, 'tag_id is required')
});

const ruleCreateSchema = z.object({
  id: z.string().min(1).optional(),
  node_id: z.string().min(1, 'node_id is required'),
  rule_pattern: z.string().min(1, 'rule_pattern is required'),
  execution_type: z.string().min(1, 'execution_type is required'),
  engine: z.string().default('javascript'),
  metadata: z.string().optional().nullable()
});

const ruleUpdateSchema = ruleCreateSchema.partial().extend({
  id: z.string().min(1, 'id is required for update')
});

const ruleVariableCreateSchema = z.object({
  id: z.string().min(1).optional(),
  rule_id: z.string().min(1, 'rule_id is required'),
  name: z.string().min(1, 'name is required'),
  type: z.string().min(1, 'type is required'),
  source: z.string().min(1, 'source is required'),
  default_value: z.string().optional().nullable()
});

const flowTransitionCreateSchema = z.object({
  id: z.string().min(1).optional(),
  from_step_id: z.string().min(1, 'from_step_id is required'),
  to_step_id: z.string().min(1, 'to_step_id is required'),
  condition_rule_id: z.string().optional().nullable(),
  metadata: z.string().optional().nullable()
});

const contextCreateSchema = z.object({
  id: z.string().min(1).optional(),
  entity_type: z.string().min(1, 'entity_type is required'),
  entity_id: z.string().min(1, 'entity_id is required'),
  metadata: z.string().optional().nullable()
});

const contextVariableCreateSchema = z.object({
  id: z.string().min(1).optional(),
  context_id: z.string().min(1, 'context_id is required'),
  name: z.string().min(1, 'name is required'),
  value: z.string().min(1, 'value is required')
});

const contextVariableUpdateSchema = contextVariableCreateSchema.partial().extend({
  id: z.string().min(1, 'id is required for update')
});

const executionCreateSchema = z.object({
  id: z.string().min(1).optional(),
  node_id: z.string().min(1, 'node_id is required'),
  context_id: z.string().optional().nullable(),
  engine: z.string().default('default')
});

// Process Graph schemas
const flowCreateSchema = z.object({
  id: z.string().min(1).optional(),
  project_id: z.string().min(1, 'project_id is required'),
  title: z.string().min(1, 'title is required'),
  status: z.enum(['active', 'archived', 'draft']).default('active'),
  metadata: z.string().optional().nullable()
});

const flowUpdateSchema = flowCreateSchema.partial().extend({
  id: z.string().min(1, 'id is required for update')
});

const stepCreateSchema = z.object({
  id: z.string().min(1).optional(),
  flow_id: z.string().min(1, 'flow_id is required'),
  title: z.string().min(1, 'title is required'),
  type: z.enum(['action', 'decision', 'input', 'output', 'validation']).default('action'),
  content: z.string().optional().nullable(),
  order_index: z.number().int().default(0),
  metadata: z.string().optional().nullable()
});

const stepUpdateSchema = stepCreateSchema.partial().extend({
  id: z.string().min(1, 'id is required for update')
});

const stepEdgeCreateSchema = z.object({
  id: z.string().min(1).optional(),
  source_step_id: z.string().min(1, 'source_step_id is required'),
  target_step_id: z.string().min(1, 'target_step_id is required'),
  condition: z.string().optional().nullable(),
  weight: z.number().default(1.0),
  metadata: z.string().optional().nullable()
});

const flowRunCreateSchema = z.object({
  id: z.string().min(1).optional(),
  flow_id: z.string().min(1, 'flow_id is required'),
  status: z.enum(['running', 'completed', 'failed', 'paused']).default('running'),
  metadata: z.string().optional().nullable()
});

const flowRunUpdateSchema = flowRunCreateSchema.partial().extend({
  id: z.string().min(1, 'id is required for update')
});

const stepRunCreateSchema = z.object({
  id: z.string().min(1).optional(),
  flow_run_id: z.string().min(1, 'flow_run_id is required'),
  step_id: z.string().min(1, 'step_id is required'),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped']).default('pending'),
  output: z.string().optional().nullable(),
  metadata: z.string().optional().nullable()
});

const stepRunUpdateSchema = stepRunCreateSchema.partial().extend({
  id: z.string().min(1, 'id is required for update')
});

// Helper function to validate with Zod
function validateSchema<T>(schema: z.ZodSchema<T>, data: any): { success: boolean; data?: T; error?: string } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return { success: false, error: `Validation failed: ${errors}` };
    }
    return { success: false, error: 'Unknown validation error' };
  }
}

// Create Graph API router
export const graphApi = new Hono<{ Bindings: CloudflareBindings }>();

// ============================================================================
// 1. PROJECTS
// ============================================================================

// GET /projects - List projects
graphApi.get('/projects', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(errorResponse('Database not configured', 500));
    }

    const result = await db.prepare('SELECT * FROM projects WHERE deleted_at IS NULL ORDER BY updated_at DESC').all();
    return c.json(successResponse(result.results || []));
  } catch (error) {
    return c.json(errorResponse(handleDbError(error).error, 500));
  }
});

// POST /projects - Create project
graphApi.post('/projects', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(apiResponse(false, undefined, 'Database not configured', 500));
    }

    const body = await c.req.json();
    
    // Validate with Zod
    const validation = validateSchema(projectCreateSchema, body);
    if (!validation.success) {
      return c.json(apiResponse(false, undefined, validation.error, 400));
    }
    
    const validatedData = validation.data!;
    const { id, name, status, metadata } = validatedData;
    
    // Generate ID if not provided
    const projectId = id || `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Math.floor(Date.now() / 1000);

    const sql = `
      INSERT INTO projects (id, name, status, node_count, flow_count, task_count, execution_count, created_at, updated_at, metadata)
      VALUES (?, ?, ?, 0, 0, 0, 0, ?, ?, ?)
    `;

    await db.prepare(sql).bind(
      projectId,
      name,
      status,
      now,
      now,
      dbValue(metadata)
    ).run();
    
    return c.json(apiResponse(true, { id: projectId, message: 'Project created successfully' }, undefined, 201));
  } catch (error) {
    return c.json(apiResponse(false, undefined, handleDbError(error).error, 500));
  }
});

// GET /projects/{id} - Get project details
graphApi.get('/projects/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(errorResponse('Database not configured', 500));
    }

    const id = c.req.param('id');
    const result = await db.prepare('SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL').bind(id).first();

    if (!result) {
      return c.json(notFoundResponse('Project not found'));
    }

    return c.json(successResponse(result));
  } catch (error) {
    return c.json(errorResponse(handleDbError(error).error, 500));
  }
});

// PATCH /projects/{id} - Update project
graphApi.patch('/projects/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(apiResponse(false, undefined, 'Database not configured', 500));
    }

    const id = c.req.param('id');
    const body = await c.req.json();
    
    // Validate with Zod
    const validation = validateSchema(projectUpdateSchema, { ...body, id });
    if (!validation.success) {
      return c.json(apiResponse(false, undefined, validation.error, 400));
    }
    
    const validatedData = validation.data!;
    const { name, status, metadata } = validatedData;
    
    // Build dynamic UPDATE query
    const updates: string[] = [];
    const bindings: any[] = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      bindings.push(name);
    }
    
    if (status !== undefined) {
      updates.push('status = ?');
      bindings.push(status);
    }
    
    if (metadata !== undefined) {
      updates.push('metadata = ?');
      bindings.push(dbValue(metadata));
    }
    
    // Always update updated_at
    updates.push('updated_at = ?');
    bindings.push(Math.floor(Date.now() / 1000));
    
    if (updates.length === 1) { // Only updated_at was added
      return c.json(apiResponse(false, undefined, 'No fields to update', 400));
    }
    
    bindings.push(id);
    
    const sql = `UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND deleted_at IS NULL`;
    
    const result = await db.prepare(sql).bind(...bindings).run();

    if (result.meta.changes === 0) {
      return c.json(apiResponse(false, undefined, 'Project not found', 404));
    }

    return c.json(apiResponse(true, { message: 'Project updated successfully' }));
  } catch (error) {
    return c.json(apiResponse(false, undefined, handleDbError(error).error, 500));
  }
});

// DELETE /projects/{id} - Delete project (soft delete)
graphApi.delete('/projects/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(apiResponse(false, undefined, 'Database not configured', 500));
    }

    const id = c.req.param('id');
    const now = Math.floor(Date.now() / 1000);
    const result = await db.prepare('UPDATE projects SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL')
      .bind(now, now, id).run();

    if (result.meta.changes === 0) {
      return c.json(apiResponse(false, undefined, 'Project not found', 404));
    }

    return c.json(apiResponse(true, { message: 'Project soft deleted successfully' }));
  } catch (error) {
    return c.json(apiResponse(false, undefined, handleDbError(error).error, 500));
  }
});

// ============================================================================
// 2. NODES
// ============================================================================

// GET /projects/{projectId}/nodes - List nodes with filters
graphApi.get('/projects/:projectId/nodes', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(errorResponse('Database not configured', 500));
    }

    const projectId = c.req.param('projectId');
    const type = c.req.query('type');
    const tag = c.req.query('tag');
    const status = c.req.query('status');
    const search = c.req.query('search');
    
    let query = 'SELECT n.* FROM nodes n WHERE n.project_id = ? AND n.deleted_at IS NULL';
    const bindings: any[] = [projectId];
    
    // Apply filters
    if (type) {
      query += ' AND n.type = ?';
      bindings.push(type);
    }
    
    if (status) {
      query += ' AND n.status = ?';
      bindings.push(status);
    }
    
    if (search) {
      query += ' AND (n.title LIKE ? OR n.content LIKE ?)';
      const searchTerm = `%${search}%`;
      bindings.push(searchTerm, searchTerm);
    }
    
    if (tag) {
      query += ' AND EXISTS (SELECT 1 FROM node_tags nt JOIN tags t ON nt.tag_id = t.id WHERE nt.node_id = n.id AND t.name = ?)';
      bindings.push(tag);
    }
    
    query += ' ORDER BY n.updated_at DESC';
    
    const result = await db.prepare(query).bind(...bindings).all();
    return c.json(successResponse(result.results || []));
  } catch (error) {
    return c.json(errorResponse(handleDbError(error).error, 500));
  }
});

// GET /projects/{projectId}/root-nodes - Get all root nodes (level 1 nodes with no parent)
graphApi.get('/projects/:projectId/root-nodes', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(errorResponse('Database not configured', 500));
    }

    const projectId = c.req.param('projectId');
    
    // SQL query to get root nodes (nodes with no parent in node_hierarchy table)
    const query = `
      SELECT n.* 
      FROM nodes n
      LEFT JOIN node_hierarchy nh ON n.id = nh.child_node_id
      WHERE n.project_id = ? 
        AND n.deleted_at IS NULL
        AND nh.child_node_id IS NULL
      ORDER BY n.updated_at DESC
    `;
    
    const result = await db.prepare(query).bind(projectId).all();
    return c.json(successResponse(result.results || []));
  } catch (error) {
    return c.json(errorResponse(handleDbError(error).error, 500));
  }
});

// POST /nodes - Create node
graphApi.post('/nodes', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(apiResponse(false, undefined, 'Database not configured', 500));
    }

    const body = await c.req.json();
    
    // Validate with Zod
    const validation = validateSchema(nodeCreateSchema, body);
    if (!validation.success) {
      return c.json(apiResponse(false, undefined, validation.error, 400));
    }
    
    const validatedData = validation.data!;
    const { id, project_id, type, title, content, status, metadata } = validatedData;
    
    // Generate ID if not provided
    const nodeId = id || `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Math.floor(Date.now() / 1000);

    const sql = `
      INSERT INTO nodes (id, project_id, type, title, content, status, created_at, updated_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.prepare(sql).bind(
      nodeId,
      project_id,
      type,
      title,
      dbValue(content),
      status,
      now,
      now,
      dbValue(metadata)
    ).run();
    
    // Update project node count
    await db.prepare('UPDATE projects SET node_count = node_count + 1, updated_at = ? WHERE id = ?')
      .bind(now, project_id).run();
    
    return c.json(apiResponse(true, { id: nodeId, message: 'Node created successfully' }, undefined, 201));
  } catch (error) {
    return c.json(apiResponse(false, undefined, handleDbError(error).error, 500));
  }
});

// GET /nodes/{id} - Get node details with relationships, dependencies, tags, children, parent
graphApi.get('/nodes/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(errorResponse('Database not configured', 500));
    }

    const id = c.req.param('id');
    
    // Get node
    const node = await db.prepare('SELECT * FROM nodes WHERE id = ? AND deleted_at IS NULL').bind(id).first();
    if (!node) {
      return c.json(notFoundResponse('Node not found'));
    }
    
    // Get tags
    const tags = await db.prepare(`
      SELECT t.* FROM tags t
      JOIN node_tags nt ON t.id = nt.tag_id
      WHERE nt.node_id = ?
    `).bind(id).all();
    
    // Get relationships where this node is source
    const relationships = await db.prepare(`
      SELECT r.*, n2.title as target_title, n2.type as target_type 
      FROM relationships r
      JOIN nodes n2 ON r.target_node_id = n2.id
      WHERE r.source_node_id = ? AND n2.deleted_at IS NULL
    `).bind(id).all();
    
    // Get dependencies where this node depends on others (using relationships table with relation_type='depends_on')
    const dependencies = await db.prepare(`
      SELECT r.*, n2.title as depends_on_title, n2.type as depends_on_type
      FROM relationships r
      JOIN nodes n2 ON r.target_node_id = n2.id
      WHERE r.source_node_id = ? AND r.relation_type = 'depends_on' AND n2.deleted_at IS NULL
    `).bind(id).all();
    
    // Get children (nodes where this node is parent)
    const children = await db.prepare(`
      SELECT n.*, l.order_index
      FROM nodes n
      JOIN node_hierarchy l ON n.id = l.child_node_id
      WHERE l.parent_node_id = ? AND n.deleted_at IS NULL
      ORDER BY l.order_index
    `).bind(id).all();
    
    // Get parent (node where this node is child)
    const parent = await db.prepare(`
      SELECT n.*, l.order_index
      FROM nodes n
      JOIN node_hierarchy l ON n.id = l.parent_node_id
      WHERE l.child_node_id = ? AND n.deleted_at IS NULL
    `).bind(id).first();
    
    return c.json(successResponse({
      node,
      tags: tags.results || [],
      relationships: relationships.results || [],
      dependencies: dependencies.results || [],
      children: children.results || [],
      parent: parent || null
    }));
  } catch (error) {
    return c.json(errorResponse(handleDbError(error).error, 500));
  }
});

// PATCH /nodes/{id} - Update node
graphApi.patch('/nodes/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(apiResponse(false, undefined, 'Database not configured', 500));
    }

    const id = c.req.param('id');
    const body = await c.req.json();
    
    // Validate with Zod
    const validation = validateSchema(nodeUpdateSchema, { ...body, id });
    if (!validation.success) {
      return c.json(apiResponse(false, undefined, validation.error, 400));
    }
    
    const validatedData = validation.data!;
    const { project_id, type, title, content, status, metadata } = validatedData;
    
    // Get current node to know old project_id if project_id is being updated
    let oldProjectId: string | undefined;
    if (project_id !== undefined) {
      const currentNode = await db.prepare('SELECT project_id FROM nodes WHERE id = ? AND deleted_at IS NULL').bind(id).first();
      if (!currentNode) {
        return c.json(apiResponse(false, undefined, 'Node not found', 404));
      }
      oldProjectId = (currentNode as any).project_id;
    }
    
    // Build dynamic UPDATE query
    const updates: string[] = [];
    const bindings: any[] = [];
    
    if (project_id !== undefined) {
      updates.push('project_id = ?');
      bindings.push(project_id);
    }
    
    if (type !== undefined) {
      updates.push('type = ?');
      bindings.push(type);
    }
    
    if (title !== undefined) {
      updates.push('title = ?');
      bindings.push(title);
    }
    
    if (content !== undefined) {
      updates.push('content = ?');
      bindings.push(dbValue(content));
    }
    
    if (status !== undefined) {
      updates.push('status = ?');
      bindings.push(status);
    }
    
    if (metadata !== undefined) {
      updates.push('metadata = ?');
      bindings.push(dbValue(metadata));
    }
    
    // Always update updated_at
    const now = Math.floor(Date.now() / 1000);
    updates.push('updated_at = ?');
    bindings.push(now);
    
    if (updates.length === 1) { // Only updated_at was added
      return c.json(apiResponse(false, undefined, 'No fields to update', 400));
    }
    
    bindings.push(id);
    
    const sql = `UPDATE nodes SET ${updates.join(', ')} WHERE id = ? AND deleted_at IS NULL`;
    
    const result = await db.prepare(sql).bind(...bindings).run();

    if (result.meta.changes === 0) {
      return c.json(apiResponse(false, undefined, 'Node not found', 404));
    }
    
    // Update project counts if project_id was changed
    if (project_id !== undefined && oldProjectId && oldProjectId !== project_id) {
      // Decrement old project's node_count
      await db.prepare('UPDATE projects SET node_count = node_count - 1, updated_at = ? WHERE id = ? AND deleted_at IS NULL')
        .bind(now, oldProjectId).run();
      
      // Increment new project's node_count
      await db.prepare('UPDATE projects SET node_count = node_count + 1, updated_at = ? WHERE id = ? AND deleted_at IS NULL')
        .bind(now, project_id).run();
    }

    return c.json(apiResponse(true, { message: 'Node updated successfully' }));
  } catch (error) {
    return c.json(apiResponse(false, undefined, handleDbError(error).error, 500));
  }
});

// DELETE /nodes/{id} - Delete node (soft delete)
graphApi.delete('/nodes/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(apiResponse(false, undefined, 'Database not configured', 500));
    }

    const id = c.req.param('id');
    
    // Get node to know project_id for updating count
    const node = await db.prepare('SELECT project_id FROM nodes WHERE id = ? AND deleted_at IS NULL').bind(id).first();
    if (!node) {
      return c.json(apiResponse(false, undefined, 'Node not found', 404));
    }
    
    // Soft delete: set deleted_at timestamp instead of hard delete
    const now = Math.floor(Date.now() / 1000);
    const result = await db.prepare('UPDATE nodes SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL')
      .bind(now, now, id).run();

    if (result.meta.changes === 0) {
      return c.json(apiResponse(false, undefined, 'Node not found', 404));
    }
    
    // Update project node count
    await db.prepare('UPDATE projects SET node_count = node_count - 1, updated_at = ? WHERE id = ?')
      .bind(now, (node as any).project_id).run();

    return c.json(apiResponse(true, { message: 'Node soft deleted successfully' }));
  } catch (error) {
    return c.json(apiResponse(false, undefined, handleDbError(error).error, 500));
  }
});

// GET /nodes - List nodes with filters (supports project_id query parameter)
graphApi.get('/nodes', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(errorResponse('Database not configured', 500));
    }

    const projectId = c.req.query('project_id');
    const type = c.req.query('type');
    const tag = c.req.query('tag');
    const status = c.req.query('status');
    const search = c.req.query('search');
    
    // Build query
    let query = 'SELECT n.* FROM nodes n WHERE n.deleted_at IS NULL';
    const bindings: any[] = [];
    
    // Apply project filter if provided
    if (projectId) {
      query += ' AND n.project_id = ?';
      bindings.push(projectId);
    }
    
    // Apply filters
    if (type) {
      query += ' AND n.type = ?';
      bindings.push(type);
    }
    
    if (status) {
      query += ' AND n.status = ?';
      bindings.push(status);
    }
    
    if (search) {
      query += ' AND (n.title LIKE ? OR n.content LIKE ?)';
      const searchTerm = `%${search}%`;
      bindings.push(searchTerm, searchTerm);
    }
    
    if (tag) {
      query += ' AND EXISTS (SELECT 1 FROM node_tags nt JOIN tags t ON nt.tag_id = t.id WHERE nt.node_id = n.id AND t.name = ?)';
      bindings.push(tag);
    }
    
    query += ' ORDER BY n.updated_at DESC';
    
    const result = await db.prepare(query).bind(...bindings).all();
    return c.json(successResponse(result.results || []));
  } catch (error) {
    return c.json(errorResponse(handleDbError(error).error, 500));
  }
});

// ============================================================================
// 3. NODE HIERARCHY (Parent/Children Relationships)
// ============================================================================

// GET /nodes/{id}/children - Get child nodes
graphApi.get('/nodes/:id/children', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(errorResponse('Database not configured', 500));
    }

    const id = c.req.param('id');
    
    // Get children nodes
    const children = await db.prepare(`
      SELECT n.*, l.order_index
      FROM nodes n
      JOIN node_hierarchy l ON n.id = l.child_node_id
      WHERE l.parent_node_id = ? AND n.deleted_at IS NULL
      ORDER BY l.order_index
    `).bind(id).all();
    
    return c.json(successResponse(children.results || []));
  } catch (error) {
    return c.json(errorResponse(handleDbError(error).error, 500));
  }
});

// GET /nodes/{id}/parent - Get parent node
graphApi.get('/nodes/:id/parent', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(errorResponse('Database not configured', 500));
    }

    const id = c.req.param('id');
    
    // Get parent node
    const parent = await db.prepare(`
      SELECT n.*, l.order_index
      FROM nodes n
      JOIN node_hierarchy l ON n.id = l.parent_node_id
      WHERE l.child_node_id = ? AND n.deleted_at IS NULL
    `).bind(id).first();
    
    return c.json(successResponse(parent || null));
  } catch (error) {
    return c.json(errorResponse(handleDbError(error).error, 500));
  }
});

// POST /nodes/{id}/children - Add child node
graphApi.post('/nodes/:id/children', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(apiResponse(false, undefined, 'Database not configured', 500));
    }

    const parentId = c.req.param('id');
    const body = await c.req.json();
    
    // Validate request body
    if (!body.child_id) {
      return c.json(apiResponse(false, undefined, 'child_id is required', 400));
    }
    
    const childId = body.child_id;
    const orderIndex = body.order_index || 0;
    
    // Check if parent and child nodes exist
    const parentNode = await db.prepare('SELECT id FROM nodes WHERE id = ? AND deleted_at IS NULL').bind(parentId).first();
    if (!parentNode) {
      return c.json(apiResponse(false, undefined, 'Parent node not found', 404));
    }
    
    const childNode = await db.prepare('SELECT id FROM nodes WHERE id = ? AND deleted_at IS NULL').bind(childId).first();
    if (!childNode) {
      return c.json(apiResponse(false, undefined, 'Child node not found', 404));
    }
    
    // Check if relationship already exists
    const existing = await db.prepare('SELECT id FROM node_hierarchy WHERE parent_node_id = ? AND child_node_id = ?')
      .bind(parentId, childId).first();
    if (existing) {
      return c.json(apiResponse(false, undefined, 'Child relationship already exists', 400));
    }
    
    // Create hierarchy relationship
    const hierarchyId = `hierarchy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Math.floor(Date.now() / 1000);
    
    await db.prepare(`
      INSERT INTO node_hierarchy (id, parent_node_id, child_node_id, order_index, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(hierarchyId, parentId, childId, orderIndex, now).run();
    
    return c.json(apiResponse(true, { 
      id: hierarchyId, 
      parent_id: parentId, 
      child_id: childId,
      order_index: orderIndex,
      message: 'Child node added successfully' 
    }, undefined, 201));
  } catch (error) {
    return c.json(apiResponse(false, undefined, handleDbError(error).error, 500));
  }
});

// DELETE /nodes/{id}/children/{childId} - Remove child node
graphApi.delete('/nodes/:id/children/:childId', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(apiResponse(false, undefined, 'Database not configured', 500));
    }

    const parentId = c.req.param('id');
    const childId = c.req.param('childId');
    
    // Delete hierarchy relationship
    const result = await db.prepare('DELETE FROM node_hierarchy WHERE parent_node_id = ? AND child_node_id = ?')
      .bind(parentId, childId).run();
    
    if (result.meta.changes === 0) {
      return c.json(apiResponse(false, undefined, 'Child relationship not found', 404));
    }
    
    return c.json(apiResponse(true, { message: 'Child relationship removed successfully' }));
  } catch (error) {
    return c.json(apiResponse(false, undefined, handleDbError(error).error, 500));
  }
});

// ============================================================================
// 4. HORIZONTAL LINKS (Left/Right Links)
// ============================================================================

// GET /nodes/{id}/links - Get all links (left/right)
graphApi.get('/nodes/:id/links', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(errorResponse('Database not configured', 500));
    }

    const id = c.req.param('id');
    
    // Get links where this node is source
    const outgoingLinks = await db.prepare(`
      SELECT r.*, n2.title as target_title, n2.type as target_type, 'outgoing' as direction
      FROM relationships r
      JOIN nodes n2 ON r.target_node_id = n2.id
      WHERE r.source_node_id = ? AND n2.deleted_at IS NULL
    `).bind(id).all();
    
    // Get links where this node is target
    const incomingLinks = await db.prepare(`
      SELECT r.*, n2.title as source_title, n2.type as source_type, 'incoming' as direction
      FROM relationships r
      JOIN nodes n2 ON r.source_node_id = n2.id
      WHERE r.target_node_id = ? AND n2.deleted_at IS NULL
    `).bind(id).all();
    
    return c.json(successResponse({
      outgoing: outgoingLinks.results || [],
      incoming: incomingLinks.results || []
    }));
  } catch (error) {
    return c.json(errorResponse(handleDbError(error).error, 500));
  }
});

// POST /nodes/{id}/links - Create new link
graphApi.post('/nodes/:id/links', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(apiResponse(false, undefined, 'Database not configured', 500));
    }

    const sourceId = c.req.param('id');
    const body = await c.req.json();
    
    // Validate request body
    if (!body.target_id) {
      return c.json(apiResponse(false, undefined, 'target_id is required', 400));
    }
    if (!body.relation_type) {
      return c.json(apiResponse(false, undefined, 'relation_type is required', 400));
    }
    
    const targetId = body.target_id;
    const relationType = body.relation_type;
    const weight = body.weight || 1.0;
    const metadata = body.metadata || null;
    
    // Check if source and target nodes exist
    const sourceNode = await db.prepare('SELECT id FROM nodes WHERE id = ? AND deleted_at IS NULL').bind(sourceId).first();
    if (!sourceNode) {
      return c.json(apiResponse(false, undefined, 'Source node not found', 404));
    }
    
    const targetNode = await db.prepare('SELECT id FROM nodes WHERE id = ? AND deleted_at IS NULL').bind(targetId).first();
    if (!targetNode) {
      return c.json(apiResponse(false, undefined, 'Target node not found', 404));
    }
    
    // Check if relationship already exists
    const existing = await db.prepare('SELECT id FROM relationships WHERE source_node_id = ? AND target_node_id = ? AND relation_type = ?')
      .bind(sourceId, targetId, relationType).first();
    if (existing) {
      return c.json(apiResponse(false, undefined, 'Relationship already exists', 400));
    }
    
    // Create relationship
    const relationshipId = `rel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Math.floor(Date.now() / 1000);
    
    await db.prepare(`
      INSERT INTO relationships (id, source_node_id, target_node_id, relation_type, weight, created_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(relationshipId, sourceId, targetId, relationType, weight, now, dbValue(metadata)).run();
    
    return c.json(apiResponse(true, { 
      id: relationshipId, 
      source_id: sourceId, 
      target_id: targetId,
      relation_type: relationType,
      weight: weight,
      message: 'Link created successfully' 
    }, undefined, 201));
  } catch (error) {
    return c.json(apiResponse(false, undefined, handleDbError(error).error, 500));
  }
});

// DELETE /nodes/{id}/links/{linkId} - Remove link
graphApi.delete('/nodes/:id/links/:linkId', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(apiResponse(false, undefined, 'Database not configured', 500));
    }

    const nodeId = c.req.param('id');
    const linkId = c.req.param('linkId');
    
    // Delete relationship (checking if node is either source or target)
    const result = await db.prepare('DELETE FROM relationships WHERE id = ? AND (source_node_id = ? OR target_node_id = ?)')
      .bind(linkId, nodeId, nodeId).run();
    
    if (result.meta.changes === 0) {
      return c.json(apiResponse(false, undefined, 'Link not found or node not part of this link', 404));
    }
    
    return c.json(apiResponse(true, { message: 'Link removed successfully' }));
  } catch (error) {
    return c.json(apiResponse(false, undefined, handleDbError(error).error, 500));
  }
});

// ============================================================================
// 5. RELATIONSHIPS MANAGEMENT
// ============================================================================

// GET /nodes/{id}/relationships - Get relationships for a node
graphApi.get('/nodes/:id/relationships', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(errorResponse('Database not configured', 500));
    }

    const id = c.req.param('id');
    
    // Get outgoing relationships
    const outgoing = await db.prepare(`
      SELECT r.*, n2.title as target_title, n2.type as target_type
      FROM relationships r
      JOIN nodes n2 ON r.target_node_id = n2.id
      WHERE r.source_node_id = ? AND n2.deleted_at IS NULL
    `).bind(id).all();
    
    // Get incoming relationships
    const incoming = await db.prepare(`
      SELECT r.*, n2.title as source_title, n2.type as source_type
      FROM relationships r
      JOIN nodes n2 ON r.source_node_id = n2.id
      WHERE r.target_node_id = ? AND n2.deleted_at IS NULL
    `).bind(id).all();
    
    return c.json(successResponse({
      outgoing: outgoing.results || [],
      incoming: incoming.results || []
    }));
  } catch (error) {
    return c.json(errorResponse(handleDbError(error).error, 500));
  }
});

// POST /relationships - Create relationship
graphApi.post('/relationships', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(apiResponse(false, undefined, 'Database not configured', 500));
    }

    const body = await c.req.json();
    
    // Validate with Zod
    const validation = validateSchema(relationshipCreateSchema, body);
    if (!validation.success) {
      return c.json(apiResponse(false, undefined, validation.error, 400));
    }
    
    const validatedData = validation.data!;
    const { id, source_node_id, target_node_id, relation_type, weight, metadata } = validatedData;
    
    // Check if source and target nodes exist
    const sourceNode = await db.prepare('SELECT id FROM nodes WHERE id = ? AND deleted_at IS NULL').bind(source_node_id).first();
    if (!sourceNode) {
      return c.json(apiResponse(false, undefined, 'Source node not found', 404));
    }
    
    const targetNode = await db.prepare('SELECT id FROM nodes WHERE id = ? AND deleted_at IS NULL').bind(target_node_id).first();
    if (!targetNode) {
      return c.json(apiResponse(false, undefined, 'Target node not found', 404));
    }
    
    // Generate ID if not provided
    const relationshipId = id || `rel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Math.floor(Date.now() / 1000);
    
    await db.prepare(`
      INSERT INTO relationships (id, source_node_id, target_node_id, relation_type, weight, created_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(relationshipId, source_node_id, target_node_id, relation_type, weight, now, dbValue(metadata)).run();
    
    return c.json(apiResponse(true, { 
      id: relationshipId, 
      message: 'Relationship created successfully' 
    }, undefined, 201));
  } catch (error) {
    return c.json(apiResponse(false, undefined, handleDbError(error).error, 500));
  }
});

// DELETE /relationships/{id} - Delete relationship
graphApi.delete('/relationships/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(apiResponse(false, undefined, 'Database not configured', 500));
    }

    const id = c.req.param('id');
    
    const result = await db.prepare('DELETE FROM relationships WHERE id = ?').bind(id).run();
    
    if (result.meta.changes === 0) {
      return c.json(apiResponse(false, undefined, 'Relationship not found', 404));
    }
    
    return c.json(apiResponse(true, { message: 'Relationship deleted successfully' }));
  } catch (error) {
    return c.json(apiResponse(false, undefined, handleDbError(error).error, 500));
  }
});

// ============================================================================
// 6. DEPENDENCIES MANAGEMENT
// ============================================================================

// GET /nodes/{id}/dependencies - Get dependencies for a node
graphApi.get('/nodes/:id/dependencies', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(errorResponse('Database not configured', 500));
    }

    const id = c.req.param('id');
    
    // Get dependencies where this node depends on others
    const depends_on = await db.prepare(`
      SELECT r.*, n2.title as depends_on_title, n2.type as depends_on_type
      FROM relationships r
      JOIN nodes n2 ON r.target_node_id = n2.id
      WHERE r.source_node_id = ? AND r.relation_type = 'depends_on' AND n2.deleted_at IS NULL
    `).bind(id).all();
    
    // Get dependencies where others depend on this node
    const depended_by = await db.prepare(`
      SELECT r.*, n2.title as node_title, n2.type as node_type
      FROM relationships r
      JOIN nodes n2 ON r.source_node_id = n2.id
      WHERE r.target_node_id = ? AND r.relation_type = 'depends_on' AND n2.deleted_at IS NULL
    `).bind(id).all();
    
    return c.json(successResponse({
      depends_on: depends_on.results || [],
      depended_by: depended_by.results || []
    }));
  } catch (error) {
    return c.json(errorResponse(handleDbError(error).error, 500));
  }
});

// POST /dependencies - Create dependency
graphApi.post('/dependencies', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(apiResponse(false, undefined, 'Database not configured', 500));
    }

    const body = await c.req.json();
    
    // Validate with Zod
    const validation = validateSchema(dependencyCreateSchema, body);
    if (!validation.success) {
      return c.json(apiResponse(false, undefined, validation.error, 400));
    }
    
    const validatedData = validation.data!;
    const { id, node_id, depends_on_node_id, dependency_type, metadata } = validatedData;
    
    // Check if nodes exist
    const node = await db.prepare('SELECT id FROM nodes WHERE id = ? AND deleted_at IS NULL').bind(node_id).first();
    if (!node) {
      return c.json(apiResponse(false, undefined, 'Node not found', 404));
    }
    
    const dependsOnNode = await db.prepare('SELECT id FROM nodes WHERE id = ? AND deleted_at IS NULL').bind(depends_on_node_id).first();
    if (!dependsOnNode) {
      return c.json(apiResponse(false, undefined, 'Depends on node not found', 404));
    }
    
    // Generate ID if not provided
    const dependencyId = id || `dep-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Math.floor(Date.now() / 1000);
    
    // Create dependency as a relationship with relation_type='depends_on'
    await db.prepare(`
      INSERT INTO relationships (id, source_node_id, target_node_id, relation_type, weight, created_at, metadata)
      VALUES (?, ?, ?, 'depends_on', 1.0, ?, ?)
    `).bind(dependencyId, node_id, depends_on_node_id, now, dbValue(metadata)).run();
    
    return c.json(apiResponse(true, { 
      id: dependencyId, 
      message: 'Dependency created successfully' 
    }, undefined, 201));
  } catch (error) {
    return c.json(apiResponse(false, undefined, handleDbError(error).error, 500));
  }
});

// DELETE /dependencies/{id} - Delete dependency
graphApi.delete('/dependencies/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(apiResponse(false, undefined, 'Database not configured', 500));
    }

    const id = c.req.param('id');
    
    const result = await db.prepare('DELETE FROM relationships WHERE id = ? AND relation_type = ?').bind(id, 'depends_on').run();
    
    if (result.meta.changes === 0) {
      return c.json(apiResponse(false, undefined, 'Dependency not found', 404));
    }
    
    return c.json(apiResponse(true, { message: 'Dependency deleted successfully' }));
  } catch (error) {
    return c.json(apiResponse(false, undefined, handleDbError(error).error, 500));
  }
});

// ============================================================================
// 7. BREADCRUMBS
// ============================================================================

// GET /nodes/{id}/breadcrumbs - Get breadcrumb trail
graphApi.get('/nodes/:id/breadcrumbs', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(errorResponse('Database not configured', 500));
    }

    const id = c.req.param('id');
    
    // Get the node to start with
    const node = await db.prepare('SELECT * FROM nodes WHERE id = ? AND deleted_at IS NULL').bind(id).first();
    if (!node) {
      return c.json(notFoundResponse('Node not found'));
    }
    
    const breadcrumbs = [];
    let currentNode = node;
    let depth = 0;
    const maxDepth = 20; // Prevent infinite loops
    
    // Add current node as first breadcrumb
    breadcrumbs.push({
      id: (currentNode as any).id,
      title: (currentNode as any).title,
      type: (currentNode as any).type,
      depth: depth
    });
    
    // Traverse up the hierarchy to get ancestors
    while (depth < maxDepth) {
      depth++;
      
      // Get parent of current node
      const parent = await db.prepare(`
        SELECT n.*, l.order_index
        FROM nodes n
        JOIN node_hierarchy l ON n.id = l.parent_node_id
        WHERE l.child_node_id = ? AND n.deleted_at IS NULL
      `).bind((currentNode as any).id).first();
      
      if (!parent) {
        break; // No more parents
      }
      
      // Add parent to breadcrumbs (at the beginning since we're going up)
      breadcrumbs.unshift({
        id: (parent as any).id,
        title: (parent as any).title,
        type: (parent as any).type,
        depth: depth
      });
      
      currentNode = parent;
    }
    
    return c.json(successResponse({
      node_id: id,
      breadcrumbs: breadcrumbs,
      depth: breadcrumbs.length
    }));
  } catch (error) {
    return c.json(errorResponse(handleDbError(error).error, 500));
  }
});