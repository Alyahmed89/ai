'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api-client';

interface APITestingUIProps {
  adminKey?: string;
}

export default function APITestingUI({ adminKey }: APITestingUIProps) {
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('');
  const [headers, setHeaders] = useState('{\n  "Content-Type": "application/json"\n}');
  const [body, setBody] = useState('{\n  \n}');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [response, setResponse] = useState<any>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);

  const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

  const handleSend = async () => {
    if (!url) {
      setError('URL is required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setResponse(null);
      setResponseTime(null);

      const startTime = Date.now();

      // Parse headers JSON
      let parsedHeaders = {};
      try {
        parsedHeaders = JSON.parse(headers);
      } catch (err) {
        setError(`Invalid headers JSON: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setLoading(false);
        return;
      }

      // Parse body JSON if method supports body
      let parsedBody = {};
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        try {
          parsedBody = JSON.parse(body);
        } catch (err) {
          setError(`Invalid body JSON: ${err instanceof Error ? err.message : 'Unknown error'}`);
          setLoading(false);
          return;
        }
      }

      // Add admin key to headers if provided
      const finalHeaders = { ...parsedHeaders };
      if (adminKey) {
        (finalHeaders as any)['x-admin-key'] = adminKey;
      }

      const requestData = {
        method,
        url,
        headers: finalHeaders,
        body: parsedBody
      };

      console.log('Sending test request:', requestData);

      const response = await apiClient.testRequest({
        method,
        url,
        requestBody: parsedBody,
        apiKey: adminKey
      });

      const endTime = Date.now();
      setResponseTime(endTime - startTime);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Backend error: ${response.status} - ${errorText}`);
      }

      const responseData = await response.json();
      setResponse(responseData);

    } catch (err) {
      console.error('Error sending test request:', err);
      setError(err instanceof Error ? err.message : 'Failed to send request');
    } finally {
      setLoading(false);
    }
  };

  const formatJSON = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  const formatHeaders = (headers: Record<string, string>) => {
    return Object.entries(headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
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
        API Testing UI
      </h2>

      {error && (
        <div style={{
          backgroundColor: '#fee2e2',
          border: '1px solid #fca5a5',
          color: '#dc2626',
          padding: '1rem',
          borderRadius: '0.5rem',
          marginBottom: '1.5rem'
        }}>
          Error: {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Method and URL row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '1rem' }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Method
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                backgroundColor: 'white',
                cursor: 'pointer'
              }}
            >
              {methods.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.example.com/endpoint"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem'
              }}
            />
          </div>
        </div>

        {/* Headers */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#374151',
            marginBottom: '0.5rem'
          }}>
            Headers (JSON)
          </label>
          <textarea
            value={headers}
            onChange={(e) => setHeaders(e.target.value)}
            placeholder='{"Content-Type": "application/json", "Authorization": "Bearer ..."}'
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontFamily: 'monospace',
              minHeight: '120px',
              resize: 'vertical'
            }}
          />
        </div>

        {/* Body - only show for methods that support body */}
        {['POST', 'PUT', 'PATCH'].includes(method) && (
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Body (JSON)
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder='{"key": "value"}'
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontFamily: 'monospace',
                minHeight: '120px',
                resize: 'vertical'
              }}
            />
          </div>
        )}

        {/* Send button */}
        <div>
          <button
            onClick={handleSend}
            disabled={loading || !url}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: loading || !url ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: loading || !url ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
            onMouseOver={(e) => {
              if (!loading && url) {
                e.currentTarget.style.backgroundColor = '#2563eb';
              }
            }}
            onMouseOut={(e) => {
              if (!loading && url) {
                e.currentTarget.style.backgroundColor = '#3b82f6';
              }
            }}
          >
            {loading ? (
              <>
                <div style={{
                  width: '1rem',
                  height: '1rem',
                  border: '2px solid #e5e7eb',
                  borderTop: '2px solid white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                Sending...
              </>
            ) : (
              'Send Request'
            )}
          </button>
        </div>

        {/* Response section */}
        {response && (
          <div style={{
            border: '1px solid #e5e7eb',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            backgroundColor: '#f9fafb'
          }}>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: '#111827',
              marginBottom: '1rem'
            }}>
              Response
            </h3>

            {/* Response status and time */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <div>
                <div style={{
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '0.25rem'
                }}>
                  Status
                </div>
                <div style={{
                  fontSize: '1.125rem',
                  fontWeight: '600',
                  color: response.status >= 200 && response.status < 300 ? '#10b981' : '#ef4444'
                }}>
                  {response.status} {response.statusText || ''}
                </div>
              </div>

              {responseTime !== null && (
                <div>
                  <div style={{
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.25rem'
                  }}>
                    Response Time
                  </div>
                  <div style={{
                    fontSize: '1.125rem',
                    fontWeight: '600',
                    color: '#111827'
                  }}>
                    {responseTime}ms
                  </div>
                </div>
              )}
            </div>

            {/* Response headers */}
            {response.headers && Object.keys(response.headers).length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Headers
                </div>
                <pre style={{
                  backgroundColor: 'white',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  overflow: 'auto',
                  maxHeight: '200px',
                  margin: 0
                }}>
                  {formatHeaders(response.headers)}
                </pre>
              </div>
            )}

            {/* Response body */}
            <div>
              <div style={{
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                Body
              </div>
              <pre style={{
                backgroundColor: 'white',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                padding: '1rem',
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                overflow: 'auto',
                maxHeight: '400px',
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word'
              }}>
                {typeof response.body === 'object' ? formatJSON(response.body) : response.body}
              </pre>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}