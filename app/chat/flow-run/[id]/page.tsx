'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import ChatInput from '@/app/components/ChatInput'

export default function FlowRunPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const flowRunId = params?.id as string
  const flowId = searchParams.get('flowId')
  const [conversationData, setConversationData] = useState<any>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch step runs (trace data)
  useEffect(() => {
    if (!flowRunId) return

    const fetchStepRuns = async () => {
      try {
        const response = await fetch(`/api/proxy/api/step-runs?flow_run_id=${flowRunId}`)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const data = await response.json()
        console.log('Step runs:', data)
        
        if (Array.isArray(data)) {
          setConversationData({ flow_steps: data })
          if (data.length > 0) {
            setConversationId(data[0].flow_run_id || flowRunId)
          }
          setError(null)
        } else {
          setError('No step runs found')
        }
      } catch (err: any) {
        console.error('Error fetching step runs:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchStepRuns()
  }, [flowRunId])

  // Poll step runs
  useEffect(() => {
    if (!conversationId) return

    const pollStepRuns = async () => {
      try {
        const response = await fetch(`/api/proxy/api/step-runs?flow_run_id=${flowRunId}`)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const data = await response.json()
        
        if (Array.isArray(data)) {
          setConversationData({ flow_steps: data })
        }
        setError(null)
      } catch (err: any) {
        console.error('Error polling step runs:', err)
        setError(err.message)
      }
    }

    pollStepRuns()
    const intervalId = setInterval(pollStepRuns, 2000)
    return () => clearInterval(intervalId)
  }, [conversationId])

  // Extract messages and trace from step runs
  const getSteps = () => {
    if (!conversationData?.flow_steps) return []
    return conversationData.flow_steps
  }

  const steps = getSteps()

  return (
    <div style={{ 
      minHeight: '100vh',
      backgroundColor: '#000',
      color: '#f0f0f0',
      padding: '20px',
      fontFamily: 'monospace',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
            Loading...
          </div>
        )}
        
        {error && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#f55' }}>
            Error: {error}
          </div>
        )}
        
        {!loading && steps.length === 0 && !error && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
            Waiting for conversation...
          </div>
        )}
        
        {steps.map((step: any, index: number) => (
          <div key={index} style={{ marginBottom: '20px' }}>
            {/* Step header */}
            <div style={{ 
              display: 'flex', gap: '10px', alignItems: 'center',
              marginBottom: '8px', fontSize: '12px', color: '#888'
            }}>
              <span style={{ color: '#aaa' }}>step: {step.step_id || step.id || index}</span>
              <span style={{ 
                color: step.status === 'completed' ? '#4caf50' : 
                       step.status === 'running' ? '#2196f3' : '#ff9800'
              }}>
                {step.status || 'pending'}
              </span>
            </div>

            {/* Prompt */}
            {step.prompt && (
              <div style={{ marginBottom: '8px' }}>
                <div style={{ color: '#888', fontSize: '12px', marginBottom: '2px' }}>MO:</div>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px', color: '#f0f0f0' }}>
                  {step.prompt}
                </div>
              </div>
            )}

            {/* Response */}
            {step.response && (
              <div style={{ marginBottom: '8px' }}>
                <div style={{ color: '#888', fontSize: '12px', marginBottom: '2px' }}>JAS:</div>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px', color: '#4fc3f7' }}>
                  {step.response}
                </div>
              </div>
            )}

            {/* Trace details */}
            {step.trace && (
              <details style={{ marginTop: '4px' }}>
                <summary style={{ fontSize: '12px', color: '#666', cursor: 'pointer' }}>trace</summary>
                <div style={{ padding: '8px', fontSize: '12px', color: '#999', background: '#111', borderRadius: '4px', marginTop: '4px' }}>
                  {step.trace.variables && (
                    <div style={{ marginBottom: '4px' }}>
                      <span style={{ color: '#888' }}>variables: </span>
                      <span>{JSON.stringify(step.trace.variables)}</span>
                    </div>
                  )}
                  {step.trace.api_calls && step.trace.api_calls.length > 0 && (
                    <div style={{ marginBottom: '4px' }}>
                      <span style={{ color: '#888' }}>api_calls: </span>
                      <span>{step.trace.api_calls.length}</span>
                    </div>
                  )}
                  {step.trace.queries && step.trace.queries.length > 0 && (
                    <div style={{ marginBottom: '4px' }}>
                      <span style={{ color: '#888' }}>queries: </span>
                      <span>{step.trace.queries.length}</span>
                    </div>
                  )}
                  {step.trace.rules_fired && step.trace.rules_fired.length > 0 && (
                    <div style={{ marginBottom: '4px' }}>
                      <span style={{ color: '#888' }}>rules_fired: </span>
                      <span>{step.trace.rules_fired.length}</span>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        ))}
      </div>
      
      {/* Chat input at the bottom */}
      <div style={{ 
        marginTop: 'auto',
        paddingTop: '20px',
        borderTop: '1px solid #333'
      }}>
        <ChatInput 
          flowRunId={flowRunId}
          flowId={flowId || undefined}
          onSend={(responseData: any) => {
            console.log('Resume response:', responseData)
            const newId = responseData?.flowRunId || responseData?.flow_run_id
            if (newId && newId !== conversationId) {
              setConversationId(newId)
            }
          }}
          showHint={true}
        />
      </div>
    </div>
  )
}