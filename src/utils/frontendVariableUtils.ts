/**
 * Frontend Variable Utilities for ƐĐᜃ syntax
 * These utilities help generate and work with variable tags in the frontend
 */

// Unicode constants for the variable tag
export const VARIABLE_START = 'ƐĐᜃ';
export const VARIABLE_END = 'ƐĐᜃ';

export interface VariableComponents {
  type: 'simple' | 'user' | 'system' | 'api' | 'step' | 'env';
  source: string;
  path: string;
  spec: string;
}

export interface VariableExample {
  name: string;
  tag: string;
  description: string;
  paths?: string[];
}

export interface VariableCategory {
  name: string;
  type: string;
  variables: VariableExample[];
}

export interface VariablePickerConfig {
  categories: VariableCategory[];
}

export interface VariableExplorerData {
  variables: Array<{
    key: string;
    value: any;
    type: string;
    tag: string;
    [key: string]: any;
  }>;
  apiResponses: Array<{
    endpoint_name: string;
    tag: string;
    availablePaths: string[];
    [key: string]: any;
  }>;
  stepResponses: Array<{
    step_id: string;
    tag: string;
    availablePaths: string[];
    [key: string]: any;
  }>;
  environmentVars: Array<{
    name: string;
    tag: string;
    [key: string]: any;
  }>;
}

export interface AvailableData {
  variables?: Array<{ key: string; value: any; variable_type: string; [key: string]: any }>;
  apiEndpoints?: Array<{ name: string; [key: string]: any }>;
  apiCalls?: Array<{ endpoint_name: string; [key: string]: any }>;
  steps?: Array<{ id: string; [key: string]: any }>;
  stepRuns?: Array<{ step_id: string; [key: string]: any }>;
}

/**
 * Generate a variable tag from components
 * @param type - Variable type: 'simple', 'user', 'system', 'api', 'step', 'env'
 * @param source - Source identifier (variable name, endpoint name, step id, etc.)
 * @param path - Dot notation path for nested values (optional)
 * @returns Formatted variable tag
 */
export function formatVariable(type: string, source: string, path: string = ''): string {
  if (!type || !source) {
    throw new Error('Type and source are required');
  }
  
  let spec: string;
  
  if (type === 'simple') {
    // Simple variable: ƐĐᜃtitleƐĐᜃ
    spec = source;
  } else if (path) {
    // Type:source:path format: ƐĐᜃapi:onepost:raw.titleƐĐᜃ
    spec = `${type}:${source}:${path}`;
  } else {
    // Type:source format: ƐĐᜃuser:nameƐĐᜃ
    spec = `${type}:${source}`;
  }
  
  return `${VARIABLE_START}${spec}${VARIABLE_END}`;
}

/**
 * Parse a variable tag into its components
 * @param tag - Variable tag (e.g., ƐĐᜃapi:onepost:raw.titleƐĐᜃ)
 * @returns Parsed components {type, source, path, spec}
 */
export function parseVariableTag(tag: string): VariableComponents {
  // Remove the ƐĐᜃ markers
  const spec = tag.replace(new RegExp(`${VARIABLE_START}|${VARIABLE_END}`, 'g'), '');
  
  if (spec.includes(':')) {
    const parts = spec.split(':');
    
    if (parts.length >= 3) {
      // Format: type:source:path
      const [type, source, ...pathParts] = parts;
      const path = pathParts.join('.');
      return { type: type as VariableComponents['type'], source, path, spec };
    } else if (parts.length === 2) {
      // Format: type:source
      const [type, source] = parts;
      return { type: type as VariableComponents['type'], source, path: '', spec };
    }
  }
  
  // Simple variable
  return { type: 'simple', source: spec, path: '', spec };
}

/**
 * Check if text contains variable tags
 * @param text - Text to check
 * @returns True if text contains variable tags
 */
