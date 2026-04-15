'use client'

import { useState, useEffect, useRef } from 'react'

export default function ChatInput({ 
  flowId, 
  flowRunId, 
  onSend, 
  showHint = true,
  initialVariables = []
}) {
  const [inputValue, setInputValue] = useState('')
  const [variables, setVariables] = useState(initialVariables)
  const [currentVarIndex, setCurrentVarIndex] = useState(-1)
  const inputRef = useRef(null)

  // Load variables based on whether we're on flow page or flow-run page
  useEffect(() => {
    const loadVariables = async () => {
      try {
        // Always try to get variables from flowId if available (both flow page and flow-run page)
        if (flowId) {
          const response = await fetch(`/api/proxy/api/flows/${flowId}/variables`)
          if (response.ok) {
            const data = await response.json()
            // Extract variables from response - they could be in data.all_variables or data.data.all_variables
            const variables = data?.data?.all_variables || data?.all_variables || []
            setVariables(variables)
            return
          }
        }
        
        // If no flowId or flow variables endpoint failed, try resume endpoint for flow-run page
        if (flowRunId && !flowId) {
          // On flow-run page without flowId: try resume endpoint
          const response = await fetch('/api/proxy/resume', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              flow_run_id: flowRunId
            })
          })
          
          if (response.ok) {
            const data = await response.json()
            console.log('Resume data for variables:', data)
            // Extract variables from resume response
            // The structure might vary - check for variables in different locations
            const variables = 
              data?.variables || 
              data?.data?.variables || 
              data?.data?.all_variables || 
              data?.all_variables || 
              []
            setVariables(variables)
          } else {
            console.error('Failed to load resume variables:', response.status)
            setVariables([])
          }
        }
      } catch (error) {
        console.error('Error loading variables:', error)
        setVariables([])
      }
    }

    if (flowId || flowRunId) {
      loadVariables()
    }
  }, [flowId, flowRunId])

  const handleTab = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      
      if (variables.length === 0) return
      
      const varNames = variables.map(v => typeof v === 'string' ? v : v.name)
      
      // Find current cursor position
      const input = inputRef.current
      if (!input) return
      
      const cursorPos = input.selectionStart
      const text = inputValue
      
      // Check if cursor is inside a variable placeholder
      const regex = /\{\{([^}=]+)=([^}]*)\}\}/g
      let insideVar = -1
      let match
      let matchData = null
      while ((match = regex.exec(text)) !== null) {
        if (cursorPos >= match.index && cursorPos <= match.index + match[0].length) {
          const varName = match[1].trim()
          insideVar = varNames.indexOf(varName)
          matchData = { index: match.index, value: match[2].trim(), varName }
          break
        }
      }
      
      if (insideVar >= 0 && matchData) {
        // Move to next variable
        const nextIndex = (insideVar + 1) % varNames.length
        setCurrentVarIndex(nextIndex)
        
        // Replace current variable with next one
        const newText = text.substring(0, matchData.index) + 
                       `{{${varNames[nextIndex]}=}}` + 
                       text.substring(matchData.index + match[0].length)
        setInputValue(newText)
        
        // Position cursor after = sign
        setTimeout(() => {
          input.focus()
          const newPos = matchData.index + varNames[nextIndex].length + 5 // {{}}= + variable name
          input.setSelectionRange(newPos, newPos)
        }, 10)
      } else {
        // Start with first variable
        setCurrentVarIndex(0)
        const varName = varNames[0]
        const newText = text + (text && !text.endsWith(' ') ? ' ' : '') + `{{${varName}=}}`
        setInputValue(newText)
        
        // Position cursor after = sign
        setTimeout(() => {
          input.focus()
          const newPos = newText.length - 2 // Position before }}
          input.setSelectionRange(newPos, newPos)
        }, 10)
      }
    }
  }

  const extractVariables = (text) => {
    const regex = /\{\{([^}=]+)=([^}]*)\}\}/g
    const variables = {}
    let match
    
    while ((match = regex.exec(text)) !== null) {
      const name = match[1].trim()
      const value = match[2].trim()
      // Only include non-empty variables
      if (value) {
        variables[name] = value
      }
    }
    
    return variables
  }

  const handleSend = async () => {
    if (!inputValue.trim()) return
    
    const extractedVars = extractVariables(inputValue)
    
    try {
      let endpoint = '/api/proxy/start'
      let body = {
        flow_id: flowId,
        input_prompt: inputValue
      }

      // Add variables if any
      if (Object.keys(extractedVars).length > 0) {
        body.variables = extractedVars
      }

      if (flowRunId) {
        // On flow-run page: use resume endpoint
        endpoint = '/api/proxy/resume'
        body = {
          flow_run_id: flowRunId,
          user_input: inputValue
        }
        
        // Add variables if any
        if (Object.keys(extractedVars).length > 0) {
          body.variables = extractedVars
        }
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      })
      
      if (response.ok) {
        const data = await response.json()
        
        // Call parent callback if provided
        if (onSend) {
          onSend(data)
        }
        
        // Clear input
        setInputValue('')
        setCurrentVarIndex(-1)
      } else {
        const errorText = await response.text()
        console.error('Failed:', response.status, errorText)
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    } else if (e.key === 'Tab') {
      handleTab(e)
    }
  }

  return (
    <div style={{ 
      width: '100%',
      maxWidth: '600px',
      margin: '0 auto'
    }}>
      <div style={{ position: 'relative' }}>
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message... (Press Tab for variables)"
          style={{
            width: '100%',
            minHeight: '60px',
            padding: '15px',
            backgroundColor: '#1a1a1a',
            color: '#f0f0f0',
            border: '1px solid #333',
            borderRadius: '8px',
            fontSize: '14px',
            fontFamily: 'monospace',
            resize: 'vertical',
            outline: 'none'
          }}
        />
        
        <button
          onClick={handleSend}
          disabled={!inputValue.trim()}
          style={{
            position: 'absolute',
            right: '10px',
            bottom: '10px',
            backgroundColor: inputValue.trim() ? '#333' : '#222',
            color: inputValue.trim() ? '#f0f0f0' : '#666',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 16px',
            cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
            fontSize: '14px',
            fontFamily: 'monospace'
          }}
        >
          Send
        </button>
      </div>
      
      {showHint && (
        <div style={{ 
          marginTop: '10px',
          fontSize: '12px',
          color: '#666',
          textAlign: 'center',
          fontFamily: 'monospace'
        }}>
          Press Tab to insert variables • Type values after = sign • Empty variables are removed automatically
        </div>
      )}
    </div>
  )
}