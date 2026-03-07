'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import URLRequestResponseTest from '@/app/components/URLRequestResponseTest';
import ConditionNavigator from '@/app/components/ConditionNavigator';
import { apiClient } from '@/lib/api-client';

export default function StepPage() {
  const params = useParams();
  const stepId = params.id as string;
  
  const [step, setStep] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [editData, setEditData] = useState<any>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [inputData, setInputData] = useState<any>(null);

  useEffect(() => {
    // Fetch real step data from Cloudflare D1 database
    const fetchStep = async () => {
      try {
        setLoading(true);
        
        // Make API call to Cloudflare Worker backend for step data
        console.log('Fetching step:', stepId);
        const stepResponse = await apiClient.getFlowStep(stepId);
        
        console.log('Step response status:', stepResponse.status);
        if (!stepResponse.ok) {
          const errorText = await stepResponse.text();
          throw new Error(`API error: ${stepResponse.status} - ${errorText}`);
        }
        
        const stepData = await stepResponse.json();
        console.log('Step response data:', stepData);
        
        if (stepData.error) {
          setError(stepData.error);
        } else {
          setStep(stepData);
          setEditData(stepData);
        }

        // Fetch input data for the step
        console.log('Fetching input data for step:', stepId);
        const inputResponse = await apiClient.getStepInput(stepId);
        
        if (inputResponse.ok) {
          const inputData = await inputResponse.json();
          console.log('Input data:', inputData);
          setInputData(inputData);
        } else {
          console.warn('Failed to fetch input data, using defaults');
        }
      } catch (err) {
        console.error('Error fetching step:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(`Failed to load step data: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    };

    if (stepId) {
      fetchStep();
    }
  }, [stepId]);

  const handleEdit = () => {
    setEditing(true);
    setEditError('');
    setEditSuccess('');
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditData(step);
    setEditError('');
    setEditSuccess('');
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    setEditError('');
    setEditSuccess('');

    try {
      const response = await apiClient.updateFlowStep(stepId, editData);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        setEditError(data.error);
      } else {
        setEditSuccess('Step updated successfully!');
        setStep(editData);
        setEditing(false);
      }
    } catch (err) {
      console.error('Error updating step:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setEditError(`Failed to update step: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditData((prev: any) => ({
      ...prev,
      [name]: name === 'order_index' || name === 'order' || name === 'output' ? parseInt(value) || 0 : value
    }));
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError('');

    try {
      const response = await apiClient.deleteFlowStep(stepId);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }
      
      // Redirect to steps page after successful deletion
      window.location.href = '/steps';
    } catch (err) {
      console.error('Error deleting step:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setDeleteError(`Failed to delete step: ${errorMessage}`);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9fafb'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '2rem'
        }}>
          <div style={{
            width: '3rem',
            height: '3rem',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }}></div>
          <p style={{
            fontSize: '1.125rem',
            color: '#6b7280'
          }}>
            Loading step details...
          </p>
        </div>
      </div>
    );
  }

  // Helper functions to get default values from input data
  const getDefaultMethod = () => {
    if (inputData?.input_schema && Array.isArray(inputData.input_schema) && inputData.input_schema.length > 0) {
      const config = inputData.input_schema[0];
      if (config.method) {
        return config.method;
      }
    }
    
    // Default fallback
    return 'POST';
  };

  const getDefaultUrl = () => {
    if (inputData?.input_schema && Array.isArray(inputData.input_schema) && inputData.input_schema.length > 0) {
      const config = inputData.input_schema[0];
      if (config.url) {
        return config.url;
      }
    }
    
    // Default fallback
    return 'https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/d1/database/ce8f2a2c-6e4b-4398-b73e-ba8f204f609a/query';
  };

  const getDefaultRequestBody = () => {
    if (inputData?.input_schema && Array.isArray(inputData.input_schema) && inputData.input_schema.length > 0) {
      const config = inputData.input_schema[0];
      if (config.body) {
        return JSON.stringify(config.body, null, 2);
      }
    }
    
    // Default fallback
    return JSON.stringify({ 
      step_id: stepId,
      action: 'test',
      timestamp: new Date().toISOString()
    }, null, 2);
  };

  const getDefaultVariables = () => {
    const variables: Record<string, string> = {};
    
    if (inputData?.input_schema && Array.isArray(inputData.input_schema) && inputData.input_schema.length > 0) {
      const config = inputData.input_schema[0];
      
      // Extract variables from the config
      if (config.auth_value) {
        variables['{{auth_token}}'] = config.auth_value;
      }
      if (config.url) {
        variables['{{api_url}}'] = config.url;
      }
      if (config.method) {
        variables['{{http_method}}'] = config.method;
      }
    }
    
    // Add some default variables
    variables['{{step_id}}'] = stepId;
    variables['{{timestamp}}'] = new Date().toISOString();
    variables['{{method}}'] = getDefaultMethod();
    
    return variables;
  };

  const handleTest = async (method: string, url: string, requestBody: string, apiKey: string) => {
    console.log('Testing API with:', { method, url, requestBody, apiKey: apiKey ? '***' + apiKey.slice(-4) : 'Not provided' });
    
    try {
      // Parse the request body JSON to validate it
      let parsedBody;
      // For GET and HEAD requests, body might be empty or not needed
      if (method === 'GET' || method === 'HEAD') {
        if (requestBody.trim()) {
          try {
            parsedBody = JSON.parse(requestBody);
          } catch {
            // For GET/HEAD, if JSON is invalid but not empty, use empty object
            parsedBody = {};
          }
        } else {
          parsedBody = {};
        }
      } else {
        try {
          parsedBody = JSON.parse(requestBody);
        } catch (e) {
          return {
            status: 400,
            statusText: 'Bad Request',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ 
              error: 'Invalid JSON in request body',
              message: e instanceof Error ? e.message : 'Unknown error'
            }, null, 2)
          };
        }
      }

      // Make the API call through Cloudflare Worker backend
      const response = await apiClient.testRequest({
        method,
        url,
        requestBody: parsedBody,
        apiKey
      });
      
      // Check if the proxy endpoint exists
      if (response.status === 404) {
        console.warn('API proxy endpoint not found (404). Trying direct fetch...');
        
        // Try direct fetch as fallback
        try {
          const directResponse = await fetch(url, {
            method: method,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': apiKey ? `Bearer ${apiKey}` : '',
            },
            body: method !== 'GET' && method !== 'HEAD' ? JSON.stringify(parsedBody) : undefined
          });
          
          const responseText = await directResponse.text();
          let responseBody;
          try {
            responseBody = JSON.parse(responseText);
          } catch {
            responseBody = responseText;
          }
          
          return {
            status: directResponse.status,
            statusText: directResponse.statusText,
            headers: Object.fromEntries(directResponse.headers.entries()),
            body: typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody, null, 2)
          };
        } catch (directErr) {
          console.error('Direct fetch also failed:', directErr);
          return {
            status: 502,
            statusText: 'Bad Gateway',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ 
              error: 'API proxy endpoint not found and direct fetch failed',
              message: 'The API proxy endpoint (/api/test-request) returned 404. Direct fetch also failed due to CORS or other issues.',
              details: directErr instanceof Error ? directErr.message : 'Unknown error'
            }, null, 2)
          };
        }
      }
      
      // If not 404, try to parse the response as JSON
      let result;
      try {
        const responseText = await response.text();
        try {
          result = JSON.parse(responseText);
        } catch {
          result = {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body: responseText
          };
        }
      } catch (err) {
        console.error('Failed to parse response:', err);
        return {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: `Failed to parse response: ${err instanceof Error ? err.message : 'Unknown error'}`
        };
      }
      
      return result;
    } catch (err) {
      console.error('API test failed:', err);
      return {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ 
          error: 'API test failed',
          message: err instanceof Error ? err.message : 'Unknown error',
          note: 'The API proxy endpoint might not be implemented on the backend.'
        }, null, 2)
      };
    }
  };

  // Helper function to format dates from various formats
  const formatDate = (dateValue: any): string => {
    if (!dateValue) return 'N/A';
    
    try {
      // Handle Unix timestamp (seconds)
      if (typeof dateValue === 'number') {
        // Check if it's in seconds (typical Unix timestamp) or milliseconds
        const timestamp = dateValue < 10000000000 ? dateValue * 1000 : dateValue;
        return new Date(timestamp).toLocaleDateString();
      }
      
      // Handle string dates
      if (typeof dateValue === 'string') {
        // Try to parse the date string
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString();
        }
        
        // Try to handle MySQL/ISO-like format without timezone
        const mysqlDate = dateValue.replace(' ', 'T');
        const mysqlDateWithTimezone = mysqlDate.includes('Z') ? mysqlDate : mysqlDate + 'Z';
        const mysqlParsed = new Date(mysqlDateWithTimezone);
        if (!isNaN(mysqlParsed.getTime())) {
          return mysqlParsed.toLocaleDateString();
        }
      }
      
      // Fallback
      return 'Invalid Date';
    } catch (error) {
      console.error('Error formatting date:', dateValue, error);
      return 'Invalid Date';
    }
  };

  if (error || !step) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9fafb'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          maxWidth: '500px',
          width: '100%'
        }}>
          <div style={{
            width: '3rem',
            height: '3rem',
            backgroundColor: '#fee2e2',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem'
          }}>
            <span style={{
              fontSize: '1.5rem',
              color: '#dc2626'
            }}>
              !
            </span>
          </div>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            color: '#111827',
            marginBottom: '0.5rem'
          }}>
            {error || 'Step not found'}
          </h2>
          <p style={{
            color: '#6b7280',
            marginBottom: '1.5rem'
          }}>
            The step you're looking for doesn't exist or couldn't be loaded.
          </p>
          <a
            href="/"
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              fontWeight: '500',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
          >
            Go back home
          </a>
        </div>
      </div>
    );
  }

  // Debug: log step data
  console.log('Step data in render:', step);
  console.log('Step instructions:', step?.instructions);
  console.log('Step instructions length:', step?.instructions?.length);
  
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f9fafb',
      padding: '2rem'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        {/* Title Component */}
        <div style={{
          marginBottom: '2rem'
        }}>
          <a
            href="/steps"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              color: '#6b7280',
              textDecoration: 'none',
              marginBottom: '1rem',
              transition: 'color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.color = '#374151'}
            onMouseOut={(e) => e.currentTarget.style.color = '#6b7280'}
          >
            <span style={{ marginRight: '0.5rem' }}>←</span>
            Back to all steps
          </a>
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              {editing ? (
                <div style={{ marginBottom: '1rem' }}>
                  <input
                    type="text"
                    name="title"
                    value={editData?.title || ''}
                    onChange={handleInputChange}
                    style={{
                      fontSize: '2.25rem',
                      fontWeight: 'bold',
                      color: '#111827',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      padding: '0.5rem',
                      width: '100%',
                      maxWidth: '500px'
                    }}
                  />
                </div>
              ) : (
                <h1 style={{
                  fontSize: '2.25rem',
                  fontWeight: 'bold',
                  color: '#111827',
                  marginBottom: '0.5rem'
                }}>
                  {step.title}
                </h1>
              )}
              <div style={{
                display: 'flex',
                gap: '1rem',
                alignItems: 'center',
                flexWrap: 'wrap'
              }}>
                {editing ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.125rem', color: '#6b7280' }}>Order:</span>
                      <input
                        type="number"
                        name="order_index"
                        value={editData?.order_index || editData?.order || 0}
                        onChange={handleInputChange}
                        min="0"
                        max="100"
                        style={{
                          padding: '0.25rem 0.5rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                          width: '80px'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.125rem', color: '#6b7280' }}>Type:</span>
                      <select
                        name="step_type"
                        value={editData?.step_type || ''}
                        onChange={handleInputChange}
                        style={{
                          padding: '0.25rem 0.5rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                          width: '120px'
                        }}
                      >
                        <option value="input">Input</option>
                        <option value="output">Output</option>
                        <option value="process">Process</option>
                        <option value="decision">Decision</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <p style={{
                    fontSize: '1.125rem',
                    color: '#6b7280'
                  }}>
                    Step {step.order_index || step.order || 0} • {step.step_type}
                  </p>
                )}
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {editing ? (
                <>
                  <button
                    onClick={handleCancelEdit}
                    disabled={saving}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#f3f4f6',
                      color: '#374151',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontWeight: '500',
                      fontSize: '0.875rem',
                      opacity: saving ? 0.7 : 1
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontWeight: '500',
                      fontSize: '0.875rem',
                      opacity: saving ? 0.7 : 1
                    }}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleEdit}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontWeight: '500',
                      fontSize: '0.875rem'
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontWeight: '500',
                      fontSize: '0.875rem'
                    }}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Input Section - For fetching data */}
        <URLRequestResponseTest
          title="Input"
          defaultMethod={getDefaultMethod()}
          defaultUrl={getDefaultUrl()}
          defaultRequestBody={getDefaultRequestBody()}
          defaultApiKey="H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL"
          onTest={handleTest}
        />

        {/* Instructions Text Box Component */}
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
            marginBottom: '1rem'
          }}>
            Instructions
          </h2>
          
          {editError && (
            <div style={{
              backgroundColor: '#fee2e2',
              border: '1px solid #fca5a5',
              color: '#dc2626',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              marginBottom: '1rem',
              fontSize: '0.875rem'
            }}>
              {editError}
            </div>
          )}
          
          {editSuccess && (
            <div style={{
              backgroundColor: '#d1fae5',
              border: '1px solid #a7f3d0',
              color: '#065f46',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              marginBottom: '1rem',
              fontSize: '0.875rem'
            }}>
              {editSuccess}
            </div>
          )}
          <div style={{
            marginBottom: '0.5rem',
            fontSize: '0.875rem',
            color: '#6b7280',
            fontFamily: 'monospace',
            backgroundColor: '#f3f4f6',
            padding: '0.5rem',
            borderRadius: '0.25rem'
          }}>
            Debug: instructions exists: {step.instructions ? 'YES' : 'NO'}, 
            length: {step.instructions ? step.instructions.length : 0}, 
            description exists: {step.description ? 'YES' : 'NO'}
          </div>
          {editing ? (
            <textarea
              name="instructions"
              style={{
                width: '100%',
                minHeight: '300px',
                padding: '1rem',
                fontSize: '1rem',
                color: '#4b5563',
                lineHeight: '1.5',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                backgroundColor: '#f9fafb',
                fontFamily: 'monospace',
                resize: 'vertical'
              }}
              value={editData?.instructions || editData?.description || ''}
              onChange={handleInputChange}
            />
          ) : (
            <textarea
              style={{
                width: '100%',
                minHeight: '300px',
                padding: '1rem',
                fontSize: '1rem',
                color: '#4b5563',
                lineHeight: '1.5',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                backgroundColor: '#f9fafb',
                fontFamily: 'monospace',
                resize: 'vertical'
              }}
              value={step.instructions || step.description || ''}
              readOnly
            />
          )}
          {/* Alternative: try a div instead of textarea */}
          <div style={{
            display: 'none',
            width: '100%',
            minHeight: '300px',
            padding: '1rem',
            fontSize: '1rem',
            color: '#4b5563',
            lineHeight: '1.5',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            backgroundColor: '#f9fafb',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            overflow: 'auto'
          }}>
            {step.instructions || step.description || 'No instructions available'}
          </div>
          <div style={{
            marginTop: '1rem',
            fontSize: '0.875rem',
            color: '#6b7280'
          }}>
            Step ID: {step.id} • Created: {formatDate(step.created_at)} • Updated: {formatDate(step.updated_at)}
          </div>
        </div>

        {/* Output Section - For sending data (only if step has output = 1) */}
        {step.output && (
          <URLRequestResponseTest
            title="Output"
            defaultMethod={getDefaultMethod()}
            defaultUrl={inputData?.output_url || getDefaultUrl()}
            defaultRequestBody={inputData?.output_payload_template || getDefaultRequestBody()}
            defaultApiKey={inputData?.output_auth_token || "H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL"}
            onTest={handleTest}
          />
        )}

        {/* Condition Navigation Section - Show if step has conditions */}
        <ConditionNavigator 
          stepId={stepId} 
          currentStepOrder={step.order} 
        />
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            padding: '2rem',
            maxWidth: '500px',
            width: '100%',
            margin: '1rem'
          }}>
            <h3 style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              color: '#111827',
              marginBottom: '1rem'
            }}>
              Delete Step
            </h3>
            
            {deleteError && (
              <div style={{
                backgroundColor: '#fee2e2',
                border: '1px solid #fca5a5',
                color: '#dc2626',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                marginBottom: '1rem',
                fontSize: '0.875rem'
              }}>
                {deleteError}
              </div>
            )}
            
            <p style={{
              color: '#6b7280',
              marginBottom: '1.5rem'
            }}>
              Are you sure you want to delete the step "{step.title}"? This action cannot be undone.
            </p>
            
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem'
            }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontWeight: '500',
                  fontSize: '0.875rem',
                  opacity: deleting ? 0.7 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontWeight: '500',
                  fontSize: '0.875rem',
                  opacity: deleting ? 0.7 : 1
                }}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