export function hasVariableTags(text: string): boolean {
  if (!text) return false;
  const regex = new RegExp(`${VARIABLE_START}[^${VARIABLE_END}]+${VARIABLE_END}`, 'g');
  return regex.test(text);
}

/**
 * Extract all variable tags from text
 * @param text - Text to extract from
 * @returns Array of variable tags
 */
export function extractVariableTags(text: string): string[] {
  if (!text) return [];
  
  const regex = new RegExp(`${VARIABLE_START}[^${VARIABLE_END}]+${VARIABLE_END}`, 'g');
  const matches = text.match(regex) || [];
  return matches;
}

/**
 * Extract all variable specifications from text
 * @param text - Text to extract from
 * @returns Array of variable specifications (without ƐĐᜃ markers)
 */
export function extractVariableSpecs(text: string): string[] {
  const tags = extractVariableTags(text);
  return tags.map(tag => tag.replace(new RegExp(`${VARIABLE_START}|${VARIABLE_END}`, 'g'), ''));
}

/**
 * Generate example variable tags for different sources
 * @param sources - Available data sources
 * @returns Array of example variable tags
 */
export function generateExampleTags(sources: AvailableData = {}): string[] {
  const examples: string[] = [];
  
  // Simple variables
  examples.push(formatVariable('simple', 'title'));
  examples.push(formatVariable('simple', 'username'));
  examples.push(formatVariable('simple', 'email'));
  
  // User variables
  examples.push(formatVariable('user', 'name'));
  examples.push(formatVariable('user', 'email'));
  examples.push(formatVariable('user', 'preferences'));
  
  // System variables
  examples.push(formatVariable('system', 'timestamp'));
  examples.push(formatVariable('system', 'flow_id'));
  examples.push(formatVariable('system', 'step_id'));
  
  // API variables (if endpoints provided)
  if (sources.apiEndpoints && sources.apiEndpoints.length > 0) {
    sources.apiEndpoints.forEach(endpoint => {
      examples.push(formatVariable('api', endpoint.name, 'data'));
      examples.push(formatVariable('api', endpoint.name, 'raw'));
      examples.push(formatVariable('api', endpoint.name, 'raw.title'));
      examples.push(formatVariable('api', endpoint.name, 'raw.user.name'));
    });
  }
  
  // Step variables (if steps provided)
  if (sources.steps && sources.steps.length > 0) {
    sources.steps.forEach(step => {
      examples.push(formatVariable('step', step.id, 'response'));
      examples.push(formatVariable('step', step.id, 'output'));
    });
  }
  
  // Environment variables
  examples.push(formatVariable('env', 'API_KEY'));
  examples.push(formatVariable('env', 'BASE_URL'));
  
  return examples;
}

/**
 * Create a variable picker configuration
 * @param availableData - Available data sources
 * @returns Variable picker configuration
 */
export function createVariablePickerConfig(availableData: AvailableData = {}): VariablePickerConfig {
  const config: VariablePickerConfig = {
    categories: [
      {
        name: 'Simple Variables',
        type: 'simple',
        variables: ['title', 'username', 'email', 'name', 'description'].map(name => ({
          name,
          tag: formatVariable('simple', name),
          description: `Simple variable: ${name}`
        }))
      },
      {
        name: 'User Variables',
        type: 'user',
        variables: ['name', 'email', 'preferences', 'settings'].map(name => ({
          name,
          tag: formatVariable('user', name),
          description: `User variable: ${name}`
        }))
      },
      {
        name: 'System Variables',
        type: 'system',
        variables: ['timestamp', 'flow_id', 'flow_run_id', 'step_id', 'step_run_id'].map(name => ({
          name,
          tag: formatVariable('system', name),
          description: `System variable: ${name}`
        }))
      }
    ]
  };
  
  // Add API endpoints category if available
  if (availableData.apiEndpoints && availableData.apiEndpoints.length > 0) {
    config.categories.push({
      name: 'API Responses',
      type: 'api',
      variables: availableData.apiEndpoints.map(endpoint => ({
        name: endpoint.name,
        tag: formatVariable('api', endpoint.name, 'data'),
        description: `API response from ${endpoint.name}`,
        paths: ['data', 'raw', 'raw.title', 'raw.user', 'raw.user.name']
      }))
    });
  }
  
  // Add steps category if available
  if (availableData.steps && availableData.steps.length > 0) {
    config.categories.push({
      name: 'Step Responses',
      type: 'step',
      variables: availableData.steps.map(step => ({
        name: step.id,
        tag: formatVariable('step', step.id, 'response'),
        description: `Response from step ${step.id}`,
        paths: ['response', 'output', 'error']
      }))
    });
  }
  
  // Add environment variables category
  config.categories.push({
    name: 'Environment Variables',
    type: 'env',
    variables: ['API_KEY', 'BASE_URL', 'DATABASE_URL', 'SECRET_KEY'].map(name => ({
      name,
      tag: formatVariable('env', name),
      description: `Environment variable: ${name}`
    }))
  });
  
  return config;
}

