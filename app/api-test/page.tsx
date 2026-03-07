'use client';

import APITestingUI from '@/app/components/APITestingUI';

export default function APITestPage() {
  // In a real app, you might get this from environment variables or user input
  const adminKey = process.env.NEXT_PUBLIC_ADMIN_KEY || '';

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '2rem'
    }}>
      <h1 style={{
        fontSize: '2.25rem',
        fontWeight: '700',
        color: '#111827',
        marginBottom: '1rem'
      }}>
        API Testing Tool
      </h1>
      
      <p style={{
        fontSize: '1rem',
        color: '#6b7280',
        marginBottom: '2rem',
        lineHeight: '1.5'
      }}>
        Test any external API through the backend proxy. Requests are sent to <code style={{ backgroundColor: '#f3f4f6', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.875rem' }}>POST /api/test-request</code> with your configured parameters.
      </p>

      <APITestingUI adminKey={adminKey} />

      <div style={{
        backgroundColor: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: '0.75rem',
        padding: '1.5rem',
        marginTop: '2rem'
      }}>
        <h3 style={{
          fontSize: '1.125rem',
          fontWeight: '600',
          color: '#111827',
          marginBottom: '0.75rem'
        }}>
          How to Use
        </h3>
        
        <ul style={{
          listStyleType: 'disc',
          paddingLeft: '1.5rem',
          color: '#4b5563',
          lineHeight: '1.6'
        }}>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Method:</strong> Select HTTP method (GET, POST, PUT, PATCH, DELETE)
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>URL:</strong> Enter the full URL of the API endpoint you want to test
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Headers:</strong> Add any required headers as JSON (e.g., Content-Type, Authorization)
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Body:</strong> For POST, PUT, PATCH requests, include the request body as JSON
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Admin Key:</strong> The <code style={{ backgroundColor: '#e5e7eb', padding: '0.125rem 0.25rem', borderRadius: '0.125rem', fontSize: '0.75rem' }}>x-admin-key</code> header is automatically added if configured
          </li>
          <li>
            <strong>Response:</strong> View status code, response time, headers, and body
          </li>
        </ul>

        <div style={{
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '0.5rem',
          padding: '1rem',
          marginTop: '1rem'
        }}>
          <div style={{
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#1e40af',
            marginBottom: '0.5rem'
          }}>
            Backend Request Format
          </div>
          <pre style={{
            fontSize: '0.75rem',
            fontFamily: 'monospace',
            color: '#1e40af',
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word'
          }}>
{`POST /api/test-request
{
  "url": "https://api.example.com/endpoint",
  "method": "GET",
  "headers": {
    "Content-Type": "application/json",
    "x-admin-key": "..."
  },
  "body": {}
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}