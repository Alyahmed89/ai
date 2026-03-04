'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import URLRequestResponseTest from '@/app/components/URLRequestResponseTest';

// Local API route
const API_URL = '/api/flow-steps';

export default function StepPage() {
  const params = useParams();
  const stepId = params.id as string;
  
  const [step, setStep] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [inputData, setInputData] = useState<any>(null);

  useEffect(() => {
    // Fetch real step data from Cloudflare D1 database
    const fetchStep = async () => {
      try {
        setLoading(true);
        
        // Make API call to local API route for step data
        console.log('Fetching step:', stepId);
        const stepResponse = await fetch(`${API_URL}/${stepId}`);
        
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
        }

        // Fetch input data for the step
        console.log('Fetching input data for step:', stepId);
        const inputResponse = await fetch(`${API_URL}/${stepId}/input`);
        
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
  const getDefaultUrl = () => {
    if (inputData?.input_keys) {
      try {
        const inputKeys = JSON.parse(inputData.input_keys);
        if (Array.isArray(inputKeys) && inputKeys.length > 0) {
          const config = inputKeys[0];
          if (config.url) {
            return config.url;
          }
        }
      } catch (e) {
        console.error('Failed to parse input_keys for URL:', e);
      }
    }
    
    // Default fallback
    return 'https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/d1/database/ce8f2a2c-6e4b-4398-b73e-ba8f204f609a/query';
  };

  const getDefaultRequestBody = () => {
    if (inputData?.input_keys) {
      try {
        const inputKeys = JSON.parse(inputData.input_keys);
        if (Array.isArray(inputKeys) && inputKeys.length > 0) {
          const config = inputKeys[0];
          if (config.body) {
            return JSON.stringify(config.body, null, 2);
          }
        }
      } catch (e) {
        console.error('Failed to parse input_keys for request body:', e);
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
    
    if (inputData?.input_keys) {
      try {
        const inputKeys = JSON.parse(inputData.input_keys);
        if (Array.isArray(inputKeys) && inputKeys.length > 0) {
          const config = inputKeys[0];
          
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
      } catch (e) {
        console.error('Failed to parse input_keys for variables:', e);
      }
    }
    
    // Add some default variables
    variables['{{step_id}}'] = stepId;
    variables['{{timestamp}}'] = new Date().toISOString();
    
    return variables;
  };

  const handleTest = async (url: string, requestBody: string, apiKey: string) => {
    console.log('Testing API with:', { url, requestBody, apiKey: apiKey ? '***' + apiKey.slice(-4) : 'Not provided' });
    
    try {
      // Parse the request body JSON to validate it
      let parsedBody;
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

      // Make the API call through our backend proxy to avoid CORS issues
      const response = await fetch('/api/test-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url,
          requestBody: parsedBody,
          apiKey
        })
      });
      
      const result = await response.json();
      
      return result;
    } catch (err) {
      console.error('API test failed:', err);
      return {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ 
          error: 'API test failed',
          message: err instanceof Error ? err.message : 'Unknown error'
        }, null, 2)
      };
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
            href="/"
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
              <h1 style={{
                fontSize: '2.25rem',
                fontWeight: 'bold',
                color: '#111827',
                marginBottom: '0.5rem'
              }}>
                {step.title}
              </h1>
              <p style={{
                fontSize: '1.125rem',
                color: '#6b7280'
              }}>
                Step {step.order} • {step.step_type}
              </p>
            </div>
          </div>
        </div>

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
            value={step.description}
            readOnly
          />
          <div style={{
            marginTop: '1rem',
            fontSize: '0.875rem',
            color: '#6b7280'
          }}>
            Step ID: {step.id} • Created: {new Date(step.created_at).toLocaleDateString()} • Updated: {new Date(step.updated_at).toLocaleDateString()}
          </div>
        </div>

        {/* URL + Request + Output + Test Button Component */}
        <URLRequestResponseTest
          defaultUrl={getDefaultUrl()}
          defaultRequestBody={getDefaultRequestBody()}
          defaultApiKey="H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL"
          onTest={handleTest}
        />
      </div>
    </div>
  );
}

export const runtime = 'edge';