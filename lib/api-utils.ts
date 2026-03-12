/**
 * Utility functions for handling API responses
 * Different backend APIs return different formats:
 * - Some return {success: true, data: [...], error: null, statusCode: 200}
 * - Some return array directly [...]
 */

export function parseApiResponse<T>(response: any): T[] {
  // If response is an array, return it directly
  if (Array.isArray(response)) {
    return response;
  }
  
  // If response has success and data fields
  if (response && typeof response === 'object' && 'success' in response && 'data' in response) {
    if (response.success && Array.isArray(response.data)) {
      return response.data;
    }
  }
  
  // If response has data field (even without success)
  if (response && typeof response === 'object' && 'data' in response && Array.isArray(response.data)) {
    return response.data;
  }
  
  // Default: try to return as array or empty array
  return Array.isArray(response) ? response : [];
}