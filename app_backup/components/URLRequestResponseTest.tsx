'use client';

import { useState } from 'react';

interface URLRequestResponseTestProps {
  // Component title
  title?: string;
  // Default values for the component
  defaultMethod?: string;
  defaultUrl?: string;
  defaultRequestBody?: string;
  defaultResponse?: string;
  defaultApiKey?: string;
  // Callback when test button is clicked
  onTest?: (method: string, url: string, requestBody: string, apiKey: string) => Promise<{
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
  }>;
}

export default function URLRequestResponseTest({
  title = 'Input',
  defaultMethod = 'POST',
  defaultUrl = 'https://api.example.com/endpoint',
  defaultRequestBody = '{\n  "method": "POST",\n  "headers": {\n    "Content-Type": "application/json"\n  },\n  "body": {\n    "key": "value"\n  }\n}',
  defaultResponse = '{\n  "status": "success",\n  "data": {\n    "id": 123,\n    "message": "Request processed successfully"\n  }\n}',
  defaultApiKey = '',
  onTest
}: URLRequestResponseTestProps) {
  const [method, setMethod] = useState(defaultMethod);
  const [url, setUrl] = useState(defaultUrl);
  const [requestBody, setRequestBody] = useState(defaultRequestBody);
  const [apiKey, setApiKey] = useState(defaultApiKey);
  const [response, setResponse] = useState(defaultResponse);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResponse, setShowResponse] = useState(false);

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
      
      setTestResult(`Test completed at ${new Date().toLocaleTimeString()}\n\nMethod: ${method}\n\nURL: ${url}\n\nAPI Key: ${apiKey ? '***' + apiKey.slice(-4) : 'Not provided'}\n\nRequest Body:\n${requestBody}`);
      setIsTesting(false);
      return;
    }

    try {
      setIsTesting(true);
      setError(null);
      setTestResult('Testing...');
      setShowResponse(true);
      
      const result = await onTest(method, url, requestBody, apiKey);
      
      // Format the response for display
      const formattedResponse = `Test completed at ${new Date().toLocaleTimeString()}\n\nMethod: ${method}\n\nStatus: ${result.status} ${result.statusText}\n\nHeaders:\n${JSON.stringify(result.headers, null, 2)}\n\nOutput Body:\n${result.body}`;
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
        {title}
      </h2>

      {/* Method and URL Input */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{
          display: 'block',
          fontSize: '0.875rem',
          fontWeight: '500',
          color: '#374151',
          marginBottom: '0.5rem'
        }}>
          HTTP Method & API Endpoint URL
        </label>
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center'
        }}>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            style={{
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontFamily: 'monospace',
              backgroundColor: 'white',
              minWidth: '120px',
              cursor: 'pointer'
            }}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
            <option value="HEAD">HEAD</option>
            <option value="OPTIONS">OPTIONS</option>
          </select>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={{
              flex: '1',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontFamily: 'monospace'
            }}
            placeholder="Enter API endpoint URL"
          />
        </div>
      </div>

      {/* API Key Input */}
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
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            fontSize: '1rem',
            fontFamily: 'monospace'
          }}
          placeholder="Enter your Cloudflare API token"
        />
        <div style={{
          marginTop: '0.5rem',
          fontSize: '0.75rem',
          color: '#6b7280'
        }}>
          This token is required for authenticating with the Cloudflare API.
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

      {/* Output Section - Always visible after test */}
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
            Output
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
              Output Body
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
              placeholder="Output will appear here after test"
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