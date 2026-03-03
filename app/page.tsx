'use client';

import { useState } from 'react';

export default function Home() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/d1/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setMessage(`Item created successfully! ID: ${data.data?.id || 'N/A'}`);
        setName('');
        setDescription('');
      } else {
        setError(data.message || 'Failed to create item');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const initializeDatabase = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/d1/init');
      const data = await response.json();
      
      if (data.success) {
        setMessage('Database initialized successfully! You can now create items.');
      } else {
        setError(data.message || 'Failed to initialize database');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f9fafb',
      padding: '2rem'
    }}>
      <main style={{
        textAlign: 'center',
        padding: '2rem',
        backgroundColor: 'white',
        borderRadius: '0.75rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        maxWidth: '500px',
        width: '100%'
      }}>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: 'bold',
          color: '#111827',
          marginBottom: '1rem'
        }}>
          Cloudflare D1 Test
        </h1>
        <p style={{
          fontSize: '1rem',
          color: '#4b5563',
          marginBottom: '2rem'
        }}>
          Test creating an item in Cloudflare D1 Database
        </p>

        {message && (
          <div style={{
            backgroundColor: '#d1fae5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            padding: '1rem',
            borderRadius: '0.5rem',
            marginBottom: '1.5rem'
          }}>
            {message}
          </div>
        )}

        {error && (
          <div style={{
            backgroundColor: '#fee2e2',
            border: '1px solid #fca5a5',
            color: '#dc2626',
            padding: '1rem',
            borderRadius: '0.5rem',
            marginBottom: '1.5rem'
          }}>
            {error}
          </div>
        )}

        <div style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'center',
          marginBottom: '2rem'
        }}>
          <button
            onClick={initializeDatabase}
            disabled={loading}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: '500',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Initializing...' : 'Initialize Database'}
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem'
              }}
              placeholder="Enter item name"
              required
              disabled={loading}
            />
          </div>
          
          <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                minHeight: '100px',
                resize: 'vertical'
              }}
              placeholder="Enter item description"
              disabled={loading}
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '1rem',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Creating...' : 'Create Item'}
          </button>
        </form>

        <div style={{
          marginTop: '2rem',
          paddingTop: '1rem',
          borderTop: '1px solid #e5e7eb',
          color: '#6b7280',
          fontSize: '0.875rem',
          textAlign: 'left'
        }}>
          <p><strong>Cloudflare Account ID:</strong> e39371fc55a5c9ef7ed83e16660bd7bb</p>
          <p><strong>Database ID:</strong> ce8f2a2c-6e4b-4398-b73e-ba8f204f609a</p>
          
          <div style={{ marginTop: '1rem' }}>
            <p><strong>Flow Steps:</strong></p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              <a href="/step/1" style={{ color: '#3b82f6', textDecoration: 'none' }}>Step 1: Requirements Gathering</a>
              <a href="/step/2" style={{ color: '#3b82f6', textDecoration: 'none' }}>Step 2: Design Phase</a>
              <a href="/step/3" style={{ color: '#3b82f6', textDecoration: 'none' }}>Step 3: Development</a>
              <a href="/step/4" style={{ color: '#3b82f6', textDecoration: 'none' }}>Step 4: Testing</a>
              <a href="/step/5" style={{ color: '#3b82f6', textDecoration: 'none' }}>Step 5: Deployment</a>
            </div>
          </div>
          
          <p style={{ marginTop: '0.5rem' }}>
            <strong>Instructions:</strong> 
            <ol style={{ marginLeft: '1rem', marginTop: '0.5rem' }}>
              <li>Click "Initialize Database" to create the table</li>
              <li>Fill in the form and click "Create Item"</li>
              <li>Click on any flow step above to view step details</li>
            </ol>
          </p>
        </div>
      </main>
    </div>
  );
}
