// Mock endpoints data for development
export interface Endpoint {
  id: string;
  name: string;
  url: string;
  method: string;
  description: string;
  auth_type: 'none' | 'bearer' | 'basic' | 'api_key';
  auth_value?: string;
  headers: Record<string, string>;
  body_template?: string;
  query_params?: Record<string, string>;
  response_path?: string;
  timeout_ms: number;
  max_retries: number;
  retry_delay_ms: number;
  cache_key?: string;
  cache_ttl_seconds: number;
  encrypt_cache: boolean;
  response_validator?: string;
  allowed_domains: string[];
  require_https: boolean;
  log_level: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  tags: string[];
  ai_enabled: boolean;
  endpoint_type: 'external_api' | 'internal_command' | 'webhook';
  parameter_schema: Record<string, any>;
  response_schema?: Record<string, any>;
  output_variables?: string[]; // Variables this endpoint produces
  input_variables?: string[]; // Variables this endpoint consumes
}

export const mockEndpoints: Endpoint[] = [
  {
    id: 'endpoint_1',
    name: 'get_user_profile',
    url: 'https://api.example.com/users/{user_id}',
    method: 'GET',
    description: 'Get user profile information',
    auth_type: 'bearer',
    auth_value: '{{api_token}}',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    query_params: {
      'include': 'profile,preferences'
    },
    response_path: 'data',
    timeout_ms: 5000,
    max_retries: 3,
    retry_delay_ms: 1000,
    cache_ttl_seconds: 300,
    encrypt_cache: false,
    allowed_domains: ['api.example.com'],
    require_https: true,
    log_level: 'info',
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-01-15T10:30:00Z',
    created_by: 'system',
    tags: ['user', 'profile', 'authentication'],
    ai_enabled: true,
    endpoint_type: 'external_api',
    parameter_schema: {
      user_id: {
        type: 'string',
        required: true,
        description: 'User ID to fetch profile for'
      },
      api_token: {
        type: 'string',
        required: true,
        description: 'API authentication token'
      }
    },
    response_schema: {
      id: { type: 'string', description: 'User ID' },
      name: { type: 'string', description: 'Full name' },
      email: { type: 'string', description: 'Email address' },
      role: { type: 'string', description: 'User role' },
      created_at: { type: 'string', description: 'Account creation date' }
    },
    output_variables: ['user_profile', 'user_name', 'user_email', 'user_role'],
    input_variables: ['user_id', 'api_token']
  },
  {
    id: 'endpoint_2',
    name: 'search_tasks',
    url: 'https://api.example.com/tasks',
    method: 'GET',
    description: 'Search for tasks with filters',
    auth_type: 'bearer',
    auth_value: '{{api_token}}',
    headers: {
      'Content-Type': 'application/json'
    },
    query_params: {
      'status': '{{status}}',
      'assignee': '{{assignee_id}}',
      'project': '{{project_id}}'
    },
    response_path: 'tasks',
    timeout_ms: 8000,
    max_retries: 2,
    retry_delay_ms: 2000,
    cache_ttl_seconds: 60,
    encrypt_cache: false,
    allowed_domains: ['api.example.com'],
    require_https: true,
    log_level: 'info',
    created_at: '2024-01-16T14:20:00Z',
    updated_at: '2024-01-16T14:20:00Z',
    created_by: 'system',
    tags: ['tasks', 'search', 'filter'],
    ai_enabled: true,
    endpoint_type: 'external_api',
    parameter_schema: {
      status: {
        type: 'string',
        required: false,
        description: 'Task status filter',
        enum: ['open', 'in_progress', 'completed', 'blocked']
      },
      assignee_id: {
        type: 'string',
        required: false,
        description: 'Assignee user ID'
      },
      project_id: {
        type: 'string',
        required: false,
        description: 'Project ID'
      },
      api_token: {
        type: 'string',
        required: true,
        description: 'API authentication token'
      }
    },
    response_schema: {
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string' },
            assignee: { type: 'string' },
            due_date: { type: 'string' }
          }
        }
      },
      total: { type: 'number' },
      page: { type: 'number' },
      page_size: { type: 'number' }
    },
    output_variables: ['tasks_list', 'total_tasks', 'current_page'],
    input_variables: ['status', 'assignee_id', 'project_id', 'api_token']
  },
  {
    id: 'endpoint_3',
    name: 'create_document',
    url: 'https://api.example.com/documents',
    method: 'POST',
    description: 'Create a new document',
    auth_type: 'bearer',
    auth_value: '{{api_token}}',
    headers: {
      'Content-Type': 'application/json'
    },
    body_template: JSON.stringify({
      title: '{{document_title}}',
      content: '{{document_content}}',
      author: '{{author_id}}',
      tags: '{{tags}}'
    }, null, 2),
    response_path: 'document',
    timeout_ms: 10000,
    max_retries: 3,
    retry_delay_ms: 1000,
    cache_ttl_seconds: 0,
    encrypt_cache: false,
    allowed_domains: ['api.example.com'],
    require_https: true,
    log_level: 'debug',
    created_at: '2024-01-17T09:15:00Z',
    updated_at: '2024-01-17T09:15:00Z',
    created_by: 'admin',
    tags: ['documents', 'create', 'content'],
    ai_enabled: true,
    endpoint_type: 'external_api',
    parameter_schema: {
      document_title: {
        type: 'string',
        required: true,
        description: 'Document title'
      },
      document_content: {
        type: 'string',
        required: true,
        description: 'Document content'
      },
      author_id: {
        type: 'string',
        required: true,
        description: 'Author user ID'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        required: false,
        description: 'Document tags'
      },
      api_token: {
        type: 'string',
        required: true,
        description: 'API authentication token'
      }
    },
    response_schema: {
      id: { type: 'string' },
      title: { type: 'string' },
      content: { type: 'string' },
      author: { type: 'string' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' },
      url: { type: 'string' }
    },
    output_variables: ['document_id', 'document_url', 'created_document'],
    input_variables: ['document_title', 'document_content', 'author_id', 'tags', 'api_token']
  },
  {
    id: 'endpoint_4',
    name: 'analyze_sentiment',
    url: 'https://ai-api.example.com/sentiment',
    method: 'POST',
    description: 'Analyze text sentiment using AI',
    auth_type: 'api_key',
    auth_value: '{{ai_api_key}}',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': '{{ai_api_key}}'
    },
    body_template: JSON.stringify({
      text: '{{text_to_analyze}}',
      language: '{{language}}',
      detailed: '{{detailed_analysis}}'
    }, null, 2),
    response_path: 'result',
    timeout_ms: 15000,
    max_retries: 2,
    retry_delay_ms: 3000,
    cache_ttl_seconds: 3600,
    encrypt_cache: true,
    allowed_domains: ['ai-api.example.com'],
    require_https: true,
    log_level: 'info',
    created_at: '2024-01-18T11:45:00Z',
    updated_at: '2024-01-18T11:45:00Z',
    created_by: 'ai_system',
    tags: ['ai', 'sentiment', 'analysis', 'nlp'],
    ai_enabled: true,
    endpoint_type: 'external_api',
    parameter_schema: {
      text_to_analyze: {
        type: 'string',
        required: true,
        description: 'Text to analyze for sentiment'
      },
      language: {
        type: 'string',
        required: false,
        description: 'Text language',
        default: 'en'
      },
      detailed_analysis: {
        type: 'boolean',
        required: false,
        description: 'Whether to return detailed analysis',
        default: false
      },
      ai_api_key: {
        type: 'string',
        required: true,
        description: 'AI API key'
      }
    },
    response_schema: {
      sentiment: { 
        type: 'string',
        enum: ['positive', 'negative', 'neutral', 'mixed']
      },
      confidence: { type: 'number' },
      score: { type: 'number' },
      entities: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            type: { type: 'string' },
            sentiment: { type: 'string' }
          }
        }
      },
      summary: { type: 'string' }
    },
    output_variables: ['sentiment_result', 'sentiment_score', 'confidence_level', 'entities_found'],
    input_variables: ['text_to_analyze', 'language', 'detailed_analysis', 'ai_api_key']
  },
  {
    id: 'endpoint_5',
    name: 'send_notification',
    url: 'https://notifications.example.com/send',
    method: 'POST',
    description: 'Send notification to user',
    auth_type: 'bearer',
    auth_value: '{{notification_token}}',
    headers: {
      'Content-Type': 'application/json'
    },
    body_template: JSON.stringify({
      user_id: '{{user_id}}',
      message: '{{notification_message}}',
      type: '{{notification_type}}',
      priority: '{{priority}}'
    }, null, 2),
    response_path: 'notification',
    timeout_ms: 5000,
    max_retries: 1,
    retry_delay_ms: 1000,
    cache_ttl_seconds: 0,
    encrypt_cache: false,
    allowed_domains: ['notifications.example.com'],
    require_https: true,
    log_level: 'info',
    created_at: '2024-01-19T16:30:00Z',
    updated_at: '2024-01-19T16:30:00Z',
    created_by: 'system',
    tags: ['notifications', 'messaging', 'alerts'],
    ai_enabled: false,
    endpoint_type: 'external_api',
    parameter_schema: {
      user_id: {
        type: 'string',
        required: true,
        description: 'User ID to notify'
      },
      notification_message: {
        type: 'string',
        required: true,
        description: 'Notification message content'
      },
      notification_type: {
        type: 'string',
        required: false,
        description: 'Type of notification',
        enum: ['email', 'push', 'sms', 'in_app'],
        default: 'in_app'
      },
      priority: {
        type: 'string',
        required: false,
        description: 'Notification priority',
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
      },
      notification_token: {
        type: 'string',
        required: true,
        description: 'Notification service token'
      }
    },
    response_schema: {
      id: { type: 'string' },
      status: { type: 'string' },
      sent_at: { type: 'string' },
      estimated_delivery: { type: 'string' }
    },
    output_variables: ['notification_id', 'notification_status', 'sent_time'],
    input_variables: ['user_id', 'notification_message', 'notification_type', 'priority', 'notification_token']
  }
];

