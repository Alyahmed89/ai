'use client'

export const runtime = 'edge'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ContextChatTrigger } from '@/components/ContextChatTrigger'
import type { FlowRun, StepRunResult } from '@/types'

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
  /** Frontend-only presentation hints (optional, never affect execution) */
  status_label?: string
  silent?: boolean
  chat_visible?: boolean
  debug_visible?: boolean
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

/** A single chat bubble. */
function ChatBubble({ msg }: {
  msg: { role: 'user' | 'assistant'; text: string; data: Record<string, unknown>; id: string }
}) {
  return (
    <div
      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm leading-relaxed ${
          msg.role === 'user'
            ? 'bg-neutral-100 text-neutral-900 rounded-br-sm'
            : 'bg-neutral-800 text-neutral-200 rounded-bl-sm'
        }`}
      >
        <div>{msg.text}</div>
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
            <span>{String(data?.title || data?.ref || data?.step_id || 'unknown')}</span>
            {!!data?.ref && <span className="text-neutral-500 ml-1">({String(data.ref)})</span>}
          </div>
        </div>
      )

    case 'llm.call':
      return (
        <div className="flex items-start gap-2 text-xs text-purple-400">
          <span className="shrink-0 mt-0.5">🤖</span>
          <div>
            <span className="font-semibold">Calling AI...</span>
            {!!data?.prompt && (
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
            {!!data?.response && (
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
            <span>{String(data?.method || 'GET')} {String(data?.url || data?.endpoint || '')}</span>
          </div>
        </div>
      )

    case 'api.complete':
      return (
        <div className="flex items-start gap-2 text-xs text-amber-300">
          <span className="shrink-0 mt-0.5">✓</span>
          <div>
            <span className="font-semibold">API Complete </span>
            {data?.status_code != null && (
              <span className={Number(data.status_code) >= 400 ? 'text-red-400' : 'text-green-400'}>
                {String(data.status_code)}
              </span>
            )}
            {!!data?.body && (
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
            <span>{String(data?.step_title || data?.ref || data?.step_id || 'unknown')}</span>
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
            {!!data?.message && <div className="mt-0.5 text-green-300/70">{String(data.message)}</div>}
          </div>
        </div>
      )

    case 'flow.error':
      return (
        <div className="flex items-start gap-2 text-xs text-red-400">
          <span className="shrink-0 mt-0.5">✗</span>
          <div>
            <span className="font-semibold">Flow Error</span>
            {!!(data?.message || data?.error) && (
              <div className="mt-0.5 text-red-300/70">{String(data?.message || data?.error)}</div>
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
            {data && typeof data === 'object' && Object.keys(data).length > 0 && (
              <pre className="mt-0.5 text-neutral-500 whitespace-pre-wrap">{JSON.stringify(data)}</pre>
            )}
          </div>
        </div>
      )
  }
}

/** Live execution trace panel — used only in debug mode.
 *  Deduplicates repeated events, shows newest first, capped at 100 entries. */
function ExecutionTrace({ events }: { events: FlowEvent[] }) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events.length])

  if (events.length === 0) return null

  // Deduplicate: keep only the last occurrence of each unique (type, timestamp) pair
  const seen = new Set<string>()
  const deduped: FlowEvent[] = []
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i]
    const key = `${ev.type}:${ev.timestamp}`
    if (!seen.has(key)) {
      seen.add(key)
      deduped.push(ev)
    }
  }
  // Newest first, capped at 100
  const display = deduped.slice(0, 100)

  return (
    <div className="border border-neutral-800 rounded-lg overflow-hidden">
      <div className="bg-neutral-900 px-3 py-1.5 text-[10px] text-neutral-500 uppercase tracking-wider border-b border-neutral-800">
        Execution Trace
      </div>
      <div className="px-3 py-2 space-y-2 max-h-80 overflow-y-auto">
        {display.map((ev, i) => (
          <TraceEvent key={`${ev.type}:${ev.timestamp}:${i}`} event={ev} />
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

  const [flowRun, setFlowRun] = useState<FlowRun | null>(null)
  const [steps, setSteps] = useState<StepRunWithDef[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [correctionStarting, setCorrectionStarting] = useState<string | null>(null)
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [chatMode, setChatMode] = useState(searchParams?.get('chatmode') !== '0')
  const [sending, setSending] = useState(false)
  const [events, setEvents] = useState<FlowEvent[]>([])
  const [context, setContext] = useState<FlowContext | null>(null)
  const [transientStatus, setTransientStatus] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)

  /* ── Fetch flow run + step runs + definitions ── */
  const fetchData = useCallback(async () => {
    if (!id) return
    setLoadError(null)
    try {
      const [flowRunRes, stepsRes, defsRes] = await Promise.all([
        fetch(`/api/proxy/flow-runs/${id}`),
        fetch(`/api/proxy/api/step-runs?flow_run_id=${id}`),
        fetch('/api/proxy/api/flow-steps'),
      ])

      if (flowRunRes.ok) {
        const flowRunData = await flowRunRes.json()
        // Handle both direct object and { data: ... } wrapper
        const fr = flowRunData?.data ?? flowRunData
        if (fr && typeof fr === 'object' && fr.id) {
          setFlowRun(fr as FlowRun)
        }
      } else {
        setLoadError(`Flow run API returned ${flowRunRes.status}`)
      }

      let defs: FlowStep[] = []
      if (defsRes.ok) {
        const defsData = await defsRes.json()
        defs = Array.isArray(defsData) ? defsData : Array.isArray(defsData?.data) ? defsData.data : []
      }

      if (stepsRes.ok) {
        const stepsData = await stepsRes.json()
        const rawSteps = Array.isArray(stepsData) ? stepsData : Array.isArray(stepsData?.data) ? stepsData.data : []
        const parsed: StepRunWithDef[] = rawSteps.map(
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
      console.error('Failed to fetch data', e)
      setLoadError(`Failed to fetch data: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
    setLoading(false)
  }, [id])

  /* ── Poll events from /flow-runs/:id/events ── */
  const fetchEvents = useCallback(async () => {
    if (!id) return
    try {
      const res = await fetch(`/api/proxy/flow-runs/${id}/events`)
      if (res.ok) {
        const data = await res.json()
        const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : data?.events ?? []
        if (Array.isArray(list) && list.length > 0) {
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
      const res = await fetch(`/api/proxy/flow-runs/${id}/context`)
      if (res.ok) {
        const data = await res.json()
        const ctx = data?.data ?? data
        if (ctx && typeof ctx === 'object') {
          setContext(ctx as FlowContext)
        }
      }
    } catch {
      /* endpoint may not exist yet */
    }
  }, [id])

  useEffect(() => {
    if (!id) return

    fetchData()
    fetchEvents()
    fetchContext()

    // Loading timeout: show error if still loading after 20s
    const loadingTimer = setTimeout(() => {
      setLoadError((prev) => prev || 'Loading timed out — backend may be unreachable')
    }, 20000)

    const interval = setInterval(fetchData, 3000)
    const eventsInterval = setInterval(fetchEvents, 800)
    const contextInterval = setInterval(fetchContext, 5000)
    return () => {
      clearTimeout(loadingTimer)
      clearInterval(interval)
      clearInterval(eventsInterval)
      clearInterval(contextInterval)
    }
  }, [fetchData, fetchEvents, fetchContext, id])

  /** The paused step (most recent one with status paused) */
  const pausedStep = [...steps]
    .reverse()
    .find((s) => s.status === 'paused')

  /**
   * Normalize available_variables from context — they can be strings or objects.
   * Used for display metadata (labels, display hints) in debug mode.
   */
  const normalizedVars: { name: string; display?: DisplayMeta; value?: unknown }[] = (() => {
    const raw = context?.available_variables ?? []
    return raw.map((v: unknown) => {
      if (typeof v === 'string') return { name: v }
      if (typeof v === 'object' && v !== null) {
        const obj = v as Record<string, unknown>
        return {
          name: String(obj.name ?? ''),
          display: obj.display as DisplayMeta | undefined,
          value: obj.value,
        }
      }
      return { name: String(v) }
    })
  })()

  /**
   * Determine the single user input variable for the current paused step.
   *
   * Each step config defines exactly one user-facing input. We derive it from
   * the step's expected_response.required:
   *  - Fields starting with "input_" are direct user inputs (e.g. input_user_confirmation)
   *  - If "memory" is required, its nested required fields with "input_" prefix
   *    are user inputs (e.g. memory.input_user_input)
   *
   * Falls back to filtering available_variables by "input_" or "memory." prefix
   * when the step definition has no expected_response.
   */
  const allRequiredVars = (() => {
    const er = pausedStep?.definition?.expected_response
    if (er?.required && er.required.length > 0) {
      // Direct user input fields (input_*)
      const directInputs = er.required.filter((r: string) => r.startsWith('input_'))
      if (directInputs.length > 0) return directInputs

      // Nested under memory: check memory.required for input_* fields
      if (er.required.includes('memory')) {
        const memProp = er.properties?.['memory'] as ExpectedResponseProperty | undefined
        if (memProp?.required && memProp.required.length > 0) {
          const memInputs = memProp.required.filter((r: string) => r.startsWith('input_'))
          if (memInputs.length > 0) return memInputs.map((r: string) => `memory.${r}`)
          // If memory has required fields but none start with input_,
          // the first memory required field is the user input (e.g. memory.input_user_input)
          return [`memory.${memProp.required[0]}`]
        }
      }

      // Fallback: exclude chat_message from required, return the rest
      const nonChat = er.required.filter((r: string) => r !== 'chat_message')
      if (nonChat.length > 0) return nonChat
    }

    // Fallback: filter available_variables for user-facing names
    const fromContext = normalizedVars
      .filter((v) => v.display?.ui_input || v.name.startsWith('input_') || v.name.startsWith('memory.'))
      .map((v) => v.name)
    if (fromContext.length > 0) return fromContext

    // No steps yet — this is a fresh flow start, use 'goal' as the input variable
    if (steps.length === 0) return ['goal']

    return ['user_input']
  })()

  /** Available variables from context that are user inputs (used for display metadata) */
  const inputVariables = normalizedVars.filter(
    (v) => v.display?.ui_input || v.name.startsWith('input_')
  )

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
      for (const key of allRequiredVars) {
        if (key === 'chat_message') continue // never auto-seed the user's message
        // For dotted keys like memory.input_user_input, look up nested value
        const val = key.includes('.')
          ? key.split('.').reduce((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), rv as unknown)
          : (rv as Record<string, unknown>)[key]
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
  }, [pausedStep, allRequiredVars])

  /** Whether the flow is currently processing (waiting for assistant reply).
   *  True only when there is no paused step — i.e. the flow is actively running. */
  const isProcessing = (() => {
    if (steps.length === 0) return false
    if (flowRun?.status === 'completed' || flowRun?.status === 'failed') return false
    return !steps.some((s) => s.status === 'paused')
  })()

  /** Build chat messages from step runs.
   *  Order: AI message of step N, then user message from step N+1's input_* fields.
   *  - Assistant messages: from ai_response.chat_message, falling back to
   *    result.pro_check_request.response.chat_message for older step runs.
   *  - User messages: from the NEXT step's resolved_variables input_* fields,
   *    because the user's response to step N is consumed by step N+1.
   *
   *  Steps with silent=true or chat_visible=false are excluded from chat rendering. */
  const chatMessages = (() => {
    const msgs: { role: 'user' | 'assistant'; text: string; data: Record<string, unknown>; id: string }[] = []
    const sorted = [...steps]
      .filter((s) => !s.definition?.silent && s.definition?.chat_visible !== false)
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    const seenAssistant = new Set<string>()
    const seenUserText = new Set<string>()

    /** Extract user message from a step run's resolved_variables (input_* fields). */
    function getUserMsg(s: StepRunWithDef): { text: string; data: Record<string, unknown> } | null {
      const rv = s.resolved_variables as Record<string, unknown> | null
      if (!rv) return null
      const inputFields: Record<string, unknown> = {}
      let userText = ''
      for (const [k, v] of Object.entries(rv)) {
        if (k.startsWith('input_') && v && typeof v === 'string' && v.trim()) {
          inputFields[k] = v
          if (!userText) userText = v
        }
      }
      if (!userText || seenUserText.has(userText)) return null
      seenUserText.add(userText)
      return { text: userText, data: inputFields }
    }

    /** Extract assistant message from a step run. */
    function getAssistantMsg(s: StepRunWithDef): { text: string; data: Record<string, unknown> } | null {
      let assistantMsg = ''
      let data: Record<string, unknown> = {}
      if (s.ai_response) {
        if (typeof s.ai_response === 'string') {
          // Try parsing as JSON — if it parses, extract only chat_message
          try {
            const parsed = JSON.parse(s.ai_response) as Record<string, unknown>
            assistantMsg = (parsed.chat_message as string) || ''
            data = { ...parsed }
            delete data.chat_message
          } catch {
            // Not JSON — use as plain text
            assistantMsg = s.ai_response
            data = { response: s.ai_response }
          }
        } else if (typeof s.ai_response === 'object' && s.ai_response !== null) {
          const resp = s.ai_response as Record<string, unknown>
          assistantMsg = (resp.chat_message as string) || ''
          data = { ...resp }
          delete data.chat_message
        }
      }
      // Fallback: pro_check_request.response.chat_message for older step runs
      if (!assistantMsg && s.result?.pro_check_request?.response?.chat_message) {
        assistantMsg = s.result.pro_check_request.response.chat_message as string
        data = { ...(s.result.pro_check_request.response as Record<string, unknown>) }
        delete data.chat_message
      }
      if (!assistantMsg || seenAssistant.has(assistantMsg)) return null
      seenAssistant.add(assistantMsg)
      return { text: assistantMsg, data }
    }

    for (let i = 0; i < sorted.length; i++) {
      const s = sorted[i]
      // AI message for this step
      const assistant = getAssistantMsg(s)
      if (assistant) {
        msgs.push({ role: 'assistant', text: assistant.text, data: assistant.data, id: `${s.id}-resp` })
      }
      // User message from the NEXT step's input_* fields (user's response to this step's AI)
      const next = sorted[i + 1]
      if (next) {
        const user = getUserMsg(next)
        if (user) {
          msgs.push({ role: 'user', text: user.text, data: user.data, id: `${next.id}-user` })
        }
      }
    }
    return msgs
  })()

  /**
   * Derive a transient status string from the latest events and step definitions.
   * Returns null when no step is actively executing (i.e. response has arrived).
   */
  const derivedStatus: string | null = (() => {
    if (!isProcessing) return null
    if (events.length === 0) {
      // No events yet — show a generic status
      return 'Thinking…'
    }

    // Find the most recent step.start event
    const stepStarts = events.filter((e) => e.type === 'step.start')
    if (stepStarts.length === 0) return 'Thinking…'

    const latestStart = stepStarts[stepStarts.length - 1]
    const stepId = latestStart.data?.step_id as string | undefined

    // Check if there's a completion event after this step.start
    const startIdx = events.indexOf(latestStart)
    const hasCompletion = events.slice(startIdx + 1).some(
      (e) => e.type === 'llm.response' || e.type === 'flow.complete' || e.type === 'flow.error'
    )
    if (hasCompletion) return null

    // Look for the step definition to get status_label or title
    const stepDef = stepId ? steps.find((s) => s.step_id === stepId)?.definition : undefined
    if (stepDef?.status_label) return stepDef.status_label
    if (stepDef?.title) return stepDef.title

    // Check for more specific event types to derive a better status
    const recentEvents = events.slice(-5)
    const llmCall = recentEvents.find((e) => e.type === 'llm.call')
    if (llmCall) return 'Calling AI…'

    const apiCall = recentEvents.find((e) => e.type === 'api.call')
    if (apiCall) {
      const method = String(apiCall.data?.method || '')
      const endpoint = String(apiCall.data?.url || apiCall.data?.endpoint || '')
      return `Calling ${method} ${endpoint}…`
    }

    // Fallback: derive from step title or event data
    const title = latestStart.data?.title as string | undefined
    if (title) return title

    return 'Thinking…'
  })()

  /** Sync transientStatus from derivedStatus via effect */
  useEffect(() => {
    setTransientStatus(derivedStatus)
  }, [derivedStatus])

  /** Track whether the user is scrolled to the bottom of the chat */
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const handleScroll = () => {
      const threshold = 100 // px from bottom
      setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < threshold)
    }
    el.addEventListener('scroll', handleScroll)
    return () => el.removeEventListener('scroll', handleScroll)
  }, [chatMode])

  /** Auto-scroll to bottom only when user is already at bottom and a new message appears */
  useEffect(() => {
    if (chatMode && isAtBottom && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [steps, chatMode, isProcessing, isAtBottom])

  const handleInputChange = (name: string, value: string) => {
    setInputs((prev) => ({ ...prev, [name]: value }))
  }

  /** Set a nested value on an object from a dotted path like "memory.input_user_input". */
  function setNested(obj: Record<string, unknown>, path: string[], value: string): void {
    const key = path[0]
    if (path.length === 1) {
      obj[key] = value
    } else {
      if (!obj[key] || typeof obj[key] !== 'object') {
        obj[key] = {}
      }
      const next = obj[key]
      if (next && typeof next === 'object') {
        setNested(next as Record<string, unknown>, path.slice(1), value)
      }
    }
  }

  const handleSend = async () => {
    setSending(true)
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
      } else if (id && steps.length > 0) {
        // Flow run exists — resume
        // Build user_input from allRequiredVars, supporting dotted paths for nested objects
        const inputVars: Record<string, unknown> = {}
        for (const v of allRequiredVars) {
          const val = inputs[v]
          if (v.includes('.')) {
            setNested(inputVars, v.split('.'), val ?? '')
          } else {
            inputVars[v] = val ?? ''
          }
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
      setInputs({})
      setTimeout(fetchData, 500)
    } catch (e) {
      console.error('Failed to send', e)
    } finally {
      setSending(false)
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
      if (Array.isArray(cf.variables)) {
        for (const v of cf.variables) {
          inputVariables[v.name] = v.value
        }
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
      if (data?.flowRunId) {
        window.open(`/flow-run/${data.flowRunId}`, '_blank')
      }
    } catch (e) {
      console.error('Failed to start correction flow', e)
      alert(`Error starting correction flow: ${e}`)
    }
    setCorrectionStarting(null)
  }

  // Show loading state while fetching initial data.
  // flowRun is optional — the page can render with just steps data.
  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white font-mono">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <button onClick={() => router.push('/')} className="text-neutral-600 hover:text-white mb-8 block">
            &larr; back
          </button>
          {loadError ? (
            <div>
              <p className="text-red-400 mb-4">{loadError}</p>
              <p className="text-neutral-500 text-sm mb-4">Flow run ID: {id || '(none)'}</p>
              <button
                onClick={() => { setLoading(true); setLoadError(null); fetchData() }}
                className="text-sm text-neutral-400 hover:text-white underline"
              >
                retry
              </button>
            </div>
          ) : (
            <p className="text-neutral-600">loading...</p>
          )}
        </div>
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
              onClick={() => {
                const next = !chatMode
                setChatMode(next)
                const url = new URL(window.location.href)
                url.searchParams.set('chatmode', next ? '1' : '0')
                router.replace(url.pathname + url.search)
              }}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                chatMode ? 'bg-neutral-600' : 'bg-neutral-800'
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
          /* ── Chat Mode ──
           * Only shows: user messages, assistant messages, and transient live status.
           * NO execution traces, NO bullets, NO JSON, NO variables, NO debug panels.
           * Feels like ChatGPT — conversation only.
           */
          <div ref={scrollContainerRef} className="space-y-4">
            {chatMessages.length === 0 && !transientStatus && (
              <p className="text-neutral-600 text-sm text-center py-12">no messages yet</p>
            )}
            {chatMessages.map((msg) => (
              <ChatBubble key={msg.id} msg={msg} />
            ))}
            {/* Transient live status — appears while step executes, disappears on response */}
            {transientStatus && (
              <div className="flex justify-start">
                <div className="bg-neutral-800 text-neutral-400 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm">
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="8" />
                    </svg>
                    {transientStatus}
                  </span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        ) : (
          /* ── Debug Mode ──
           * Shows all execution internals: traces, variables, pro_check, actions,
           * routing, normalization, contracts, refs, timing, engine events.
           * Structured with collapsible sections, deduplicated traces, newest first.
           */
          <>
            {/* Execution trace (collapsible, always visible in debug mode when running) */}
            {isProcessing && <ExecutionTrace events={events} />}

            {steps.length === 0 ? (
              <p className="text-neutral-600">no steps yet</p>
            ) : (
              <div className="space-y-8">
                {steps
                  .filter((s) => s.definition?.debug_visible !== false)
                  .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
                  .map((step) => (
                    <CollapsibleSection
                      key={step.id}
                      label={
                        <span className="flex items-center gap-2">
                          <span className="text-xs text-neutral-500">#{step.order_index}</span>
                          {step.definition?.ref && (
                            <span className="text-xs text-amber-400/70">{step.definition.ref}</span>
                          )}
                          {step.definition?.title && (
                            <span className="text-sm text-white font-semibold">{step.definition.title}</span>
                          )}
                          <span className="text-[10px] text-neutral-600 ml-auto">{step.status}</span>
                        </span>
                      }
                      defaultOpen={true}
                    >
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
                                  {typeof val === 'string' ? val : formatJson(JSON.stringify(val))}
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
                            {formatJson(JSON.stringify(step.result.pro_check))}
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
                    </CollapsibleSection>
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
                // Use display label, or last segment of dotted path, or full name
                const label = ctxVar?.display?.label || (v.includes('.') ? v.split('.').pop()! : v)
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
                        placeholder={chatMode ? 'Type a message…' : `enter ${label}...`}
                        className="w-full bg-transparent text-white border border-neutral-800 rounded px-3 py-2 text-sm outline-none focus:border-neutral-600 placeholder-neutral-700"
                      />
                    )}
                  </div>
                )
              })}
            </div>
            <button
              type="submit"
              disabled={sending}
              className="shrink-0 text-sm text-neutral-200 hover:text-white transition-colors disabled:text-neutral-600 disabled:cursor-not-allowed"
            >
              {sending ? (
                <span className="flex items-center gap-1.5">
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  sending
                </span>
              ) : (
                'send'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

/** Format JSON: single-line if flat, indented with spaces if nested (tree). */
function formatJson(value: string): string {
  try {
    const parsed = JSON.parse(value)
    if (typeof parsed === 'object' && parsed !== null) {
      const values = Array.isArray(parsed) ? parsed : Object.values(parsed)
      // Flat = no nested objects (arrays like [] are not considered nested)
      const isFlat = !values.some((v) => v !== null && typeof v === 'object' && !Array.isArray(v))
      if (isFlat) return JSON.stringify(parsed)
    }
    return JSON.stringify(parsed, null, 2)
  } catch {
    return value
  }
}

/** A generic collapsible section with a label (string or JSX) and content. */
function CollapsibleSection({
  label,
  children,
  defaultOpen = false,
}: {
  label: string | React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border border-neutral-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] text-neutral-500 uppercase tracking-wider hover:text-neutral-300 transition-colors bg-neutral-900/50"
      >
        <span>{label}</span>
        <span className="text-neutral-700">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="px-3 py-2">{children}</div>}
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
  const formatted = formatJson(value)

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
  const formatted = formatJson(value)

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
