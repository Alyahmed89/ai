const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const DATABASE_ID = process.env.CLOUDFLARE_DATABASE_ID;

export interface FlowStep {
  id: number;
  flow_id: string;
  step_key: string;
  title: string;
  step_type: string;
  order_index: number;
  input_keys: string;
  payload_template: string;
  created_at: string;
  updated_at: string;
}

export interface FlowStepCondition {
  id: number;
  flow_step_id: number;
  condition_key: string;
  condition_type: string;
  condition_value: string;
  created_at: string;
  updated_at: string;
}

export interface FlowCondition {
  id: number;
  condition_key: string;
  condition_type: string;
  condition_value: string;
  created_at: string;
  updated_at: string;
}

class CloudflareD1Client {
  private baseUrl: string;
  private headers: HeadersInit;

  constructor() {
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${DATABASE_ID}`;
    this.headers = {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    };
  }

  async executeQuery<T>(sql: string, params: any[] = []): Promise<T[]> {
    try {
      const response = await fetch(`${this.baseUrl}/query`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          sql,
          params,
        }),
      });

      if (!response.ok) {
        throw new Error(`Cloudflare D1 API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(`Cloudflare D1 query failed: ${JSON.stringify(data.errors)}`);
      }

      return data.result[0]?.results || [];
    } catch (error) {
      console.error('Error executing Cloudflare D1 query:', error);
      throw error;
    }
  }

  // Flow Steps
  async getFlowSteps(): Promise<FlowStep[]> {
    const sql = `
      SELECT * FROM flow_steps 
      ORDER BY flow_id, order_index
    `;
    return this.executeQuery<FlowStep>(sql);
  }

  async getFlowStepById(id: number): Promise<FlowStep | null> {
    const sql = `SELECT * FROM flow_steps WHERE id = ?`;
    const results = await this.executeQuery<FlowStep>(sql, [id]);
    return results[0] || null;
  }

  async getFlowStepByKey(stepKey: string): Promise<FlowStep | null> {
    const sql = `SELECT * FROM flow_steps WHERE step_key = ?`;
    const results = await this.executeQuery<FlowStep>(sql, [stepKey]);
    return results[0] || null;
  }

  async getFlowStepsByFlowId(flowId: string): Promise<FlowStep[]> {
    const sql = `SELECT * FROM flow_steps WHERE flow_id = ? ORDER BY order_index`;
    return this.executeQuery<FlowStep>(sql, [flowId]);
  }

  // Flow Step Conditions
  async getFlowStepConditions(flowStepId: number): Promise<FlowStepCondition[]> {
    const sql = `SELECT * FROM flow_step_conditions WHERE flow_step_id = ? ORDER BY id`;
    return this.executeQuery<FlowStepCondition>(sql, [flowStepId]);
  }

  async getFlowConditions(): Promise<FlowCondition[]> {
    const sql = `SELECT * FROM flow_conditions ORDER BY condition_key`;
    return this.executeQuery<FlowCondition>(sql);
  }

  // Combined data for step page
  async getStepWithConditions(stepKey: string): Promise<{
    step: FlowStep;
    conditions: FlowStepCondition[];
    allConditions: FlowCondition[];
  } | null> {
    const step = await this.getFlowStepByKey(stepKey);
    if (!step) return null;

    const [conditions, allConditions] = await Promise.all([
      this.getFlowStepConditions(step.id),
      this.getFlowConditions(),
    ]);

    return { step, conditions, allConditions };
  }

  // Create/Update/Delete operations
  async createFlowStep(step: Omit<FlowStep, 'id' | 'created_at' | 'updated_at'>): Promise<FlowStep> {
    const sql = `
      INSERT INTO flow_steps (flow_id, step_key, title, step_type, order_index, input_keys, payload_template)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `;
    const params = [
      step.flow_id,
      step.step_key,
      step.title,
      step.step_type,
      step.order_index,
      step.input_keys,
      step.payload_template,
    ];
    const results = await this.executeQuery<FlowStep>(sql, params);
    return results[0];
  }

  async updateFlowStep(id: number, updates: Partial<FlowStep>): Promise<FlowStep> {
    const fields = [];
    const params = [];
    
    if (updates.title !== undefined) {
      fields.push('title = ?');
      params.push(updates.title);
    }
    if (updates.step_type !== undefined) {
      fields.push('step_type = ?');
      params.push(updates.step_type);
    }
    if (updates.order_index !== undefined) {
      fields.push('order_index = ?');
      params.push(updates.order_index);
    }
    if (updates.input_keys !== undefined) {
      fields.push('input_keys = ?');
      params.push(updates.input_keys);
    }
    if (updates.payload_template !== undefined) {
      fields.push('payload_template = ?');
      params.push(updates.payload_template);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    params.push(id);
    const sql = `
      UPDATE flow_steps 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      RETURNING *
    `;
    const results = await this.executeQuery<FlowStep>(sql, params);
    return results[0];
  }

  async deleteFlowStep(id: number): Promise<boolean> {
    const sql = `DELETE FROM flow_steps WHERE id = ?`;
    await this.executeQuery(sql, [id]);
    return true;
  }
}

export const cloudflareD1 = new CloudflareD1Client();