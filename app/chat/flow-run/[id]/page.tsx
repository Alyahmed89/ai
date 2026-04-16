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

  // Fetch flow run details to get conversation_id
  useEffect(() => {
    if (!flowRunId) return

    const fetchFlowRunDetails = async () => {
      try {
        console.log("FLOW RUN ID USED (initial):", flowRunId);
        const response = await fetch(`https://deepseek-agent.alghamdimo89.workers.dev/api/step-runs?flow_run_id=${flowRunId}`)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const data = await response.json()
        console.log('Flow run details:', data)
        
        // Since we're fetching step-runs instead of flow-run details, we need to handle the response differently
        // The step-runs endpoint returns an array of step runs, not a single flow-run object
        if (Array.isArray(data) && data.length > 0) {
          // Use the flow_run_id from the first step run
          const firstStepRun = data[0];
          if (firstStepRun.flow_run_id) {
            // Store flow_run_id for polling (same as the one we already have)
            setConversationId(firstStepRun.flow_run_id)
            setError(null)
          } else {
            setError('No flow_run_id found in step runs')
          }
        } else {
          setError('No step runs found for this flow run')
        }
      } catch (err: any) {
        console.error('Error fetching flow run:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchFlowRunDetails()
  }, [flowRunId])

  // Poll conversation status using conversation_id
  useEffect(() => {
    if (!conversationId) return

    const pollStatus = async () => {
      try {
        console.log("FLOW RUN ID USED (page):", flowRunId);
        const response = await fetch(`https://deepseek-agent.alghamdimo89.workers.dev/api/step-runs?flow_run_id=${flowRunId}`)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const data = await response.json()
        console.log('Status response:', data)
        
        // The step-runs endpoint returns an array of step runs
        // We need to convert it to the expected conversation format
        if (Array.isArray(data)) {
          // Create a conversation-like object with flow_steps
          const conversation = {
            flow_steps: data.map(step => ({
              instructions: step.prompt,
              response: step.response,
              // Add other fields if needed
              ...step
            }))
          }
          setConversationData(conversation)
        } else {
          // Fallback to original normalization logic
          const normalized = 
            data?.data?.conversation ??
            data?.conversation ??
            data?.data ??
            data
          setConversationData(normalized)
        }
        setError(null)
      } catch (err: any) {
        console.error('Error polling status:', err)
        setError(err.message)
      }
    }

    // Poll immediately
    pollStatus()
    
    // Set up polling interval (every 2 seconds)
    const intervalId = setInterval(pollStatus, 2000)
    
    return () => clearInterval(intervalId)
  }, [conversationId])

  // Extract ONLY prompts and responses from conversation data
  const getMessages = () => {
    if (!conversationData) return []
    
    const messages: Array<{type: string, content: string, sender: string}> = []
    
    // Extract from flow_steps array (main prompts and responses)
    if (conversationData.flow_steps && Array.isArray(conversationData.flow_steps)) {
      conversationData.flow_steps.forEach((step: any) => {
        // Add prompt (instructions or prompt) as MO - ONLY if it's a user prompt
        const promptText = step.instructions || step.prompt
        if (promptText && promptText.trim()) {
          messages.push({ 
            type: 'prompt', 
            content: promptText, 
            sender: 'MO'
          })
        }
        
        // Add response as JAS
        if (step.response && step.response.trim()) {
          messages.push({ 
            type: 'response', 
            content: step.response, 
            sender: 'JAS'
          })
        }
      })
    }
    
    return messages
  }

  const messages = getMessages()

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
            Loading...
          </div>
        )}
        
        {error && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#f55' }}>
            Error: {error}
          </div>
        )}
        
        {!loading && messages.length === 0 && !error && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
            Waiting for conversation...
          </div>
        )}
        
        {messages.map((message, index) => (
          <div 
            key={index}
            style={{
              marginBottom: '15px',
              padding: '0'
            }}
          >
            <div style={{ 
              color: '#888',
              marginBottom: '5px',
              fontSize: '14px'
            }}>
              {message.sender}:
            </div>
            <div style={{ 
              whiteSpace: 'pre-wrap', 
              lineHeight: '1.4',
              fontSize: '14px',
              color: '#f0f0f0'
            }}>
              {message.content}
            </div>
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
            // On flow-run page, we don't need to navigate anywhere
            // The page will automatically update via polling
            console.log('Resume response:', responseData)
            
            // Check if resume returned a new conversation_id
            const newConversationId = 
              responseData?.data?.conversation_id ||
              responseData?.conversation_id ||
              responseData?.data?.new_conversation_id
            
            if (newConversationId && newConversationId !== conversationId) {
              console.log('New conversation_id from resume:', newConversationId)
              // Update conversation_id for polling
              setConversationId(newConversationId)
            }
          }}
          showHint={true}
        />
      </div>
    </div>
  )
}