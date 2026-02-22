# Secure Dynamic API Data Fetching System

## Overview

This implementation replaces the old `requires_task`/`task_id` system with a secure, flexible dynamic API data fetching system using `input_keys`. The system allows flow steps to fetch data from external APIs, resolve dependencies between API calls, and safely substitute variables in step instructions.

## Key Features

### 1. **Secure API Configuration**
- URL validation with domain allowlist
- HTTPS enforcement for external APIs
- Environment variable resolution (`env:VAR_NAME`)
- Authentication support (Bearer, Basic, API Key, Custom)
- Circuit breaker pattern for fault tolerance
- Request timeout and retry logic

### 2. **Dynamic Variable Resolution**
- Template syntax: `{* variable_name *}`
- Nested variable access: `{* user.profile.name *}`
- Dependency resolution between API calls
- Parallel execution for independent calls
- Sequential execution for dependent calls

### 3. **Security First**
- HTML sanitization for string variables
- Sensitive data redaction in logs
- Response validation (status codes, required fields)
- Request size limits
- JSON depth limits

### 4. **Backward Compatibility**
- Existing `requires_task` steps continue to work
- Automatic fallback to old system if new system fails
- Migration utilities to convert old steps
- Deprecation warnings for old fields

## Architecture

### Core Components

1. **`SecureVariableResolver`** (`src/services/secureVariableResolver.ts`)
   - Main class for API execution and variable resolution
   - Handles security validation, circuit breaking, caching
   - Manages API dependencies and parallel/sequential execution

2. **`StepResolver`** (`src/services/stepResolver.ts`)
   - Backward compatibility wrapper
   - Chooses between new `input_keys` system and old `task_id` system
   - Provides validation and example generation

3. **`SecureMigration`** (`src/services/secureMigration.ts`)
   - Migration utilities with security auditing
   - Generates migration SQL and reports
   - Validates configurations before migration

4. **Type Definitions** (`src/types/secureTypes.ts`)
   - Comprehensive TypeScript interfaces
   - Error classes with security context
   - Configuration interfaces

5. **Security Configuration** (`src/config/security.json`)
   - Domain allowlist
   - Timeout settings
   - Logging configuration
   - Circuit breaker settings

## Database Schema Update

### Migration: `0021_add_input_keys_column.sql`
```sql
-- Add input_keys column to flow_steps table
ALTER TABLE flow_steps ADD COLUMN IF NOT EXISTS input_keys TEXT;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_flow_steps_input_keys 
ON flow_steps(input_keys) WHERE input_keys IS NOT NULL;
```

### Updated Queries
- `getFlowSteps()` in `database.ts` - now includes `input_keys`
- `getStepWithTaskData()` in `database.ts` - now includes `input_keys`
- `StepData` interface updated with `input_keys?: string`

## Usage Examples

### 1. Simple GET Request
```json
{
  "input_keys": [
    {
      "key": "user_data",
      "url": "https://api.example.com/users/current",
      "method": "GET",
      "auth_type": "bearer",
      "auth_value": "env:API_TOKEN",
      "timeout_ms": 10000,
      "response_path": "data.user",
      "allowed_domains": ["api.example.com"]
    }
  ]
}
```

Step instructions: `"Hello {* user_data.name *}, welcome!"`

### 2. Dependent API Calls
```json
{
  "input_keys": [
    {
      "key": "user",
      "url": "https://api.example.com/users/{user_id}",
      "method": "GET",
      "auth_type": "bearer",
      "auth_value": "env:API_TOKEN"
    },
    {
      "key": "projects",
      "url": "https://api.example.com/users/{user.id}/projects",
      "method": "GET",
      "depends_on": ["user"],
      "auth_type": "bearer",
      "auth_value": "env:API_TOKEN",
      "response_path": "data.projects"
    }
  ]
}
```

Step instructions: `"User {* user.name *} has {* projects.length *} projects"`

### 3. Internal Task Lookup (Backward Compatibility)
```json
{
  "input_keys": [
    {
      "key": "task_data",
      "url": "internal://tasks/task_123",
      "method": "GET",
      "auth_type": "none",
      "timeout_ms": 5000,
      "response_path": "description",
      "allowed_domains": ["internal"],
      "require_https": false
    }
  ]
}
```

Step instructions: `"Complete task: {* task_data.description *}"`

## Migration Process

### Phase 1: Schema Update
1. Run migration SQL to add `input_keys` column
2. Update application code to include `input_keys` in queries

