# Unified Endpoint System

## Overview

The unified endpoint system provides a centralized way to manage API endpoints, commands, and data flow between steps. It replaces the deprecated `input_keys` system with a more structured approach using an endpoint registry.

## Key Components

### 1. Endpoint Registry
Endpoints are registered in the `endpoint_registry` table with configuration:
- `endpoint_id`: Unique identifier
- `name`: Human-readable name
- `url`: API endpoint URL (supports template variables)
- `method`: HTTP method (GET, POST, etc.)
- `auth_type`: Authentication type (none, bearer, api_key)
- `headers`: Request headers
- `response_path`: JSON path to extract data from response
- `allowed_domains`: Security restrictions

### 2. Flow Step Configuration
Steps use the `use_endpoints` column (JSON array) instead of `input_keys`:

```json
[
  {
    "endpoint_id": "github-user-data",
    "phase": "input",
    "map": {
      "response.login": "user.username",
      "response.name": "user.full_name"
    },
    "params": {
      "username": "octocat"
    }
  }
]
```

### 3. Variable Structure
Responses are structured in a consistent format:

```javascript
{
  api: {
    endpoint_name: {
      response: { /* API response data */ }
    }
  },
  env: { /* Environment variables */ },
  previous_step: { /* Previous step outputs */ }
}
```

## How to Use

### 1. Creating an Endpoint

First, register an endpoint in the `endpoint_registry`:

```sql
INSERT INTO endpoint_registry (
  endpoint_id, name, description, url, method, auth_type,
  headers, timeout_ms, response_path, allowed_domains
) VALUES (
  'jsonplaceholder-posts',
  'JSONPlaceholder Posts',
  'Get posts from JSONPlaceholder API',
  'https://jsonplaceholder.typicode.com/posts/{id}',
  'GET',
  'none',
  '{"Content-Type": "application/json"}',
  5000,
  'data',
  '["jsonplaceholder.typicode.com"]'
);
```

### 2. Adding Endpoint to a Step

Configure a flow step to use the endpoint:

```sql
UPDATE flow_steps SET use_endpoints = '[
  {
    "endpoint_id": "jsonplaceholder-posts",
    "phase": "input",
    "map": {
      "response.title": "post.title",
      "response.body": "post.content"
    },
    "params": {
      "id": 1
    }
  }
]' WHERE step_id = 'my-step';
```

### 3. Using Variables in Step Instructions

Reference variables in step instructions using `{variable.path}` syntax:

```
Analyze the post: {api.post.response.title}

Content: {api.post.response.body}
```

### 4. Registering and Running Commands

Commands are endpoints with `phase: "command"`:

```json
{
  "endpoint_id": "analyze-data",
  "phase": "command",
  "params": {
    "operation": "sentiment-analysis",
    "text": "{api.post.response.body}"
  }
}
```

### 5. Handling Responses

Response data is automatically:
1. Stored in `step_runs.api_calls` column
2. Available as variables for subsequent steps
3. Mapped according to the `map` configuration

## Migration from Old System

### Old System (input_keys)
```json
"input_keys": "[
  {
    \"key\": \"user_data\",
    \"url\": \"https://api.example.com/users/1\",
    \"method\": \"GET\"
  }
]"
```

### New System (use_endpoints)
```json
"use_endpoints": "[
  {
    \"endpoint_id\": \"user-api\",
    \"phase\": \"input\",
    \"map\": {
      \"response.name\": \"user_data.name\"
    }
  }
]"
```

## Benefits

1. **Centralized Configuration**: Endpoints configured once, used everywhere
2. **Security**: Domain restrictions, authentication centralized
3. **Reusability**: Same endpoint can be used across multiple steps
4. **Maintainability**: Update endpoint configuration in one place
5. **Structured Variables**: Consistent variable naming and access

## Example: Complete Flow

### 1. Register Endpoints
```sql
-- GitHub user endpoint
INSERT INTO endpoint_registry VALUES (
  'github-user', 'GitHub User', 'Get GitHub user data',
  'https://api.github.com/users/{username}', 'GET', 'none',
  '{"Accept": "application/vnd.github.v3+json"}', 10000,
  'data', '["api.github.com"]'
);

-- Analysis command endpoint  
INSERT INTO endpoint_registry VALUES (
  'analyze-profile', 'Profile Analyzer', 'Analyze user profile',
  'https://analysis.example.com/analyze', 'POST', 'bearer',
  '{"Content-Type": "application/json"}', 15000,
  'result', '["analysis.example.com"]'
);
```

### 2. Configure Flow Step
```sql
UPDATE flow_steps SET use_endpoints = '[
  {
    "endpoint_id": "github-user",
    "phase": "input",
    "map": {
      "response.login": "github.user.login",
      "response.name": "github.user.name",
      "response.public_repos": "github.user.repo_count"
    },
    "params": {
      "username": "octocat"
    }
  },
  {
    "endpoint_id": "analyze-profile",
    "phase": "command", 
    "params": {
      "profile_data": "{api.github.user.response}"
    }
  }
]' WHERE step_id = 'analyze-github-profile';
```

### 3. Step Instructions
```
Analyze GitHub profile for {api.github.user.response.login}

User: {api.github.user.response.name}
Repositories: {api.github.user.response.public_repos}

Analysis Results: {api.analyze_profile.response.result.summary}
```

## Database Schema Updates

The system requires these columns:

### `flow_steps` table:
- `use_endpoints TEXT`: JSON array of endpoint configurations
- `extra_step BOOLEAN DEFAULT 0`: Flag for extra processing steps

### `step_runs` table:
- `api_calls TEXT`: JSON array of API call results

## Testing

Test the system with:

```bash
# Create a test flow step
curl -X POST "https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{db_id}/query" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "sql": "INSERT INTO flow_steps (step_id, step_key, title, instructions, use_endpoints) VALUES (\"test-step\", \"test\", \"Test Endpoint\", \"Test data: {api.test.response.value}\", \"[{\\\"endpoint_id\\\": \\\"jsonplaceholder-posts\\\", \\\"phase\\\": \\\"input\\\", \\\"map\\\": {\\\"response.title\\\": \\\"test.value\\\"}, \\\"params\\\": {\\\"id\\\": 1}}]\")"
  }'
```

## Troubleshooting

### Common Issues:

1. **Endpoint not found**: Verify endpoint exists in `endpoint_registry`
2. **Variable not resolving**: Check `map` configuration and variable paths
3. **API call failing**: Check endpoint URL, authentication, and domain restrictions
4. **JSON parsing errors**: Validate `use_endpoints` JSON syntax

### Debugging:
- Check `step_runs.api_calls` for API call details
- Verify endpoint configuration matches registry
- Test endpoint directly with curl first