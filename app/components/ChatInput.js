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
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef(null)
  const suggestionsRef = useRef(null)

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

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target) &&
        inputRef.current && 
        !inputRef.current.contains(event.target)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputFocus = () => {
    if (variables.length > 0) {
      setShowSuggestions(true)
    }
  }

  const handleInputBlur = () => {
    // Delay hiding to allow clicking on suggestions
    setTimeout(() => {
      setShowSuggestions(false)
    }, 100)
  }

  const insertVariable = (variableName) => {
    const input = inputRef.current
    if (!input) return
    
    const start = input.selectionStart
    const end = input.selectionEnd
    const newValue = inputValue.substring(0, start) + `{{${variableName}=}}` + inputValue.substring(end)
    
    setInputValue(newValue)
    
    // Focus back on input and set cursor after = sign
    setTimeout(() => {
      input.focus()
      const newCursorPos = start + variableName.length + 5 // {{}}= + variable name
      input.setSelectionRange(newCursorPos, newCursorPos)
    }, 10)
  }

  const extractVariables = (text) => {
    const regex = /\{\{([^}=]+)(?:=([^}]*))?\}\}/g
    const variables = {}
    let match
    
    while ((match = regex.exec(text)) !== null) {
      const name = match[1].trim()
      const value = match[2] ? match[2].trim() : '' // Empty string if no value provided
      variables[name] = value
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
        console.log('Response:', data)
        
        // Call parent callback if provided
        if (onSend) {
          onSend(data)
        }
        
        // Clear input
        setInputValue('')
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
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
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
        
        {variables.length > 0 && showSuggestions && (
          <div 
            ref={suggestionsRef}
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '0',
              right: '0',
              backgroundColor: '#111',
              border: '1px solid #333',
              borderRadius: '8px',
              marginBottom: '10px',
              maxHeight: '200px',
              overflowY: 'auto',
              zIndex: 1000
            }}
          >
            {variables.map((variable, index) => (
              <div
                key={index}
                onClick={() => insertVariable(typeof variable === 'string' ? variable : variable.name)}
                style={{
                  padding: '10px 15px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #222',
                  color: '#888',
                  fontSize: '13px',
                  fontFamily: 'monospace'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#222'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                {typeof variable === 'string' ? variable : variable.name}
              </div>
            ))}
          </div>
        )}
        
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
          Hover over input to see variables • Click to insert • Use &#123;&#123;name=value&#125;&#125; syntax
        </div>
      )}
    </div>
  )
}