'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import ChatInput from '@/app/components/ChatInput'

export default function FlowPage() {
  const params = useParams()
  const router = useRouter()
  const flowId = params?.id as string
  const [variables, setVariables] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch flow variables
  useEffect(() => {
    if (!flowId) return

    const fetchVariables = async () => {
      try {
        const response = await fetch(`/api/proxy/api/flows/${flowId}/variables`)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const data = await response.json()
        console.log('Flow variables:', data)
        
        // Extract variable names from response
        if (data.variables && Array.isArray(data.variables)) {
          const varNames = data.variables.map((v: any) => v.name).filter(Boolean)
          setVariables(varNames)
        }
        setError(null)
      } catch (err: any) {
        console.error('Error fetching variables:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchVariables()
  }, [flowId])

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
      <div style={{ flex: 1 }}>
        {loading && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
            Loading flow variables...
          </div>
        )}
        
        {error && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#f55' }}>
            Error: {error}
          </div>
        )}
        
        {!loading && !error && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
            Flow: {flowId}
            {variables.length > 0 && (
              <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
                Variables available: {variables.join(', ')}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Chat input at the bottom */}
      <div style={{ 
        marginTop: 'auto',
        paddingTop: '20px',
        borderTop: '1px solid #333'
      }}>
        <ChatInput 
          flowId={flowId}
          onSend={(responseData: any) => {
            // Extract flow_run_id from response and navigate to flow-run page
            console.log('Start flow response:', responseData)
            
            const flowRunId = 
              responseData?.data?.flow_run_id ||
              responseData?.flow_run_id ||
              responseData?.data?.id
            
            if (flowRunId) {
              console.log('Navigating to flow-run page:', flowRunId)
              router.push(`/chat/flow-run/${flowRunId}?flowId=${flowId}`)
            } else {
              console.error('No flow_run_id in response:', responseData)
            }
          }}
          showHint={false}
        />
      </div>
    </div>
  )
}