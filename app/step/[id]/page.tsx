'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';

// Mock data for flow steps - this would come from your database
const mockFlowSteps = [
  {
    id: 1,
    title: 'Step 1: Requirements Gathering',
    description: 'Gather and document all requirements from stakeholders',
    status: 'completed',
    order: 1,
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-01-20T14:45:00Z'
  },
  {
    id: 2,
    title: 'Step 2: Design Phase',
    description: 'Create wireframes and design mockups for approval',
    status: 'in_progress',
    order: 2,
    created_at: '2024-01-16T09:15:00Z',
    updated_at: '2024-01-25T11:20:00Z'
  },
  {
    id: 3,
    title: 'Step 3: Development',
    description: 'Implement the designed features and functionality',
    status: 'pending',
    order: 3,
    created_at: '2024-01-18T13:00:00Z',
    updated_at: '2024-01-18T13:00:00Z'
  },
  {
    id: 4,
    title: 'Step 4: Testing',
    description: 'Perform unit, integration, and user acceptance testing',
    status: 'pending',
    order: 4,
    created_at: '2024-01-19T08:45:00Z',
    updated_at: '2024-01-19T08:45:00Z'
  },
  {
    id: 5,
    title: 'Step 5: Deployment',
    description: 'Deploy the application to production environment',
    status: 'pending',
    order: 5,
    created_at: '2024-01-20T16:30:00Z',
    updated_at: '2024-01-20T16:30:00Z'
  }
];

