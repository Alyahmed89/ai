'use client'

export const runtime = 'edge'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ContextChatTrigger } from '@/components/ContextChatTrigger'
import type { StepRunResult } from '@/types'

/* ── Types ── */

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

interface ExpectedResponseProperty {
  type?: string
  required?: string[]
  properties?: Record<string, unknown>
  additionalProperties?: boolean
}

interface ExpectedResponse {
  type?: string
  required?: string[]
  properties?: Record<string, ExpectedResponseProperty | unknown>
  additionalProperties?: boolean
}

interface FlowStep {
  id: string
  flow_id: string
  title: string
  instructions: string | null
  ref: string | null
  order_index: number
  expected_response?: ExpectedResponse | null
}

interface StepRunWithDef extends StepRun {
  definition?: FlowStep
}

/** A single event from GET /flow-runs/:id/events */
interface FlowEvent {
  type: 'step.start' | 'llm.call' | 'llm.response' | 'api.call' | 'api.complete'
      | 'routing.ai' | 'routing.order' | 'flow.complete' | 'flow.error'
  data: Record<string, unknown>
  timestamp: string
}

/** Display metadata on an available variable */
interface DisplayMeta {
  ui_input?: boolean
  ui_display?: 'table' | 'json' | 'html' | 'code' | 'text'
  label?: string
}

/** A variable the flow exposes for user input or display */
interface AvailableVariable {
  name: string
  value?: unknown
  display?: DisplayMeta
}

/** Response from GET /flow-runs/:id/context */
interface FlowContext {
  available_variables?: AvailableVariable[]
  steps?: FlowStep[]
  current_step_id?: string
  flow_status?: string
}

const API_BASE = '/api/proxy'

/** Recursively format a value as YAML-like text. */
function formatYaml(key: string, value: unknown, indent: number = 0): string {
  const pad = '  '.repeat(indent)
  if (value === null || value === undefined) {
    return `${pad}- ${key}: null`
  }
  if (typeof value === 'string') {
    // Collapse multi-line strings into a single line
    const inline = value.replace(/\s+/g, ' ').trim()
    return `${pad}- ${key}: ${inline}`
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return `${pad}- ${key}: ${String(value)}`
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}- ${key}: []`
    const lines = [`${pad}- ${key}:`]
    for (const item of value) {
      if (typeof item === 'object' && item !== null) {
        lines.push(`${pad}  - ${JSON.stringify(item)}`)
      } else {
        lines.push(`${pad}  - ${String(item)}`)
      }
    }
    return lines.join('\n')
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return `${pad}- ${key}: {}`
    const lines = [`${pad}- ${key}:`]
    for (const [k, v] of entries) {
      lines.push(formatYaml(k, v, indent + 1))
    }
    return lines.join('\n')
  }
  return `${pad}- ${key}: ${String(value)}`
}

/** A single chat bubble — click to toggle YAML details. */
function ChatBubble({ msg }: {
  msg: { role: 'user' | 'assistant'; text: string; data: Record<string, unknown>; id: string }
}) {
  const [open, setOpen] = useState(false)
  const hasData = Object.keys(msg.data).length > 0

  const yamlLines = hasData
    ? Object.entries(msg.data).map(([k, v]) => formatYaml(k, v)).join('\n')
    : ''

  return (
    <div
      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed cursor-pointer select-none ${
          msg.role === 'user'
            ? 'bg-blue-600 text-white rounded-br-md'
            : 'bg-neutral-800 text-neutral-200 rounded-bl-md'
        }`}
        onClick={() => setOpen(!open)}
      >
        <div>-- {msg.text}</div>
        {hasData && open && (
          <pre className="mt-2 pt-2 border-t border-white/10 text-xs text-neutral-300 whitespace-pre-wrap font-sans">
            {yamlLines}
          </pre>
        )}
      </div>
    </div>
  )
}

/* ── Display Renderers ── */

