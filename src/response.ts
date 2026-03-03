/**
 * Standard API response format
 */
export function apiResponse(success: boolean, data: any | null = null, error: string | null = null, statusCode: number = 200) {
  return {
    success,
    data,
    error,
    statusCode
  };
}

/**
 * Success response helper
 */
export function successResponse(data: any, statusCode: number = 200) {
  return apiResponse(true, data, null, statusCode);
}

/**
 * Error response helper
 */
export function errorResponse(error: string, statusCode: number = 500) {
  return apiResponse(false, null, error, statusCode);
}

/**
 * Not found response helper
 */
export function notFoundResponse(message: string = 'Resource not found') {
  return errorResponse(message, 404);
}

/**
 * Validation error response helper
 */
export function validationErrorResponse(message: string = 'Validation failed') {
  return errorResponse(message, 400);
}