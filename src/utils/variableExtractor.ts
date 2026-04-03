/**
 * Utility functions for extracting variables from API responses
 */

/**
 * Extract variables from API response based on response_path or flatten the response
 * @param responseData The API response data
 * @param responsePath Optional dot notation path to extract specific values
 * @returns Object with extracted variables
 */
export function extractVariablesFromResponse(
  responseData: any,
  responsePath?: string
): Record<string, any> {
  const variables: Record<string, any> = {};

  try {
    // If response_path is provided, extract specific value
    if (responsePath && responsePath.trim()) {
      const value = getValueByPath(responseData, responsePath);
      if (value !== undefined) {
        // Use the last part of the path as variable name, or a default name
        const pathParts = responsePath.split('.');
        const varName = pathParts[pathParts.length - 1];
        variables[varName] = value;
      }
    } else {
      // Flatten the entire response object
      flattenObject(responseData, '', variables);
    }
  } catch (error) {
    console.error(`[VariableExtractor] Error extracting variables: ${error}`);
  }

  return variables;
}

/**
 * Get value from object by dot notation path
 * @param obj Object to traverse
 * @param path Dot notation path (e.g., "data.user.name")
 * @returns Value at path or undefined
 */
function getValueByPath(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

/**
 * Flatten nested object into dot notation keys
 * @param obj Object to flatten
 * @param prefix Current prefix for nested keys
 * @param result Result object to populate
 */
function flattenObject(obj: any, prefix: string, result: Record<string, any>): void {
  if (obj === null || obj === undefined) {
    return;
  }

  if (typeof obj === 'object' && !Array.isArray(obj)) {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        const newPrefix = prefix ? `${prefix}.${key}` : key;
        
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          // Recursively flatten nested objects
          flattenObject(value, newPrefix, result);
        } else if (Array.isArray(value)) {
          // Handle arrays - store as JSON string
          result[newPrefix] = JSON.stringify(value);
        } else {
          // Store primitive values directly
          result[newPrefix] = value;
        }
      }
    }
  } else if (Array.isArray(obj)) {
    // Store arrays as JSON string
    result[prefix || 'response'] = JSON.stringify(obj);
  } else {
    // Store primitive values directly
    result[prefix || 'response'] = obj;
  }
}

/**
 * Generate variable ID for storage
 * @param flowRunId Flow run ID
 * @param key Variable key
 * @returns Generated ID
 */
export function generateVariableId(flowRunId: string, key: string): string {
  return `${flowRunId}_${key}_${Date.now()}`;
}

/**
 * Check if a value should be stored as a variable
 * @param value Value to check
 * @returns True if value should be stored
 */
export function shouldStoreAsVariable(value: any): boolean {
  // Don't store null, undefined, or empty objects
  if (value === null || value === undefined) {
    return false;
  }
  
  // Don't store empty objects
  if (typeof value === 'object' && Object.keys(value).length === 0) {
    return false;
  }
  
  // Don't store empty strings
  if (typeof value === 'string' && value.trim() === '') {
    return false;
  }
  
  return true;
}