/** Render a value according to its display.ui_display hint */
function DisplayValue({ value, display }: { value: unknown; display?: DisplayMeta['ui_display'] }) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value, null, 2)

  switch (display) {
    case 'table':
      return <TableRenderer data={value} />
    case 'json':
      return <JsonRenderer raw={raw} />
    case 'html':
      return <HtmlRenderer raw={raw} />
    case 'code':
      return <CodeRenderer raw={raw} />
    case 'text':
    default:
      return <span className="text-neutral-300 text-xs whitespace-pre-wrap">{raw}</span>
  }
}

function TableRenderer({ data }: { data: unknown }) {
  const rows = Array.isArray(data) ? data : typeof data === 'object' && data ? [data] : []
  if (rows.length === 0) return <span className="text-neutral-500 text-xs">(empty)</span>
  const keys = [...new Set(rows.flatMap((r: unknown) => Object.keys(r as Record<string, unknown>)))]
  return (
    <div className="overflow-x-auto text-xs">
      <table className="min-w-full border-collapse border border-neutral-700">
        <thead>
          <tr className="bg-neutral-800">
            {keys.map((k) => (
              <th key={k} className="border border-neutral-700 px-2 py-1 text-left text-neutral-400 font-medium">{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row: unknown, i: number) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-neutral-900' : 'bg-neutral-850'}>
              {keys.map((k) => (
                <td key={k} className="border border-neutral-700 px-2 py-1 text-neutral-300">
                  {String((row as Record<string, unknown>)[k] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function JsonRenderer({ raw }: { raw: string }) {
  let formatted = raw
  try { formatted = JSON.stringify(JSON.parse(raw), null, 2) } catch { /* ok */ }
  return (
    <pre className="text-xs text-amber-300/90 bg-amber-950/20 rounded p-2 overflow-x-auto whitespace-pre-wrap font-mono">
      {formatted}
    </pre>
  )
}

function HtmlRenderer({ raw }: { raw: string }) {
  return (
    <div
      className="text-xs text-neutral-300 prose prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: raw }}
    />
  )
}

function CodeRenderer({ raw }: { raw: string }) {
  return (
    <pre className="text-xs text-emerald-300/90 bg-emerald-950/20 rounded p-2 overflow-x-auto whitespace-pre-wrap font-mono">
      {raw}
    </pre>
  )
}

/* ── Execution Trace ── */

/** A single line in the execution trace */
function TraceEvent({ event }: { event: FlowEvent }) {
  const { type, data } = event

  switch (type) {
    case 'step.start':
      return (
        <div className="flex items-start gap-2 text-xs text-blue-400">
          <span className="shrink-0 mt-0.5">▶</span>
          <div>
            <span className="font-semibold">Step: </span>
            <span>{String(data.title || data.ref || data.step_id || 'unknown')}</span>
            {!!data.ref && <span className="text-neutral-500 ml-1">({String(data.ref)})</span>}
          </div>
        </div>
      )

    case 'llm.call':
      return (
        <div className="flex items-start gap-2 text-xs text-purple-400">
          <span className="shrink-0 mt-0.5">🤖</span>
          <div>
            <span className="font-semibold">Calling AI...</span>
            {!!data.prompt && (
              <div className="mt-0.5 text-purple-300/70 line-clamp-3">{String(data.prompt)}</div>
            )}
          </div>
        </div>
      )

    case 'llm.response':
      return (
        <div className="flex items-start gap-2 text-xs text-purple-300">
          <span className="shrink-0 mt-0.5">✓</span>
          <div>
            <span className="font-semibold">AI Response</span>
            {!!data.response && (
              <div className="mt-0.5 text-purple-200/70 line-clamp-3">{String(data.response)}</div>
            )}
          </div>
        </div>
      )

    case 'api.call':
      return (
        <div className="flex items-start gap-2 text-xs text-amber-400">
          <span className="shrink-0 mt-0.5">↗</span>
          <div>
            <span className="font-semibold">Calling API: </span>
            <span>{String(data.method || 'GET')} {String(data.url || data.endpoint || '')}</span>
          </div>
        </div>
      )

    case 'api.complete':
      return (
        <div className="flex items-start gap-2 text-xs text-amber-300">
          <span className="shrink-0 mt-0.5">✓</span>
          <div>
            <span className="font-semibold">API Complete </span>
            {data.status_code != null && (
              <span className={Number(data.status_code) >= 400 ? 'text-red-400' : 'text-green-400'}>
                {String(data.status_code)}
              </span>
            )}
            {!!data.body && (
              <div className="mt-0.5 text-amber-200/70 line-clamp-2">{String(data.body)}</div>
            )}
          </div>
        </div>
      )

    case 'routing.ai':
      return (
        <div className="flex items-start gap-2 text-xs text-cyan-400">
          <span className="shrink-0 mt-0.5">→</span>
          <div>
            <span className="font-semibold">Routing to next step: </span>
            <span>{String(data.step_title || data.ref || data.step_id || 'unknown')}</span>
          </div>
        </div>
      )

    case 'routing.order':
      return (
        <div className="flex items-start gap-2 text-xs text-cyan-400">
          <span className="shrink-0 mt-0.5">→</span>
          <div>
            <span className="font-semibold">Advancing to next step by order</span>
          </div>
        </div>
      )

    case 'flow.complete':
      return (
        <div className="flex items-start gap-2 text-xs text-green-400">
          <span className="shrink-0 mt-0.5">✓</span>
          <div>
            <span className="font-semibold">Flow Complete</span>
            {!!data.message && <div className="mt-0.5 text-green-300/70">{String(data.message)}</div>}
          </div>
        </div>
      )

    case 'flow.error':
      return (
        <div className="flex items-start gap-2 text-xs text-red-400">
          <span className="shrink-0 mt-0.5">✗</span>
          <div>
            <span className="font-semibold">Flow Error</span>
            {!!(data.message || data.error) && (
              <div className="mt-0.5 text-red-300/70">{String(data.message || data.error)}</div>
            )}
          </div>
        </div>
      )

    default:
      return (
        <div className="flex items-start gap-2 text-xs text-neutral-500">
          <span className="shrink-0 mt-0.5">•</span>
          <div>
            <span className="font-semibold">{type}</span>
            {Object.keys(data).length > 0 && (
              <pre className="mt-0.5 text-neutral-500 whitespace-pre-wrap">{JSON.stringify(data)}</pre>
            )}
          </div>
        </div>
      )
  }
}

/** Live execution trace panel */
function ExecutionTrace({ events }: { events: FlowEvent[] }) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events.length])

  if (events.length === 0) return null

  return (
    <div className="border border-neutral-800 rounded-lg overflow-hidden">
      <div className="bg-neutral-900 px-3 py-1.5 text-[10px] text-neutral-500 uppercase tracking-wider border-b border-neutral-800">
        Execution Trace
      </div>
      <div className="px-3 py-2 space-y-2 max-h-80 overflow-y-auto">
        {events.map((ev, i) => (
          <TraceEvent key={i} event={ev} />
        ))}
        <div ref={endRef} />
      </div>
    </div>
  )
}

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
  const [correctionStarting, setCorrectionStarting] = useState<string | null>(null)
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [chatMode, setChatMode] = useState(false)
  const [events, setEvents] = useState<FlowEvent[]>([])
  const [context, setContext] = useState<FlowContext | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  /* ── Fetch step runs + definitions (kept for debug mode & resume) ── */
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

  /* ── Poll events from /flow-runs/:id/events ── */
  const fetchEvents = useCallback(async () => {
    if (!id) return
    try {
      const res = await fetch(`/api/proxy/api/flow-runs/${id}/events`)
      if (res.ok) {
        const data = await res.json()
        const list = Array.isArray(data) ? data : data?.events ?? []
        if (list.length > 0) {
          setEvents(list)
        }
      }
    } catch {
      /* endpoint may not exist yet — silently ignore */
    }
  }, [id])

  /* ── Fetch context from /flow-runs/:id/context ── */
  const fetchContext = useCallback(async () => {
    if (!id) return
    try {
      const res = await fetch(`/api/proxy/api/flow-runs/${id}/context`)
      if (res.ok) {
        const data = await res.json()
        setContext(data)
      }
    } catch {
      /* endpoint may not exist yet */
    }
  }, [id])

  useEffect(() => {
    fetchData()
    fetchEvents()
    fetchContext()

    const interval = setInterval(fetchData, 3000)
    const eventsInterval = setInterval(fetchEvents, 800)
    const contextInterval = setInterval(fetchContext, 5000)
    return () => {
      clearInterval(interval)
      clearInterval(eventsInterval)
      clearInterval(contextInterval)
    }
  }, [fetchData, fetchEvents, fetchContext])

  /** Extract required variable names from a paused step's expected_response */
  const getRequiredVars = useCallback((step: StepRunWithDef | undefined): string[] => {
    const er = step?.definition?.expected_response
    if (er?.required && er.required.length > 0) {
      const firstReq = er.required[0]
      if (
        firstReq === 'memory' &&
        er.properties?.['memory'] &&
        typeof er.properties['memory'] === 'object' &&
        'required' in (er.properties['memory'] as Record<string, unknown>)
      ) {
        const memRequired = (er.properties['memory'] as ExpectedResponseProperty).required
        if (memRequired && memRequired.length > 0) {
          return memRequired
        }
      }
      return er.required
    }
    return ['user_input']
  }, [])

  /** The paused step (most recent one with status paused) */
  const pausedStep = [...steps]
    .sort((a, b) => (b.order_index ?? 0) - (a.order_index ?? 0))
    .find((s) => s.status === 'paused')

  const requiredVars = getRequiredVars(pausedStep)

  /** Seed inputs from the latest paused step's resolved_variables.
   *  Only seeds non-chat_message fields (chat_message is user-authored).
   *  Only sets the value if the input is currently empty, so the user can always type freely. */
  useEffect(() => {
    if (!pausedStep) return
    const rv = pausedStep.resolved_variables
    if (!rv) return
    setInputs((prev) => {
      const next = { ...prev }
      let changed = false
      for (const key of requiredVars) {
        if (key === 'chat_message') continue // never auto-seed the user's message
        const val = rv[key]
        if (val !== undefined && val !== null) {
          const strVal = typeof val === 'string' ? val : JSON.stringify(val)
          // Only seed if the input is empty (user hasn't started typing)
          if (!prev[key]) {
            next[key] = strVal
            changed = true
          }
        }
      }
      return changed ? next : prev
    })
  }, [pausedStep, requiredVars])

  /** Whether the flow is currently processing (waiting for assistant reply).
   *  True only when there is no paused step — i.e. the flow is actively running. */
  const isProcessing = (() => {
    if (steps.length === 0) return false
    return !steps.some((s) => s.status === 'paused')
  })()

  /** Available variables from context that are user inputs */
  const inputVariables = (context?.available_variables ?? []).filter(
    (v) => v.display?.ui_input || v.name.startsWith('input_')
  )

  /** Merge required vars from step definition with context input variables */
  const allRequiredVars = (() => {
    const fromDef = requiredVars
    const fromContext = inputVariables.map((v) => v.name)
    const merged = [...new Set([...fromDef, ...fromContext])]
    return merged
  })()

  /** Build chat messages from step runs.
   *  - User messages: from resolved_variables input_* fields (what the user actually typed).
   *  - Assistant messages: from ai_response.chat_message (each shown once). */
  const chatMessages = (() => {
    const msgs: { role: 'user' | 'assistant'; text: string; data: Record<string, unknown>; id: string }[] = []
    const sorted = [...steps].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    const seenAssistant = new Set<string>()
    const seenUserText = new Set<string>()
    for (const s of sorted) {
      // User input: collect all input_* fields from resolved_variables
      const rv = s.resolved_variables as Record<string, unknown> | null
      if (rv) {
        const inputFields: Record<string, unknown> = {}
        let userText = ''
        for (const [k, v] of Object.entries(rv)) {
          if (k.startsWith('input_') && v && typeof v === 'string' && v.trim()) {
            inputFields[k] = v
            if (!userText) userText = v
          }
        }
        if (userText && !seenUserText.has(userText)) {
          seenUserText.add(userText)
          msgs.push({ role: 'user', text: userText, data: inputFields, id: `${s.id}-user` })
        }
      }
      // Assistant response: ai_response.chat_message (each shown once)
      if (s.ai_response) {
        let assistantMsg = ''
        let data: Record<string, unknown> = {}
        if (typeof s.ai_response === 'string') {
          assistantMsg = s.ai_response
          data = { response: s.ai_response }
        } else if (typeof s.ai_response === 'object' && s.ai_response !== null) {
          const resp = s.ai_response as Record<string, unknown>
          assistantMsg = (resp.chat_message as string) || ''
          data = { ...resp }
          delete data.chat_message
        }
        if (assistantMsg && !seenAssistant.has(assistantMsg)) {
          seenAssistant.add(assistantMsg)
          msgs.push({ role: 'assistant', text: assistantMsg, data, id: `${s.id}-resp` })
        }
      }
    }
    return msgs
  })()

  /** Auto-scroll to bottom only when the flow is actively processing */
  useEffect(() => {
    if (chatMode && isProcessing && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [steps, chatMode, isProcessing])

  const handleInputChange = (name: string, value: string) => {
    setInputs((prev) => ({ ...prev, [name]: value }))
  }

  const handleSend = async () => {
    try {
      if (steps.length === 0 && flowId) {
        // No flow run yet — start the flow
        await fetch('/api/proxy/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            flowId,
            input_variables: {
              goal: inputs['goal'] || '',
            },
          }),
        })
      } else {
        // Flow run exists — resume
        // Build input_variables from all required vars
        const inputVars: Record<string, string> = {}
        for (const v of requiredVars) {
          if (inputs[v]) inputVars[v] = inputs[v]
        }
        await fetch('/api/proxy/resume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            flowRunId: id,
            user_input: inputVars,
          }),
        })
      }
      setTimeout(fetchData, 500)
    } catch (e) {
      console.error('Failed to send', e)
    }
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
      <div className="max-w-3xl mx-auto px-6 py-12 pb-28">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <button onClick={() => router.push('/')} className="text-neutral-600 hover:text-white">
              &larr; back
            </button>
            <h1 className="text-lg mt-2 mb-1">flow run</h1>
            <p className="text-neutral-600 text-xs">{id}</p>
          </div>
          {/* Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500">
              {chatMode ? 'chat' : 'debug'}
            </span>
            <div
              onClick={() => setChatMode(!chatMode)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                chatMode ? 'bg-blue-600' : 'bg-neutral-800'
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  chatMode ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </div>
          </label>
        </div>

        {chatMode ? (
          /* ── Chat Mode ── */
          <div className="space-y-4">
            {chatMessages.length === 0 && (
              <p className="text-neutral-600 text-sm text-center py-12">no messages yet</p>
            )}
            {chatMessages.map((msg) => (
              <ChatBubble key={msg.id} msg={msg} />
            ))}
            {isProcessing && (
              <div className="space-y-3">
                {/* Execution trace replaces the Thinking spinner */}
                <ExecutionTrace events={events} />
                {events.length === 0 && (
                  <div className="flex justify-start">
                    <div className="bg-neutral-800 text-neutral-400 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm">
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="8" />
                        </svg>
                        Thinking…
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        ) : (
          /* ── Debug Mode ── */
          <>
            {/* Execution trace (always visible in debug mode when running) */}
            {isProcessing && <ExecutionTrace events={events} />}

            {/* Context variables display */}
            {context?.available_variables && context.available_variables.length > 0 && (
              <div className="border border-neutral-800 rounded-lg overflow-hidden mb-6">
                <div className="bg-neutral-900 px-3 py-1.5 text-[10px] text-neutral-500 uppercase tracking-wider border-b border-neutral-800">
                  Context Variables
                </div>
                <div className="divide-y divide-neutral-800">
                  {context.available_variables.map((v) => (
                    <div key={v.name} className="px-3 py-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider">{v.display?.label || v.name}</span>
                        {v.display?.ui_display && (
                          <span className="text-[9px] text-neutral-700 bg-neutral-900 rounded px-1">{v.display.ui_display}</span>
                        )}
                      </div>
                      {v.value !== undefined ? (
                        <DisplayValue value={v.value} display={v.display?.ui_display} />
                      ) : (
                        <span className="text-xs text-neutral-600">(no value)</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                                  {typeof val === 'string' ? val : JSON.stringify(val, null, 2)}
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

                      {/* Actions */}
                      {(() => {
                        const actions = step.result?.pro_check_request?.response?.actions
                        if (!Array.isArray(actions) || actions.length === 0) return null
                        return (
                          <div className="mb-2">
                            <span className="text-[10px] text-neutral-600 uppercase tracking-wider mb-2 block">
                              actions ({actions.length})
                            </span>
                            <div className="space-y-2">
                              {actions.map((action: unknown, i: number) => (
                                <ActionBlock
                                  key={i}
                                  action={action as Record<string, unknown>}
                                />
                              ))}
                            </div>
                          </div>
                        )
                      })()}

                      {/* Completed Actions */}
                      {(() => {
                        const completed = step.result?.actions_completed
                        if (!Array.isArray(completed) || completed.length === 0) return null
                        return (
                          <div className="mb-2">
                            <span className="text-[10px] text-neutral-600 uppercase tracking-wider mb-2 block">
                              completed actions ({completed.length})
                            </span>
                            <div className="space-y-2">
                              {completed.map((action: unknown, i: number) => (
                                <CompletedActionBlock
                                  key={i}
                                  action={action as Record<string, unknown>}
                                />
                              ))}
                            </div>
                          </div>
                        )
                      })()}

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
          </>
        )}
      </div>

      {/* ── Fixed Input Footer ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur border-t border-neutral-800">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend() }}
            className="flex items-center gap-3"
          >
            <div className="flex-1 space-y-2">
              {allRequiredVars.map((v) => {
                const ctxVar = inputVariables.find((iv) => iv.name === v)
                const display = ctxVar?.display?.ui_display
                const label = ctxVar?.display?.label || v
                return (
                  <div key={v}>
                    {!chatMode && (
                      <label className="text-[10px] text-neutral-600 uppercase tracking-wider block mb-1">
                        {label}
                      </label>
                    )}
                    {display === 'table' || display === 'json' || display === 'html' || display === 'code' ? (
                      <div className="border border-neutral-800 rounded px-3 py-2 text-xs">
                        <DisplayValue value={ctxVar?.value} display={display} />
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={inputs[v] || ''}
                        onChange={(e) => handleInputChange(v, e.target.value)}
                        placeholder={chatMode ? 'Type a message…' : `enter ${v}...`}
                        className="w-full bg-transparent text-white border border-neutral-800 rounded px-3 py-2 text-sm outline-none focus:border-neutral-600 placeholder-neutral-700"
                      />
                    )}
                  </div>
                )
              })}
            </div>
            <button
              type="submit"
              className="shrink-0 text-sm text-neutral-200 hover:text-white transition-colors"
            >
              send
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

/** A collapsible JSON block with a label */
function CollapsibleJson({
  label,
  value,
  defaultOpen = false,
}: {
  label: string
  value: string
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  let formatted: string
  try {
    formatted = JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    formatted = value
  }

  return (
    <div className="border border-neutral-800 rounded overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] text-neutral-500 uppercase tracking-wider hover:text-neutral-300 transition-colors"
      >
        <span>{label}</span>
        <span className="text-neutral-700">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <pre className="text-[11px] text-neutral-400 px-3 pb-2 whitespace-pre-wrap overflow-x-auto">
          {formatted}
        </pre>
      )}
    </div>
  )
}

/** Renders a single action with its request and response side by side */
function ActionBlock({ action }: { action: Record<string, unknown> }) {
  // Separate request fields from response fields
  const requestFields = ['type', 'method', 'endpoint', 'path', 'payload', 'url', 'headers']
  const responseFields = ['response', 'response_body', 'result', 'data', 'status_code', 'status']

  const requestObj: Record<string, unknown> = {}
  const responseObj: Record<string, unknown> = {}

  for (const [k, v] of Object.entries(action)) {
    if (responseFields.includes(k)) {
      responseObj[k] = v
    } else {
      requestObj[k] = v
    }
  }

  // If nothing ended up in response, put everything in request
  const hasResponse = Object.keys(responseObj).length > 0

  return (
    <div className="grid grid-cols-2 gap-2">
      <CollapsibleJson
        label="request"
        value={JSON.stringify(hasResponse ? requestObj : action, null, 2)}
        defaultOpen
      />
      {hasResponse && (
        <CollapsibleJson
          label="response"
          value={JSON.stringify(responseObj, null, 2)}
          defaultOpen
        />
      )}
    </div>
  )
}

/** Renders a completed action with request details and response body */
function CompletedActionBlock({ action }: { action: Record<string, unknown> }) {
  const hasError = action.error || action.status === 'error' || action.status === 'failed'
  const statusColor = hasError ? 'text-red-400/80' : 'text-green-400/80'

  // Build request object from known request fields
  const requestObj: Record<string, unknown> = {}
  const requestFields = ['method', 'endpoint', 'path', 'payload', 'url', 'headers', 'type']
  for (const k of requestFields) {
    if (k in action) {
      requestObj[k] = action[k]
    }
  }

  // Build response object
  const responseObj: Record<string, unknown> = {}
  if ('response' in action) responseObj.response = action.response
  if ('response_body' in action) responseObj.response_body = action.response_body
  if ('result' in action) responseObj.result = action.result
  if ('data' in action) responseObj.data = action.data
  if ('status_code' in action) responseObj.status_code = action.status_code
  if ('status' in action) responseObj.status = action.status
  if (hasError && action.error) responseObj.error = action.error

  const hasResponse = Object.keys(responseObj).length > 0

  const endpoint = action.endpoint as string | undefined
  const method = action.method as string | undefined
  const statusCode = action.status_code as string | number | undefined

  return (
    <div>
      {endpoint && (
        <div className="flex items-center gap-2 mb-1.5">
          {method && (
            <span className={`text-[10px] font-semibold uppercase ${statusColor}`}>
              {method}
            </span>
          )}
          <span className="text-[11px] text-neutral-400 truncate">{endpoint}</span>
          {statusCode && (
            <span className={`text-[10px] ml-auto ${statusColor}`}>
              {String(statusCode)}
            </span>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {Object.keys(requestObj).length > 0 && (
          <CollapsibleJson
            label="request"
            value={JSON.stringify(requestObj, null, 2)}
            defaultOpen
          />
        )}
        {hasResponse && (
          <CollapsibleJson
            label={hasError ? 'error response' : 'response'}
            value={JSON.stringify(responseObj, null, 2)}
            defaultOpen
          />
        )}
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