// Helper function to get all available variables from endpoints
export function getEndpointVariables(): Array<{
  category: string;
  name: string;
  description: string;
  endpoint_id: string;
  endpoint_name: string;
  variable_type: 'input' | 'output';
}> {
  const variables: Array<{
    category: string;
    name: string;
    description: string;
    endpoint_id: string;
    endpoint_name: string;
    variable_type: 'input' | 'output';
  }> = [];

  mockEndpoints.forEach(endpoint => {
    // Add input variables
    if (endpoint.input_variables) {
      endpoint.input_variables.forEach(varName => {
        variables.push({
          category: 'endpoint_input',
          name: varName,
          description: `Input for ${endpoint.name}: ${varName}`,
          endpoint_id: endpoint.id,
          endpoint_name: endpoint.name,
          variable_type: 'input'
        });
      });
    }

    // Add output variables
    if (endpoint.output_variables) {
      endpoint.output_variables.forEach(varName => {
        variables.push({
          category: 'endpoint_output',
          name: varName,
          description: `Output from ${endpoint.name}: ${varName}`,
          endpoint_id: endpoint.id,
          endpoint_name: endpoint.name,
          variable_type: 'output'
        });
      });
    }
  });

  return variables;
}

// Helper to get endpoint by name
export function getEndpointByName(name: string): Endpoint | undefined {
  return mockEndpoints.find(ep => ep.name === name);
}

// Helper to get endpoints by tag
export function getEndpointsByTag(tag: string): Endpoint[] {
  return mockEndpoints.filter(ep => ep.tags.includes(tag));
}