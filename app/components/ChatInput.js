'use client'

import { useState, useEffect, useRef } from 'react'

export default function ChatInput({ 
  flowId, 
  flowRunId, 
  onSend, 
  showHint = true,
  initialVariables = []
}) {
  const [rawText, setRawText] = useState('')
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

  // Format display text: replace {{var=value}} with var:value
  const getDisplayText = () => {
    return rawText.replace(/\{\{([^}=]+)=([^}]*)\}\}/g, (match, varName, value) => {
      return `${varName.trim()}:${value}`
    })
  }

  // Handle input change - just update rawText directly
  const handleInputChange = (e) => {
    const displayText = e.target.value
    
    // Convert display text back to raw format
    // Simple regex to convert var:value to {{var=value}}
    // This is a best-effort conversion for manual typing
    const varNames = variables.map(v => typeof v === 'string' ? v : v.name)
    let rawText = displayText
    
    if (varNames.length > 0) {
      // Build pattern for all variables
      const varPattern = varNames.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
      // Match var: value - capture everything until end or next variable pattern
      // Use [\s\S] to match across lines including spaces
      const regex = new RegExp(`(${varPattern}):\\s*([\\s\\S]*?)(?=\\s+(${varPattern}):|$)`, 'g')
      
      rawText = displayText.replace(regex, (match, varName, value) => {
        return `{{${varName}=${value}}}`
      })
    }
    
    setRawText(rawText)
  }

  const handleTab = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      
      if (variables.length === 0) return
      
      const varNames = variables.map(v => typeof v === 'string' ? v : v.name)
      const input = inputRef.current
      if (!input) return
      
      const cursorPos = input.selectionStart
      const displayText = input.value
      
      // Check if cursor is inside a variable (looking for var:value pattern)
      // We need to check the raw text
      const text = rawText
      
      console.log('Tab pressed - cursorPos:', cursorPos, 'displayText:', displayText, 'rawText:', text)
      console.log('Current display text from getDisplayText():', getDisplayText())
      
      // Check if cursor is inside a variable placeholder in raw text
      const regex = /\{\{([^}=]+)=([^}]*)\}\}/g
      let insideVar = -1
      let match
      let matchData = null
      while ((match = regex.exec(text)) !== null) {
        const varName = match[1].trim()
        const value = match[2]
        const displayPattern = `${varName}:${value}`
        const displayStart = getDisplayText().indexOf(displayPattern)
        console.log('Found variable in raw text:', varName, 'value:', value, 'displayPattern:', displayPattern, 'displayStart:', displayStart)
        
        if (displayStart >= 0) {
          const varEndPos = displayStart + varName.length + 1 + value.length
          console.log('Checking if cursorPos', cursorPos, 'is between', displayStart, 'and', varEndPos)
          if (cursorPos >= displayStart && cursorPos <= varEndPos) {
            insideVar = varNames.indexOf(varName)
            matchData = { 
              index: match.index, 
              value: value, 
              varName, 
              length: match[0].length,
              displayStart
            }
            console.log('Cursor is inside variable:', varName, 'insideVar index:', insideVar)
            break
          }
        }
      }
      
      if (insideVar >= 0 && matchData) {
        // Move to next variable
        const nextIndex = (insideVar + 1) % varNames.length
        setCurrentVarIndex(nextIndex)
        
        // Replace current variable with next one
        const newText = text.substring(0, matchData.index) + 
                       `{{${varNames[nextIndex]}=}}` + 
                       text.substring(matchData.index + matchData.length)
        setRawText(newText)
        
        // Position cursor after colon
        setTimeout(() => {
          input.focus()
          // Calculate display text from newText directly
          const newDisplayText = newText.replace(/\{\{([^}=]+)=([^}]*)\}\}/g, (match, vName, value) => {
            return `${vName.trim()}:${value}`
          })
          console.log('Cycling cursor - newDisplayText:', newDisplayText, 'nextVar:', varNames[nextIndex])
          // Find position after colon
          const colonPos = newDisplayText.indexOf(`${varNames[nextIndex]}:`) + varNames[nextIndex].length + 1
          console.log('colonPos:', colonPos)
          input.setSelectionRange(colonPos, colonPos)
        }, 10)
      } else {
        // Start with first variable
        setCurrentVarIndex(0)
        const varName = varNames[0]
        const newText = text + (text && !text.endsWith(' ') ? ' ' : '') + `{{${varName}=}}`
        setRawText(newText)
        
        // Position cursor after colon
        setTimeout(() => {
          input.focus()
          // Calculate display text from newText directly
          const newDisplayText = newText.replace(/\{\{([^}=]+)=([^}]*)\}\}/g, (match, vName, value) => {
            return `${vName.trim()}:${value}`
          })
          console.log('Setting cursor - newDisplayText:', newDisplayText, 'length:', newDisplayText.length)
          // Find position after colon
          const colonPos = newDisplayText.lastIndexOf(`${varName}:`) + varName.length + 1
          console.log('varName:', varName, 'length:', varName.length, 'colonPos:', colonPos)
          input.setSelectionRange(colonPos, colonPos)
          console.log('Selection set to:', colonPos, 'current selection:', input.selectionStart, input.selectionEnd)
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
    if (!rawText.trim()) return
    
    const extractedVars = extractVariables(rawText)
    
    try {
      let endpoint = '/api/proxy/start'
      let body = {
        flow_id: flowId,
        input_prompt: rawText
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
          user_input: rawText
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
        setRawText('')
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
          value={getDisplayText()}
          onChange={handleInputChange}
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
          disabled={!rawText.trim()}
          style={{
            position: 'absolute',
            right: '10px',
            bottom: '10px',
            backgroundColor: rawText.trim() ? '#333' : '#222',
            color: rawText.trim() ? '#f0f0f0' : '#666',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 16px',
            cursor: rawText.trim() ? 'pointer' : 'not-allowed',
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
          Press Tab to insert variables • Variable names shown before colon • Type values after colon • Empty variables are removed automatically
        </div>
      )}
    </div>
  )
}