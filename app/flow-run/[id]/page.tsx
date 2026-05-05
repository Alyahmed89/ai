'use client'

export const runtime = 'edge'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ContextChatTrigger } from '@/components/ContextChatTrigger'
import type { StepRunResult } from '@/types'

interface StepRun {
  id: string
  flow_run_id: string
  step_id: string
  status: string
  input: string | null
  output: string | null
  ai_response: string | Record<string, unknown> | null
  resolved_variables: Record<string, string> | null
  order_index: number
  started_at: number | null
  completed_at: number | null
  error: string | null
  result?: StepRunResult | null
}

interface FlowStep {
  id: string
  flow_id: string
  title: string
  instructions: string | null
  ref: string | null
  order_index: number
}

interface StepRunWithDef extends StepRun {
  definition?: FlowStep
}

const DEFAULT_VARIABLES = ['goal', 'memory', 'memory_prompt']
const API_BASE = '/api/proxy'

export default function FlowRunPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = params?.id as string
  const flowId = searchParams?.get('flowId') || ''

  const [steps, setSteps] = useState<StepRunWithDef[]>([])
  const [loading, setLoading] = useState(true)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showVars, setShowVars] = useState(false)
  const [selectedVarIdx, setSelectedVarIdx] = useState(0)
  const [correctionStarting, setCorrectionStarting] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [variables, setVariables] = useState<string[]>(DEFAULT_VARIABLES)

  const fetchData = useCallback(async () => {
    if (!id) return
    try {
      const [stepsRes, defsRes] = await Promise.all([
        fetch(`/api/proxy/api/step-runs?flow_run_id=${id}`),
        fetch('/api/proxy/api/flow-steps'),
      ])

      let defs: FlowStep[] = []
      if (defsRes.ok) {
        const defsData = await defsRes.json()
        defs = Array.isArray(defsData) ? defsData : []
      }

      if (stepsRes.ok) {
        const stepsData = await stepsRes.json()
        const parsed: StepRunWithDef[] = (Array.isArray(stepsData) ? stepsData : []).map(
          (s: StepRun) => ({
            ...s,
            definition: defs.find((d) => d.id === s.step_id),
          })
        )
        if (parsed.length > 0) {
          setSteps(parsed)
        }
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

  const startCorrectionFlow = async (stepRun: StepRunWithDef) => {
    const proCheck = stepRun.result?.pro_check
    if (!proCheck?.correction_flow?.flow_id) return

    setCorrectionStarting(stepRun.id)
    try {
      const cf = proCheck.correction_flow
      const inputVariables: Record<string, unknown> = {}
      for (const v of cf.variables) {
        inputVariables[v.name] = v.value
      }
      inputVariables.var_original_flow_run_id = id

      const res = await fetch(`${API_BASE}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flowId: cf.flow_id,
          input_variables: inputVariables,
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        console.error('Failed to start correction flow', errText)
        alert(`Failed to start correction flow: ${res.status} ${errText}`)
        setCorrectionStarting(null)
        return
      }

      const data = await res.json()
      if (data.flowRunId) {
        window.open(`/flow-run/${data.flowRunId}`, '_blank')
      }
    } catch (e) {
      console.error('Failed to start correction flow', e)
      alert(`Error starting correction flow: ${e}`)
    }
    setCorrectionStarting(null)
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
          <div className="space-y-8">
            {steps
              .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
              .map((step) => (
                <div key={step.id} className="border border-neutral-800 rounded p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs text-neutral-500">#{step.order_index}</span>
                    {step.definition?.ref && (
                      <span className="text-xs text-amber-400/70">{step.definition.ref}</span>
                    )}
                    {step.definition?.title && (
                      <span className="text-sm text-white font-semibold">{step.definition.title}</span>
                    )}
                    <span className="text-xs text-neutral-600">{step.step_id}</span>
                    <span className="text-xs text-neutral-500 ml-auto">{step.status}</span>
                  </div>

                  {step.definition?.instructions && (
                    <p className="text-xs text-neutral-400 mb-3 italic">{step.definition.instructions}</p>
                  )}

                  {step.ai_response && (
                    <div className="mb-2">
                      <span className="text-[10px] text-neutral-600 uppercase tracking-wider">
                        ai response
                        <ContextChatTrigger
                          label="ai_response"
                          value={step.ai_response}
                          stepRunId={step.id}
                          flowRunId={id}
                        />
                      </span>
                      <JsonBlock
                        value={typeof step.ai_response === 'string' ? step.ai_response : JSON.stringify(step.ai_response)}
                        stepId={step.id}
                        field="ai_response"
                        editingKey={editingKey}
                        editValue={editValue}
                        onStartEdit={startEdit}
                        onSave={saveEdit}
                        onChange={setEditValue}
                      />
                    </div>
                  )}

                  {step.resolved_variables && Object.keys(step.resolved_variables).length > 0 && (
                    <div>
                      <span className="text-[10px] text-neutral-600 uppercase tracking-wider">resolved variables</span>
                      <div className="space-y-1">
                        {Object.entries(step.resolved_variables).map(([key, val]) => (
                          <div key={key} className="flex items-start gap-2 text-xs">
                            <span className="text-neutral-500 shrink-0">{key}:</span>
                            <span className="text-neutral-400 break-all">
                              {val}
                              <ContextChatTrigger
                                label={key}
                                value={val}
                                stepRunId={step.id}
                                flowRunId={id}
                              />
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pro Check Request */}
                  {step.result?.pro_check_request && (
                    <div className="mb-2">
                      <span className="text-[10px] text-neutral-600 uppercase tracking-wider">
                        pro check request
                        <ContextChatTrigger
                          label="pro_check_request"
                          value={step.result.pro_check_request}
                          stepRunId={step.id}
                          flowRunId={id}
                          relatedRules={step.result.pro_check_request.rules}
                        />
                      </span>
                      <JsonBlock
                        value={JSON.stringify(step.result.pro_check_request)}
                        stepId={step.id}
                        field="result.pro_check_request"
                        editingKey={editingKey}
                        editValue={editValue}
                        onStartEdit={startEdit}
                        onSave={saveEdit}
                        onChange={setEditValue}
                      />
                    </div>
                  )}

                  {/* Pro Check */}
                  {step.result?.pro_check && (
                    <div className="mb-2">
                      <span className="text-[10px] text-neutral-600 uppercase tracking-wider">
                        pro check
                        <ContextChatTrigger
                          label="pro_check"
                          value={step.result.pro_check}
                          stepRunId={step.id}
                          flowRunId={id}
                        />
                      </span>
                      <div className={`text-xs font-mono whitespace-pre-wrap ${
                        step.result.pro_check.status === 'stop'
                          ? 'text-red-400/80'
                          : step.result.pro_check.status === 'approve'
                          ? 'text-green-400/80'
                          : 'text-neutral-400'
                      }`}>
                        {JSON.stringify(step.result.pro_check, null, 2)}
                      </div>
                    </div>
                  )}

                  {/* Correction Flow Button */}
                  {step.result?.pro_check?.status === 'stop' &&
                    step.result.pro_check.correction_flow?.flow_id && (
                    <div className="mt-3 pt-3 border-t border-neutral-800">
                      <button
                        onClick={() => startCorrectionFlow(step)}
                        disabled={correctionStarting === step.id}
                        className="text-xs text-amber-400/70 hover:text-amber-300
                                   disabled:opacity-30 transition-colors"
                      >
                        {correctionStarting === step.id
                          ? 'starting...'
                          : 'Start Correction Flow →'}
                      </button>
                    </div>
                  )}

                  {step.error && (
                    <p className="text-xs text-red-500 mt-2">{step.error}</p>
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