### Phase 2: Data Migration
```bash
# Generate migration SQL
node scripts/migrate-simple.js

# Or run interactive migration
node scripts/migrate-requires-task.js --dry-run
node scripts/migrate-requires-task.js
```

### Phase 3: Testing
1. Test migrated steps in staging
2. Monitor logs for API errors
3. Update step instructions to use new syntax

### Phase 4: Rollout
1. Enable new system for new flows
2. Gradually migrate existing flows
3. Monitor performance and errors

## Security Considerations

### 1. **URL Validation**
- All external URLs must use HTTPS
- Domains must be in allowlist (`security.json`)
- Internal URLs (`localhost`, `127.0.0.1`) are allowed

### 2. **Authentication**
- Use `env:` prefix for environment variables
- Never hardcode tokens in configurations
- Support for Bearer, Basic, API Key, and custom auth

### 3. **Data Sanitization**
- HTML entities escaped in string variables
- Sensitive fields redacted in logs
- Response size limits enforced

### 4. **Error Handling**
- Circuit breaker prevents cascading failures
- Retry logic with exponential backoff
- Graceful degradation on API failures

## Testing

### Unit Tests
```bash
# Test SecureVariableResolver
npm test -- tests/secureVariableResolver.test.ts

# Test StepResolver
npm test -- tests/stepResolver.test.ts

# Test SecureMigration
npm test -- tests/secureMigration.test.ts
```

### Integration Tests
```bash
# Test full system
npm test -- tests/integration.test.ts
```

## Monitoring and Logging

### Key Metrics to Monitor
- API success/failure rates
- Circuit breaker state changes
- Cache hit rates
- Response times
- Security violations

### Log Fields
- Redacted sensitive data
- API call duration
- Dependency resolution
- Template substitution results

## Backward Compatibility

### Old System (Deprecated)
```typescript
// Still works during transition
{
  "requires_task": true,
  "task_id": "task_123"
}
```

### New System (Recommended)
```typescript
{
  "input_keys": "[{...}]"  // JSON array of SecureApiConfig
}
```

### Fallback Logic
1. Try `input_keys` first (new system)
2. If fails and `auto_fail_on_error` is false, fall back to `task_id`
3. If no `input_keys`, use `task_id` system

## Performance Considerations

### Caching
- Configurable TTL per API call
- Shared cache between steps
- Optional encryption for sensitive data

### Parallel Execution
- Independent API calls executed in parallel
- Dependent calls executed sequentially
- Configurable maximum parallel requests

### Circuit Breaker
- Opens after configurable failure threshold
- Half-open state for testing recovery
- Automatic reset after timeout

## Future Enhancements

### Planned Features
1. **GraphQL Support** - Native GraphQL query execution
2. **WebSocket Support** - Real-time data streaming
3. **Batch Operations** - Combine multiple API calls
4. **Response Transformation** - Data mapping and transformation
5. **Rate Limiting** - Per-API rate limits

### Optional Integrations
1. **OpenTelemetry** - Distributed tracing
2. **Prometheus** - Metrics collection
3. **Sentinel** - Advanced circuit breaking
4. **Vault** - Secret management

## Troubleshooting

### Common Issues

1. **API Calls Failing**
   - Check domain allowlist
   - Verify HTTPS requirement
   - Check authentication configuration

2. **Variables Not Substituting**
   - Verify JSON syntax in `input_keys`
   - Check variable names match `key` fields
   - Verify response path extracts correct data

3. **Performance Issues**
   - Check circuit breaker state
   - Review cache configuration
   - Monitor dependency graph

4. **Security Violations**
   - Review security configuration
   - Check for non-HTTPS URLs
   - Verify environment variables exist

### Debugging
```typescript
// Enable debug logging
const resolver = new SecureVariableResolver(env, {
  logging: { level: 'debug' }
});

// Get logs
const logs = resolver.getLogs();
console.log('Resolver logs:', logs);
```

## Conclusion

This secure dynamic API data fetching system provides a robust, secure, and flexible replacement for the old `requires_task` system. It enables flow steps to fetch data from any API, resolve complex dependencies, and safely inject dynamic content into instructions.

The system is designed with security as a first-class concern, featuring comprehensive validation, sanitization, and monitoring capabilities. Backward compatibility ensures a smooth migration path, while the new architecture supports future enhancements and integrations.

For questions or issues, refer to the test suite, migration scripts, and security configuration documentation.