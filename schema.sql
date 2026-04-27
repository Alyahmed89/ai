CREATE TABLE flows (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE steps (
  id UUID PRIMARY KEY,
  flow_id UUID NOT NULL,
  title TEXT NOT NULL,
  instructions TEXT NOT NULL,
  expected_response JSONB NOT NULL,
  order_index INT NOT NULL,
  next_flow_id UUID,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE step_conditions (
  id UUID PRIMARY KEY,
  step_id UUID NOT NULL,
  type TEXT NOT NULL,
  value TEXT,
  next_step_id UUID,
  next_flow_id UUID,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE flow_runs (
  id UUID PRIMARY KEY,
  flow_id UUID NOT NULL,
  status TEXT NOT NULL,
  input_variables JSONB,
  output_variables JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE step_runs (
  id UUID PRIMARY KEY,
  flow_run_id UUID NOT NULL,
  step_id UUID NOT NULL,
  status TEXT NOT NULL,
  rendered_instructions TEXT,
  resolved_variables JSONB,
  ai_response JSONB,
  ai_response_valid BOOLEAN,
  validation_errors JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE variables (
  id UUID PRIMARY KEY,
  flow_run_id UUID,
  step_run_id UUID,
  key TEXT NOT NULL,
  value JSONB,
  scope TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE endpoint_registry (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  method TEXT NOT NULL,
  headers JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE api_calls (
  id UUID PRIMARY KEY,
  flow_run_id UUID NOT NULL,
  step_run_id UUID,
  endpoint_id UUID,
  endpoint_name TEXT NOT NULL,
  http_method TEXT NOT NULL,
  request_url TEXT,
  request_headers JSONB,
  request_body JSONB,
  response_status INT,
  response_headers JSONB,
  response_body JSONB,
  success BOOLEAN,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL
);
