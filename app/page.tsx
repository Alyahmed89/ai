'use client'

import { useState } from 'react'
import ChatInput from '@/components/ChatInput'

export default function Home() {
  const [flowId, setFlowId] = useState('')

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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ fontSize: '24px', marginBottom: '10px' }}>AI Flow Interface</h1>
          <p style={{ color: '#888', fontSize: '14px' }}>Enter a flow ID or use the input below</p>
          
          <div style={{ marginTop: '20px' }}>
            <input
              type="text"
              placeholder="Enter flow ID (e.g., flow-def-...)"
              value={flowId}
              onChange={(e) => setFlowId(e.target.value)}
              style={{
                backgroundColor: '#1a1a1a',
                color: '#f0f0f0',
                border: '1px solid #333',
                padding: '10px 15px',
                borderRadius: '4px',
                width: '300px',
                fontSize: '14px',
                fontFamily: 'monospace'
              }}
            />
            <button
              onClick={() => {
                if (flowId.trim()) {
                  window.location.href = `/chat/flows/${flowId.trim()}`
                }
              }}
              style={{
                backgroundColor: '#333',
                color: '#f0f0f0',
                border: '1px solid #444',
                padding: '10px 15px',
                borderRadius: '4px',
                marginLeft: '10px',
                fontSize: '14px',
                fontFamily: 'monospace',
                cursor: 'pointer'
              }}
            >
              Go to Flow
            </button>
          </div>
        </div>
      </div>
      
      {/* Chat input at the bottom */}
      <div style={{ 
        marginTop: 'auto',
        paddingTop: '20px',
        borderTop: '1px solid #333'
      }}>
        <ChatInput 
          onSend={() => {
            // Homepage doesn't need to do anything on send
            console.log('Message sent from homepage')
          }}
          showHint={true}
        />
      </div>
    </div>
  )
}