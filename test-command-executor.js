// Simple test to verify CommandExecutor URL construction logic

function buildCommandUrlOld(endpoint, params) {
  let url = endpoint;
  
  // Replace path parameters
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' || typeof value === 'number') {
        url = url.replace(`:${key}`, encodeURIComponent(value.toString()));
      }
    }
  }
  
  // Add query parameters for GET/DELETE
  if (params && ['GET', 'DELETE'].includes(url.split(' ')[0]?.toUpperCase() || '')) {
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (!url.includes(`:${key}`)) { // Skip path params
        queryParams.append(key, value.toString());
      }
    }
    
    const queryString = queryParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }
  
  return url;
}

function buildCommandUrlNew(endpoint, params, method) {
  let url = endpoint;
  const usedPathParams = new Set();
  
  // Replace path parameters and track which ones were used
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' || typeof value === 'number') {
        const paramPlaceholder = `:${key}`;
        if (url.includes(paramPlaceholder)) {
          url = url.replace(paramPlaceholder, encodeURIComponent(value.toString()));
          usedPathParams.add(key);
        }
      }
    }
  }
  
  // Add query parameters for GET/DELETE requests
  // For POST/PUT/PATCH, params go in the request body, not query string
  if (params && method && ['GET', 'DELETE'].includes(method.toUpperCase())) {
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      // Skip path params that were already used in the URL
      if (!usedPathParams.has(key)) {
        queryParams.append(key, value.toString());
      }
    }
    
    const queryString = queryParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }
  
  return url;
}

// Test cases
console.log('Testing URL construction:');
console.log('=======================');

// Test 1: Simple GET request with /api/tasks endpoint
const endpoint1 = '/api/tasks';
const params1 = { limit: 10, offset: 0 };
console.log('\nTest 1: GET /api/tasks with query params');
console.log('Old method:', buildCommandUrlOld(endpoint1, params1));
console.log('New method:', buildCommandUrlNew(endpoint1, params1, 'GET'));

// Test 2: POST request with /api/tasks endpoint
console.log('\nTest 2: POST /api/tasks with body params');
console.log('Old method:', buildCommandUrlOld(endpoint1, params1));
console.log('New method:', buildCommandUrlNew(endpoint1, params1, 'POST'));

// Test 3: Endpoint with path parameter
const endpoint2 = '/api/tasks/:id';
const params2 = { id: 123, detailed: true };
console.log('\nTest 3: GET /api/tasks/:id with path and query params');
console.log('Old method:', buildCommandUrlOld(endpoint2, params2));
console.log('New method:', buildCommandUrlNew(endpoint2, params2, 'GET'));

// Test 4: What happens with endpoint that starts with "GET " (old bug scenario)
const endpoint3 = 'GET /api/tasks';
console.log('\nTest 4: Endpoint starting with "GET " (old bug scenario)');
console.log('Old method:', buildCommandUrlOld(endpoint3, params1));
console.log('New method:', buildCommandUrlNew(endpoint3, params1, 'GET'));