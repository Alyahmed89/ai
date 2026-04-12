/**
 * Extract all unique variable names from text containing ƐĐᜃ tags
 */
export function extractVariableNames(text: string): string[] {
  if (!text) return [];
  
  // Match ƐĐᜃvariable_nameƐĐᜃ pattern
  const regex = /ƐĐᜃ([^ƐĐᜃ]+)ƐĐᜃ/g;
  const matches = [];
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1]);
  }
  
  // Remove duplicates and return
  return [...new Set(matches)];
}

/**
 * Extract variables from multiple text fields
 */
export function extractVariablesFromTexts(texts: string[]): string[] {
  const allVariables: string[] = [];
  
  for (const text of texts) {
    if (text) {
      const vars = extractVariableNames(text);
      allVariables.push(...vars);
    }
  }
  
  return [...new Set(allVariables)];
}

/**
 * Parse variable specification to get variable name
 * Handles formats like: user:name, flow_run:count, etc.
 */
export function parseVariableSpec(spec: string): { name: string; type?: string } {
  if (!spec) return { name: spec };
  
  // Check if it has a type prefix (e.g., user:, flow_run:, etc.)
  const parts = spec.split(':');
  if (parts.length > 1) {
    return { name: parts[1], type: parts[0] };
  }
  
  return { name: spec };
}

/**
 * Extract variables with their types from text
 */
export function extractVariablesWithTypes(text: string): Array<{name: string, type?: string}> {
  const variableNames = extractVariableNames(text);
  return variableNames.map(spec => parseVariableSpec(spec));
}