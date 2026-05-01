'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'

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

export default function FlowRunPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [steps, setSteps] = useState<StepRun[]>([])
  const [loading, setLoading] = useState(true)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

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

  const handleSend = async () => {
    if (!input.trim() || sending) return
    setSending(true)
    try {
      await fetch('/api/proxy/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flowRunId: id, user_input: input }),
      })
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

  const formatTime = (ts: number | null) => {
    if (!ts) return ''
    return new Date(ts).toLocaleString()
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

        <div className="mt-12 flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="send input..."
            className="flex-1 bg-transparent text-white border-none outline-none text-sm placeholder-neutral-600"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="text-sm text-neutral-600 hover:text-white disabled:opacity-30 transition-colors"
          >
            {sending ? '...' : 'send'}
          </button>
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