export default function StepPage() {
  const params = useParams();
  const stepId = params.id as string;
  
  const [step, setStep] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Simulate API call to fetch step data
    const fetchStep = async () => {
      try {
        setLoading(true);
        // In real implementation, this would be: await fetch(`/api/flow-steps/${stepId}`)
        
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const foundStep = mockFlowSteps.find(s => s.id === parseInt(stepId));
        
        if (foundStep) {
          setStep(foundStep);
        } else {
          setError(`Step with ID ${stepId} not found`);
        }
      } catch (err) {
        setError('Failed to load step data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (stepId) {
      fetchStep();
    }
  }, [stepId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return { bg: '#d1fae5', text: '#065f46', border: '#a7f3d0' }; // Tailwind: bg-green-100 text-green-800 border-green-200
      case 'in_progress':
        return { bg: '#fef3c7', text: '#92400e', border: '#fde68a' }; // Tailwind: bg-yellow-100 text-yellow-800 border-yellow-200
      case 'pending':
        return { bg: '#e5e7eb', text: '#374151', border: '#d1d5db' }; // Tailwind: bg-gray-100 text-gray-800 border-gray-200
      default:
        return { bg: '#e5e7eb', text: '#374151', border: '#d1d5db' };
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in_progress':
        return 'In Progress';
      case 'pending':
        return 'Pending';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9fafb' // Tailwind: bg-gray-50
      }}>
        <div style={{
          textAlign: 'center',
          padding: '2rem' // Tailwind: p-8
        }}>
          <div style={{
            width: '3rem', // Tailwind: w-12
            height: '3rem', // Tailwind: h-12
            border: '4px solid #e5e7eb', // Tailwind: border-gray-200
            borderTop: '4px solid #3b82f6', // Tailwind: border-blue-500
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem' // Tailwind: mx-auto mb-4
          }}></div>
          <p style={{
            fontSize: '1.125rem', // Tailwind: text-lg
            color: '#6b7280' // Tailwind: text-gray-500
          }}>
            Loading step details...
          </p>
        </div>
      </div>
    );
  }

  if (error || !step) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9fafb' // Tailwind: bg-gray-50
      }}>
        <div style={{
          textAlign: 'center',
          padding: '2rem', // Tailwind: p-8
          backgroundColor: 'white',
          borderRadius: '0.75rem', // Tailwind: rounded-xl
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)', // Tailwind: shadow
          maxWidth: '500px',
          width: '100%'
        }}>
          <div style={{
            width: '3rem', // Tailwind: w-12
            height: '3rem', // Tailwind: h-12
            backgroundColor: '#fee2e2', // Tailwind: bg-red-100
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem' // Tailwind: mx-auto mb-4
          }}>
            <span style={{
              fontSize: '1.5rem', // Tailwind: text-2xl
              color: '#dc2626' // Tailwind: text-red-600
            }}>
              !
            </span>
          </div>
          <h2 style={{
            fontSize: '1.5rem', // Tailwind: text-2xl
            fontWeight: 'bold',
            color: '#111827', // Tailwind: text-gray-900
            marginBottom: '0.5rem' // Tailwind: mb-2
          }}>
            {error || 'Step not found'}
          </h2>
          <p style={{
            color: '#6b7280', // Tailwind: text-gray-500
            marginBottom: '1.5rem' // Tailwind: mb-6
          }}>
            The step you're looking for doesn't exist or couldn't be loaded.
          </p>
          <a
            href="/"
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem', // Tailwind: px-6 py-3
              backgroundColor: '#3b82f6', // Tailwind: bg-blue-500
              color: 'white',
              borderRadius: '0.5rem', // Tailwind: rounded-lg
              textDecoration: 'none',
              fontWeight: '500',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'} // Tailwind: hover:bg-blue-600
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
          >
            Go back home
          </a>
        </div>
      </div>
    );
  }

  const statusColors = getStatusColor(step.status);

  return (
    <>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f9fafb', // Tailwind: bg-gray-50
        padding: '2rem' // Tailwind: p-8
      }}>
        <div style={{
          maxWidth: '800px',
          margin: '0 auto'
        }}>
        {/* Header */}
        <div style={{
          marginBottom: '2rem' // Tailwind: mb-8
        }}>
          <a
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              color: '#6b7280', // Tailwind: text-gray-500
              textDecoration: 'none',
              marginBottom: '1rem', // Tailwind: mb-4
              transition: 'color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.color = '#374151'} // Tailwind: hover:text-gray-700
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
            gap: '1rem' // Tailwind: gap-4
          }}>
            <div>
              <h1 style={{
                fontSize: '2.25rem', // Tailwind: text-4xl
                fontWeight: 'bold',
                color: '#111827', // Tailwind: text-gray-900
                marginBottom: '0.5rem' // Tailwind: mb-2
              }}>
                {step.title}
              </h1>
              <p style={{
                fontSize: '1.125rem', // Tailwind: text-lg
                color: '#6b7280' // Tailwind: text-gray-500
              }}>
                Step {step.order} of {mockFlowSteps.length}
              </p>
            </div>
            
            <div style={{
              padding: '0.5rem 1rem', // Tailwind: px-4 py-2
              backgroundColor: statusColors.bg,
              color: statusColors.text,
              border: `1px solid ${statusColors.border}`,
              borderRadius: '9999px', // Tailwind: rounded-full
              fontWeight: '500',
              fontSize: '0.875rem' // Tailwind: text-sm
            }}>
              {getStatusText(step.status)}
            </div>
          </div>

        {/* Main Content */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '2rem', // Tailwind: gap-8
          '@media (min-width: 768px)': {
            gridTemplateColumns: '2fr 1fr'
          }
        }}>
          {/* Left Column - Step Details */}
          <div>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '0.75rem', // Tailwind: rounded-xl
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)', // Tailwind: shadow
              padding: '2rem', // Tailwind: p-8
              marginBottom: '2rem' // Tailwind: mb-8
            }}>
              <h2 style={{
                fontSize: '1.5rem', // Tailwind: text-2xl
                fontWeight: '600',
                color: '#111827', // Tailwind: text-gray-900
                marginBottom: '1rem' // Tailwind: mb-4
              }}>
                Description
              </h2>
              <p style={{
                fontSize: '1.125rem', // Tailwind: text-lg
                color: '#4b5563', // Tailwind: text-gray-700
                lineHeight: '1.75'
              }}>
                {step.description}
              </p>
            </div>

            {/* Action Buttons */}
            <div style={{
              display: 'flex',
              gap: '1rem', // Tailwind: gap-4
              flexWrap: 'wrap'
            }}>
              <button
                style={{
                  padding: '0.75rem 1.5rem', // Tailwind: px-6 py-3
                  backgroundColor: '#3b82f6', // Tailwind: bg-blue-500
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem', // Tailwind: rounded-lg
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'} // Tailwind: hover:bg-blue-600
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
              >
                Mark as Complete
              </button>
              
              <button
                style={{
                  padding: '0.75rem 1.5rem', // Tailwind: px-6 py-3
                  backgroundColor: 'white',
                  color: '#374151', // Tailwind: text-gray-700
                  border: '1px solid #d1d5db', // Tailwind: border-gray-300
                  borderRadius: '0.5rem', // Tailwind: rounded-lg
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9fafb'; // Tailwind: hover:bg-gray-50
                  e.currentTarget.style.borderColor = '#9ca3af'; // Tailwind: hover:border-gray-400
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#d1d5db';
                }}
              >
                Edit Step
              </button>
              
              <button
                style={{
                  padding: '0.75rem 1.5rem', // Tailwind: px-6 py-3
                  backgroundColor: '#fee2e2', // Tailwind: bg-red-100
                  color: '#dc2626', // Tailwind: text-red-600
                  border: 'none',
                  borderRadius: '0.5rem', // Tailwind: rounded-lg
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fecaca'} // Tailwind: hover:bg-red-200
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
              >
                Delete Step
              </button>
            </div>
          </div>

          {/* Right Column - Metadata */}
          <div>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '0.75rem', // Tailwind: rounded-xl
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)', // Tailwind: shadow
              padding: '2rem' // Tailwind: p-8
            }}>
              <h3 style={{
                fontSize: '1.25rem', // Tailwind: text-xl
                fontWeight: '600',
                color: '#111827', // Tailwind: text-gray-900
                marginBottom: '1.5rem' // Tailwind: mb-6
              }}>
                Step Details
              </h3>
              
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem' // Tailwind: gap-6
              }}>
                <div>
                  <p style={{
                    fontSize: '0.875rem', // Tailwind: text-sm
                    color: '#6b7280', // Tailwind: text-gray-500
                    marginBottom: '0.25rem' // Tailwind: mb-1
                  }}>
                    Step ID
                  </p>
                  <p style={{
                    fontSize: '1rem', // Tailwind: text-base
                    color: '#111827', // Tailwind: text-gray-900
                    fontWeight: '500'
                  }}>
                    {step.id}
                  </p>
                </div>
                
                <div>
                  <p style={{
                    fontSize: '0.875rem', // Tailwind: text-sm
                    color: '#6b7280', // Tailwind: text-gray-500
                    marginBottom: '0.25rem' // Tailwind: mb-1
                  }}>
                    Created
                  </p>
                  <p style={{
                    fontSize: '1rem', // Tailwind: text-base
                    color: '#111827', // Tailwind: text-gray-900
                    fontWeight: '500'
                  }}>
                    {new Date(step.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                
                <div>
                  <p style={{
                    fontSize: '0.875rem', // Tailwind: text-sm
                    color: '#6b7280', // Tailwind: text-gray-500
                    marginBottom: '0.25rem' // Tailwind: mb-1
                  }}>
                    Last Updated
                  </p>
                  <p style={{
                    fontSize: '1rem', // Tailwind: text-base
                    color: '#111827', // Tailwind: text-gray-900
                    fontWeight: '500'
                  }}>
                    {new Date(step.updated_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                
                <div>
                  <p style={{
                    fontSize: '0.875rem', // Tailwind: text-sm
                    color: '#6b7280', // Tailwind: text-gray-500
                    marginBottom: '0.25rem' // Tailwind: mb-1
                  }}>
                    Status
                  </p>
                  <p style={{
                    fontSize: '1rem', // Tailwind: text-base
                    color: '#111827', // Tailwind: text-gray-900
                    fontWeight: '500'
                  }}>
                    {getStatusText(step.status)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}