/**
 * Insert variable tag at cursor position in a textarea
 * @param textarea - Textarea element
 * @param tag - Variable tag to insert
 */
export function insertVariableAtCursor(textarea: HTMLTextAreaElement, tag: string): void {
  if (!textarea) return;
  
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  
  // Insert the tag at cursor position
  textarea.value = text.substring(0, start) + tag + text.substring(end);
  
  // Move cursor to after the inserted tag
  textarea.selectionStart = textarea.selectionEnd = start + tag.length;
  
  // Focus back on the textarea
  textarea.focus();
  
  // Trigger input event for React/Vue/etc.
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Preview variable resolution in text
 * @param text - Text with variable tags
 * @param resolveFn - Function to resolve a variable spec to value
 * @returns Promise with text where variables are replaced by placeholders
 */
export async function previewVariableResolution(
  text: string, 
  resolveFn: (spec: string) => Promise<string>
): Promise<string> {
  if (!text || !resolveFn) return text;
  
  const tags = extractVariableTags(text);
  let previewText = text;
  
  for (const tag of tags) {
    const { spec } = parseVariableTag(tag);
    try {
      const value = await resolveFn(spec);
      // Replace with resolved value or placeholder
      const displayValue = value || `[${spec}]`;
      previewText = previewText.replace(tag, displayValue);
    } catch (error) {
      previewText = previewText.replace(tag, `[ERROR: ${spec}]`);
    }
  }
  
  return previewText;
}

/**
 * Create a variable explorer component data
 * @param availableData - Available data sources
 * @returns Variable explorer data
 */
export function createVariableExplorerData(availableData: AvailableData = {}): VariableExplorerData {
  const data: VariableExplorerData = {
    variables: [],
    apiResponses: [],
    stepResponses: [],
    environmentVars: []
  };
  
  // Add variables from availableData
  if (availableData.variables && availableData.variables.length > 0) {
    data.variables = availableData.variables.map(v => ({
      ...v,
      tag: formatVariable(v.variable_type === 'user_input' ? 'user' : 'system', v.key),
      type: v.variable_type === 'user_input' ? 'user' : 'system'
    }));
  }
  
  // Add API responses from availableData
  if (availableData.apiCalls && availableData.apiCalls.length > 0) {
    data.apiResponses = availableData.apiCalls.map(api => ({
      ...api,
      tag: formatVariable('api', api.endpoint_name, 'data'),
      availablePaths: ['data', 'raw', 'status', 'headers']
    }));
  }
  
  // Add step responses from availableData
  if (availableData.stepRuns && availableData.stepRuns.length > 0) {
    data.stepResponses = availableData.stepRuns.map(step => ({
      ...step,
      tag: formatVariable('step', step.step_id, 'response'),
      availablePaths: ['response', 'output', 'error', 'duration_ms']
    }));
  }
  
  return data;
}