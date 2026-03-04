'use client';

import { useState } from 'react';

interface URLRequestResponseTestProps {
  // Default values for the component
  defaultUrl?: string;
  defaultRequestBody?: string;
  defaultResponse?: string;
  defaultVariables?: Record<string, string>;
  // Callback when test button is clicked
  onTest?: (url: string, requestBody: string, variables: Record<string, string>) => Promise<{
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
  }>;
}

export default function URLRequestResponseTest({
  defaultUrl = 'https://api.example.com/endpoint',
  defaultRequestBody = '{\n  "method": "POST",\n  "headers": {\n    "Content-Type": "application/json"\n  },\n  "body": {\n    "key": "value"\n  }\n}',
  defaultResponse = '{\n  "status": "success",\n  "data": {\n    "id": 123,\n    "message": "Request processed successfully"\n  }\n}',
  defaultVariables = { '{{api_key}}': 'your_api_key_here', '{{user_id}}': '12345' },
  onTest
}: URLRequestResponseTestProps) {
  const [url, setUrl] = useState(defaultUrl);
  const [requestBody, setRequestBody] = useState(defaultRequestBody);
  const [response, setResponse] = useState(defaultResponse);
  const [variables, setVariables] = useState<Record<string, string>>(defaultVariables);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResponse, setShowResponse] = useState(false);
  // Handle variable updates
  const handleVariableChange = (key: string, value: string) => {
    setVariables(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Remove variable
  const handleRemoveVariable = (key: string) => {
    const newVariables = { ...variables };
    delete newVariables[key];
    setVariables(newVariables);
  };

  // Handle test button click
  const handleTest = async () => {
    if (!onTest) {
      // If no custom test handler, simulate a test
      setIsTesting(true);
      setError(null);
      setTestResult('Test simulation running...');
      setShowResponse(true);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Apply variables to request body
      let processedRequestBody = requestBody;
      Object.entries(variables).forEach(([key, value]) => {
        processedRequestBody = processedRequestBody.replace(new RegExp(key, 'g'), value);
      });
      
      setTestResult(`Test completed at ${new Date().toLocaleTimeString()}\n\nURL: ${url}\n\nProcessed Request Body:\n${processedRequestBody}`);
      setIsTesting(false);
      return;
    }

    try {
      setIsTesting(true);
      setError(null);
      setTestResult('Testing...');
      setShowResponse(true);
      
      const result = await onTest(url, requestBody, variables);
      
      // Format the response for display
      const formattedResponse = `Test completed at ${new Date().toLocaleTimeString()}\n\nStatus: ${result.status} ${result.statusText}\n\nHeaders:\n${JSON.stringify(result.headers, null, 2)}\n\nResponse Body:\n${result.body}`;
      setTestResult(formattedResponse);
      setResponse(result.body);
    } catch (err: any) {
      setError(err.message || 'Test failed');
      setTestResult(null);
      setShowResponse(true);
    } finally {
      setIsTesting(false);
    }
  };

  // Format JSON for display
  const formatJson = (text: string) => {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  };

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '0.75rem',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      padding: '2rem',
      marginBottom: '2rem'
    }}>
      <h2 style={{
        fontSize: '1.5rem',
        fontWeight: '600',
        color: '#111827',
        marginBottom: '1.5rem'
      }}>
        Input
      </h2>

      {/* URL Input */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{
          display: 'block',
          fontSize: '0.875rem',
          fontWeight: '500',
          color: '#374151',
          marginBottom: '0.5rem'
        }}>
          API Endpoint URL
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            fontSize: '1rem',
            fontFamily: 'monospace'
          }}
          placeholder="Enter API endpoint URL"
        />
      </div>

      {/* Token Display - Read only from variables */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{
          display: 'block',
          fontSize: '0.875rem',
          fontWeight: '500',
          color: '#374151',
          marginBottom: '0.5rem'
        }}>
          Cloudflare API Token
        </label>
        <input
          type="text"
          value={variables['{{auth_token}}'] || ''}
          readOnly
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            fontSize: '1rem',
            fontFamily: 'monospace',
            backgroundColor: '#f9fafb',
            color: '#6b7280'
          }}
          placeholder="Token will appear here from database configuration"
        />
        <div style={{
          marginTop: '0.5rem',
          fontSize: '0.75rem',
          color: '#6b7280'
        }}>
          This token is read-only and comes from the database configuration.
        </div>
      </div>

      {/* Request Body */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{
          display: 'block',
          fontSize: '0.875rem',
          fontWeight: '500',
          color: '#374151',
          marginBottom: '0.5rem'
        }}>
          Request Body (JSON)
        </label>
        <textarea
          value={requestBody}
          onChange={(e) => setRequestBody(e.target.value)}
          style={{
            width: '100%',
            minHeight: '200px',
            padding: '1rem',
            fontSize: '0.875rem',
            fontFamily: 'monospace',
            color: '#4b5563',
            lineHeight: '1.5',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            backgroundColor: '#f9fafb',
            resize: 'vertical'
          }}
          placeholder="Enter request JSON"
        />
        <div style={{
          marginTop: '0.5rem',
          fontSize: '0.75rem',
          color: '#6b7280'
        }}>
          Tip: Use variables like {'{{auth_token}}'}, {'{{api_url}}'}, {'{{http_method}}'} in your request. They will be replaced with values from the Variables section below.
        </div>
      </div>

      {/* Variables Section - Horizontal List */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{
          display: 'block',
          fontSize: '0.875rem',
          fontWeight: '500',
          color: '#374151',
          marginBottom: '0.5rem'
        }}>
          Variables
        </label>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '0.5rem'
        }}>
          {Object.entries(variables).map(([key, value]) => (
            <div
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#f3f4f6',
                borderRadius: '0.375rem',
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
                fontFamily: 'monospace'
              }}
            >
              <span style={{ color: '#374151', marginRight: '0.25rem' }}>{key}:</span>
              <span style={{ color: '#059669' }}>{value}</span>
              <button
                onClick={() => handleRemoveVariable(key)}
                style={{
                  marginLeft: '0.25rem',
                  padding: '0.125rem 0.25rem',
                  backgroundColor: 'transparent',
                  color: '#dc2626',
                  border: 'none',
                  borderRadius: '0.25rem',
                  cursor: 'pointer',
                  fontSize: '0.625rem'
                }}
              >
                ×
              </button>
            </div>
          ))}
          {Object.keys(variables).length === 0 && (
            <div style={{
              color: '#6b7280',
              fontSize: '0.75rem',
              fontStyle: 'italic'
            }}>
              No variables defined. Add variables below.
            </div>
          )}
        </div>
        

      </div>

      {/* Test Button */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        marginTop: '1.5rem',
        paddingTop: '1.5rem',
        borderTop: '1px solid #e5e7eb'
      }}>
        <button
          onClick={handleTest}
          disabled={isTesting}
          style={{
            padding: '0.75rem 2rem',
            backgroundColor: isTesting ? '#9ca3af' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: isTesting ? 'not-allowed' : 'pointer',
            fontWeight: '500',
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          {isTesting ? (
            <>
              <div style={{
                width: '1rem',
                height: '1rem',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTop: '2px solid white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              Testing...
            </>
          ) : (
            'Test API Request'
          )}
        </button>
      </div>

      {/* Response Section - Always visible after test */}
      {showResponse && (
        <div style={{
          marginTop: '2rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid #e5e7eb'
        }}>
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            color: '#111827',
            marginBottom: '1rem'
          }}>
            Response
          </h3>
          
          {testResult && (
            <div style={{
              marginBottom: '1rem',
              padding: '1rem',
              backgroundColor: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              color: '#0369a1'
            }}>
              <strong>Test Result:</strong>\n{testResult}
            </div>
          )}
          
          {error && (
            <div style={{
              marginBottom: '1rem',
              padding: '1rem',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              color: '#dc2626'
            }}>
              <strong>Error:</strong>\n{error}
            </div>
          )}
          
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Response Body
            </label>
            <textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              style={{
                width: '100%',
                minHeight: '200px',
                padding: '1rem',
                fontSize: '0.875rem',
                fontFamily: 'monospace',
                color: '#4b5563',
                lineHeight: '1.5',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                backgroundColor: '#f9fafb',
                resize: 'vertical'
              }}
              placeholder="Response will appear here after test"
              readOnly={!onTest}
            />
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}