'use client'

export const runtime = 'edge'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

interface StepRun {
  id: string
  flow_run_id: string
  step_id: string
  status: string
  input: string | null
  output: string | null
  ai_response: string | null
  resolved_variables: Record<string, string> | null
  order_index: number
  started_at: number | null
  completed_at: number | null
  error: string | null
}

const DEFAULT_VARIABLES = ['goal', 'memory', 'memory_prompt']

export default function FlowRunPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = params?.id as string
  const flowId = searchParams?.get('flowId') || ''

  const [steps, setSteps] = useState<StepRun[]>([])
  const [loading, setLoading] = useState(true)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showVars, setShowVars] = useState(false)
  const [selectedVarIdx, setSelectedVarIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const [variables, setVariables] = useState<string[]>(DEFAULT_VARIABLES)

  const fetchData = useCallback(async () => {
    if (!id) return
    try {
      const stepsRes = await fetch(`/api/proxy/api/step-runs?flow_run_id=${id}`)
      if (stepsRes.ok) {
        const stepsData = await stepsRes.json()
        setSteps(Array.isArray(stepsData) ? stepsData : [])
      }
    } catch (e) {
      console.error('Failed to fetch step runs', e)
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 3000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Extract available_variables from step run context
  useEffect(() => {
    for (const step of steps) {
      const ctx = (step as any).context
      if (ctx?.available_variables) {
        setVariables(ctx.available_variables)
        return
      }
    }
  }, [steps])

  const insertVariable = (name: string) => {
    const prefix = input ? ' ' : ''
    setInput((prev) => prev + prefix + name)
    setShowVars(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (showVars) {
        insertVariable(variables[selectedVarIdx])
        return
      }
      handleSend()
      return
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      if (showVars) {
        insertVariable(variables[selectedVarIdx])
      } else {
        setSelectedVarIdx(0)
        setShowVars(true)
      }
      return
    }

    if (showVars) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedVarIdx((prev) => (prev + 1) % variables.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedVarIdx((prev) => (prev - 1 + variables.length) % variables.length)
        return
      }
      if (e.key === 'Escape') {
        setShowVars(false)
        return
      }
    }

    setShowVars(false)
  }

  const handleSend = async () => {
    if (sending) return
    setSending(true)
    try {
      const body = {
        input_variables: {
          goal: input || '',
        },
      }

      if (steps.length === 0 && flowId) {
        // No flow run yet — start the flow
        await fetch('/api/proxy/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ flowId, ...body }),
        })
      } else {
        // Flow run exists — resume
        await fetch('/api/proxy/resume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ flowRunId: id, ...body }),
        })
      }
      setInput('')
      setTimeout(fetchData, 500)
    } catch (e) {
      console.error('Failed to send', e)
    }
    setSending(false)
  }

  const startEdit = (key: string, value: string) => {
    setEditingKey(key)
    setEditValue(value)
  }

  const saveEdit = async (stepId: string, field: string) => {
    if (editingKey !== `${stepId}-${field}`) return
    setEditingKey(null)
    try {
      await fetch(`/api/proxy/api/step-runs/${stepId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: editValue }),
      })
      fetchData()
    } catch (e) {
      console.error('Failed to save', e)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white font-mono">
        <div className="max-w-3xl mx-auto px-6 py-12 text-neutral-600">loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <button onClick={() => router.push('/')} className="text-neutral-600 hover:text-white mb-8">
          &larr; back
        </button>

        <div className="mb-8">
          <h1 className="text-lg mb-2">flow run</h1>
          <p className="text-neutral-600 text-xs">{id}</p>
        </div>

        {steps.length === 0 ? (
          <p className="text-neutral-600">no steps yet</p>
        ) : (
          <div className="space-y-6">
            {steps
              .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
              .map((step) => (
                <div key={step.id}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs text-neutral-600">{step.order_index}</span>
                    <span className="text-xs text-neutral-400">{step.step_id}</span>
                    <span className="text-xs text-neutral-600">{step.status}</span>
                  </div>

                  {step.ai_response && (
                    <JsonBlock
                      value={step.ai_response}
                      stepId={step.id}
                      field="ai_response"
                      editingKey={editingKey}
                      editValue={editValue}
                      onStartEdit={startEdit}
                      onSave={saveEdit}
                      onChange={setEditValue}
                    />
                  )}

                  {step.resolved_variables && Object.keys(step.resolved_variables).length > 0 && (
                    <JsonBlock
                      value={JSON.stringify(step.resolved_variables)}
                      stepId={step.id}
                      field="resolved_variables"
                      editingKey={editingKey}
                      editValue={editValue}
                      onStartEdit={startEdit}
                      onSave={saveEdit}
                      onChange={setEditValue}
                    />
                  )}

                  {step.error && (
                    <p className="text-xs text-neutral-600 mt-1">{step.error}</p>
                  )}
                </div>
              ))}
          </div>
        )}

        <div className="mt-12 flex gap-3 relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => setShowVars(false), 150)}
            placeholder="send input... (tab for variables)"
            className="flex-1 bg-transparent text-white border-none outline-none text-sm placeholder-neutral-600"
          />
          <button
            onClick={handleSend}
            disabled={sending}
            className="text-sm text-neutral-600 hover:text-white disabled:opacity-30 transition-colors"
          >
            {sending ? '...' : 'send'}
          </button>

          {showVars && variables.length > 0 && (
            <div className="absolute bottom-full left-0 mb-1 bg-neutral-900 border border-neutral-800 text-xs">
              {variables.map((v, i) => (
                <div
                  key={v}
                  onMouseDown={(e) => { e.preventDefault(); insertVariable(v) }}
                  className={`px-3 py-1.5 cursor-pointer ${
                    i === selectedVarIdx ? 'text-white bg-neutral-800' : 'text-neutral-400'
                  }`}
                >
                  {v}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function JsonBlock({
  value,
  stepId,
  field,
  editingKey,
  editValue,
  onStartEdit,
  onSave,
  onChange,
}: {
  value: string
  stepId: string
  field: string
  editingKey: string | null
  editValue: string
  onStartEdit: (key: string, value: string) => void
  onSave: (stepId: string, field: string) => void
  onChange: (val: string) => void
}) {
  const key = `${stepId}-${field}`
  const isEditing = editingKey === key

  let formatted: string
  try {
    formatted = JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    formatted = value
  }

  return (
    <div className="mb-2">
      {isEditing ? (
        <textarea
          value={editValue}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => onSave(stepId, field)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { onChange(value); onStartEdit('', '') }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { onSave(stepId, field) }
          }}
          className="w-full bg-transparent text-white text-xs border-none outline-none resize-none"
          rows={Math.max(3, formatted.split('\n').length)}
          autoFocus
        />
      ) : (
        <pre
          onClick={() => onStartEdit(key, value)}
          className="text-xs text-neutral-400 cursor-pointer hover:text-white whitespace-pre-wrap"
        >
          {formatted}
        </pre>
      )}
    </div>
  )
}
