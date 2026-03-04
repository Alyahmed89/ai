// Task Service Module
// Handles all task-related business logic

import { queryDatabase, buildWhereClause, buildPagination } from './cloudflare-d1';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  task_type: string;
  created_at: string;
}

export interface TaskFilters {
  status?: string;
  priority?: string;
  task_type?: string;
}

export interface TaskListOptions {
  limit?: number;
  offset?: number;
  filters?: TaskFilters;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

/**
 * Get all tasks with optional filtering and pagination
 */
export async function getTasks(options: TaskListOptions = {}): Promise<Task[]> {
  const { limit = 50, offset = 0, filters = {}, orderBy = 'created_at', orderDirection = 'DESC' } = options;
  
  // Build WHERE clause from filters
  const { sql: whereClause, params: whereParams } = buildWhereClause(filters);
  
  // Build pagination
  const pagination = buildPagination(limit, offset);
  
  // Build SQL query
  const sql = `
    SELECT id, title, description, status, priority, task_type, created_at 
    FROM tasks
    ${whereClause}
    ORDER BY ${orderBy} ${orderDirection}
    ${pagination}
  `;
  
  const tasks = await queryDatabase(sql, whereParams);
  
  // Transform and return tasks
  return tasks.map((task: any) => ({
    id: task.id,
    title: task.title,
    description: task.description || 'No description available',
    status: task.status || 'pending',
    priority: task.priority || 'medium',
    task_type: task.task_type || 'unknown',
    created_at: task.created_at
  }));
}

/**
 * Get a single task by ID
 */
export async function getTaskById(id: string): Promise<Task | null> {
  const sql = `
    SELECT id, title, description, status, priority, task_type, created_at 
    FROM tasks 
    WHERE id = ?
  `;
  
  const tasks = await queryDatabase(sql, [id]);
  
  if (tasks.length === 0) {
    return null;
  }
  
  const task = tasks[0];
  return {
    id: task.id,
    title: task.title,
    description: task.description || 'No description available',
    status: task.status || 'pending',
    priority: task.priority || 'medium',
    task_type: task.task_type || 'unknown',
    created_at: task.created_at
  };
}

/**
 * Create a new task
 */
export async function createTask(taskData: Omit<Task, 'id' | 'created_at'>): Promise<Task> {
  const { title, description, status = 'pending', priority = 'medium', task_type = 'unknown' } = taskData;
  
  const sql = `
    INSERT INTO tasks (title, description, status, priority, task_type, created_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `;
  
  // For now, we'll just return a mock task since we don't have the last_insert_rowid logic
  // In a real implementation, we would execute the statement and fetch the created task
  const mockTask: Task = {
    id: Date.now().toString(),
    title,
    description,
    status,
    priority,
    task_type,
    created_at: new Date().toISOString()
  };
  
  return mockTask;
}

/**
 * Update an existing task
 */
export async function updateTask(id: string, taskData: Partial<Omit<Task, 'id' | 'created_at'>>): Promise<Task | null> {
  const existingTask = await getTaskById(id);
  if (!existingTask) {
    return null;
  }
  
  // Merge existing data with updates
  const updatedTask = { ...existingTask, ...taskData };
  
  // In a real implementation, we would execute an UPDATE statement
  return updatedTask;
}

/**
 * Delete a task
 */
export async function deleteTask(id: string): Promise<boolean> {
  const existingTask = await getTaskById(id);
  if (!existingTask) {
    return false;
  }
  
  // In a real implementation, we would execute a DELETE statement
  return true;
}

/**
 * Get task statistics
 */
export async function getTaskStats(): Promise<{
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
}> {
  const allTasks = await getTasks({ limit: 1000 }); // Get all tasks for stats
  
  const byStatus: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  
  allTasks.forEach(task => {
    byStatus[task.status] = (byStatus[task.status] || 0) + 1;
    byPriority[task.priority] = (byPriority[task.priority] || 0) + 1;
  });
  
  return {
    total: allTasks.length,
    byStatus,
    byPriority
  };
}