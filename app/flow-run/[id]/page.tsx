'use client'

export const runtime = 'edge'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

const API_BASE = '/api/proxy'

/* ── New Types (aligned with executions/events/memory tables) ── */

interface Execution {
  id: string
  type: 'flow' | 'step'
  parent_id: string | null
  flow_id: string | null
  step_id: string | null
  name: string | null
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed'
  input: Record<string, unknown>
  output: Record<string, unknown>
  error: string | null
  created_at: string
  updated_at: string
}

interface MemoryRow {
  id: string
  execution_id: string
  scope: 'global' | 'flow' | 'step'
  key: string
  value: string
  created_at: string
}

interface EventRow {
  id: string
  execution_id: string
  event_type: string
  payload: Record<string, unknown>
  created_at: string
}

interface Trace {
  execution: Execution | null
  steps: Execution[]
  events: EventRow[]
  memory: MemoryRow[]
}

function formatJson(value: string): string {
  try {
    const parsed = JSON.parse(value)
    if (typeof parsed === 'object' && parsed !== null) {
      const values = Array.isArray(parsed) ? parsed : Object.values(parsed)
      const isFlat = !values.some((v) => v !== null && typeof v === 'object' && !Array.isArray(v))
      if (isFlat) return JSON.stringify(parsed)
    }
    return JSON.stringify(parsed, null, 2)
  } catch {
    return value
  }
}

function CollapsibleSection({
  label, children, defaultOpen = false,
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

export default function FlowRunPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = params?.id as string
  const flowId = searchParams?.get('flowId') || ''

  const [trace, setTrace] = useState<Trace | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [chatMode, setChatMode] = useState(searchParams?.get('chatmode') !== '0')
  const [sending, setSending] = useState(false)
  const [input, setInput] = useState('')
  const [transientStatus, setTransientStatus] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)

  const flowExec = trace?.execution || null
  const stepExecs = trace?.steps || []
  const memory = trace?.memory || []
  const events = trace?.events || []

  /* ── Fetch trace ── */
  const fetchData = useCallback(async () => {
    if (!id) return
    setLoadError(null)
    try {
      const res = await fetch(`${API_BASE}/flow-runs/${id}/trace`)
      if (res.ok) {
        const data = await res.json()
        setTrace(data)
      } else {
        setLoadError(`Trace API returned ${res.status}`)
      }
    } catch (e) {
      setLoadError(`Failed to fetch: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    if (!id) return
    fetchData()
    const loadingTimer = setTimeout(() => {
      setLoadError((prev) => prev || 'Loading timed out')
    }, 20000)
    const interval = setInterval(fetchData, 3000)
    return () => { clearTimeout(loadingTimer); clearInterval(interval) }
  }, [fetchData, id])

  /* ── Build memory map keyed by memory key, preserving insertion order ── */
  const memoryMap = memory.reduce((acc, row) => {
    acc[row.key] = row.value
    return acc
  }, {} as Record<string, string>)

  /* ── Derive chat messages from step executions ── */
  const AI_KEYS = ['chat_message', 'assistant_message', 'rules', 'summary', 'response', 'result', 'answer', 'output']

  const chatMessages: { role: 'user' | 'assistant'; text: string; id: string }[] = []
  const seenIds = new Set<string>()

  const sorted = [...stepExecs]
    .filter(s => s.output || s.input)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  for (const s of sorted) {
    const out = s.output as Record<string, unknown>
    const inp = s.input as Record<string, unknown>

    const userText = (
      (inp?.input_user_prompt ?? inp?.input_user_query ?? out?.input_user_prompt ?? out?.input_user_query) as string | undefined
    ) ?? ''

    if (userText && !userText.startsWith('[[var:') && !seenIds.has(s.id + '-u')) {
      seenIds.add(s.id + '-u')
      chatMessages.push({ role: 'user', text: userText, id: s.id + '-u' })
    }

    const aiKey = AI_KEYS.find(k => k in out)
    if (aiKey) {
      const val = out[aiKey]
      const aiText = Array.isArray(val) ? val.join('\n') : String(val)
      if (aiText && !seenIds.has(s.id + '-a')) {
        seenIds.add(s.id + '-a')
        chatMessages.push({ role: 'assistant', text: aiText, id: s.id + '-a' })
      }
    }
  }

  /* ── Is flow paused waiting for input ── */
  const isPaused = flowExec?.status === 'paused'
  const isRunning = flowExec?.status === 'running'
  const isProcessing = isRunning && !isPaused

  /* ── Transient status from events ── */
  useEffect(() => {
    if (!isProcessing) { setTransientStatus(null); return }
    const latest = [...events].reverse().find(e => e.event_type === 'step.start')
    if (latest?.payload?.name) setTransientStatus(`${latest.payload.name}…`)
    else setTransientStatus('Thinking…')
  }, [events, isProcessing])

  /* ── Scroll ── */
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const handleScroll = () => {
      setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 100)
    }
    el.addEventListener('scroll', handleScroll)
    return () => el.removeEventListener('scroll', handleScroll)
  }, [chatMode])

  useEffect(() => {
    if (chatMode && isAtBottom && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMode, isAtBottom, chatMessages, isProcessing])

  /* ── Send ── */
  const handleSend = async () => {
    if (!input.trim()) return
    setSending(true)
    try {
      if (stepExecs.length === 0 && flowId) {
        // start new flow
        await fetch(`${API_BASE}/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ flowId, name: input.trim().slice(0, 60), input: { input_user_prompt: input.trim() } }),
        })
      } else if (id) {
        // resume
        fetch(`${API_BASE}/flow-runs/${id}/resume`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ flowRunId: id, user_input: { input_user_prompt: input.trim() } }),
        }).catch(console.error)
      }
      setInput('')
      setTimeout(fetchData, 500)
    } catch (e) {
      console.error('Failed to send', e)
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white font-mono px-6 py-12">
        <button onClick={() => router.push('/')} className="text-neutral-600 hover:text-white mb-8 block">&larr; back</button>
        {loadError ? (
          <div>
            <p className="text-red-400 mb-4">{loadError}</p>
            <button onClick={() => { setLoading(true); setLoadError(null); fetchData() }} className="text-sm text-neutral-400 hover:text-white underline">retry</button>
          </div>
        ) : (
          <p className="text-neutral-600">loading...</p>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      <div className="px-6 py-12 pb-28">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <button onClick={() => router.push('/')} className="text-neutral-600 hover:text-white">&larr; back</button>
            <h1 className="text-lg mt-2 mb-1">{flowExec?.name || 'flow run'}</h1>
            <p className="text-neutral-600 text-xs">{id}</p>
            <p className="text-neutral-700 text-xs mt-0.5">{flowExec?.status}</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500">{chatMode ? 'chat' : 'debug'}</span>
            <div
              onClick={() => {
                const next = !chatMode
                setChatMode(next)
                const url = new URL(window.location.href)
                url.searchParams.set('chatmode', next ? '1' : '0')
                router.replace(url.pathname + url.search)
              }}
              className={`relative w-10 h-5 rounded-full transition-colors ${chatMode ? 'bg-neutral-600' : 'bg-neutral-800'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${chatMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
          </label>
        </div>

        {chatMode ? (
          /* ── Chat Mode ── */
          <div ref={scrollContainerRef} className="space-y-4">
            {chatMessages.length === 0 && !transientStatus && (
              <p className="text-neutral-600 text-sm text-center py-12">no messages yet</p>
            )}
            {chatMessages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-neutral-100 text-neutral-900 rounded-br-sm'
                    : 'bg-neutral-800 text-neutral-200 rounded-bl-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
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
          /* ── Debug Mode ── */
          <div className="space-y-8">

            {/* Memory */}
            {memory.length > 0 && (
              <CollapsibleSection label="memory" defaultOpen={true}>
                <div className="space-y-1">
                  {memory.map(row => (
                    <div key={row.id} className="flex items-start gap-2 text-xs">
                      <span className="text-neutral-500 shrink-0">{row.key}:</span>
                      <span className="text-neutral-400 break-all">{row.value}</span>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* Events */}
            {events.length > 0 && (
              <CollapsibleSection label={`events (${events.length})`} defaultOpen={false}>
                <div className="space-y-1">
                  {[...events].reverse().slice(0, 50).map(ev => (
                    <div key={ev.id} className="text-xs text-neutral-500">
                      <span className="text-neutral-400">{ev.event_type}</span>
                      {ev.payload && Object.keys(ev.payload).length > 0 && (
                        <pre className="text-neutral-600 whitespace-pre-wrap mt-0.5">{JSON.stringify(ev.payload)}</pre>
                      )}
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* Step executions */}
            {stepExecs.length === 0 ? (
              <p className="text-neutral-600">no steps yet</p>
            ) : (
              stepExecs
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                .map(step => (
                  <CollapsibleSection
                    key={step.id}
                    label={
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-neutral-500">{step.step_id}</span>
                        <span className="text-sm text-white font-semibold">{step.name}</span>
                        <span className="text-[10px] text-neutral-600 ml-auto">{step.status}</span>
                      </span>
                    }
                    defaultOpen={true}
                  >
                    {step.output && Object.keys(step.output).length > 0 && (
                      <div className="mb-2">
                        <span className="text-[10px] text-neutral-600 uppercase tracking-wider">output</span>
                        <pre className="text-xs text-neutral-400 whitespace-pre-wrap mt-1">
                          {formatJson(JSON.stringify(step.output))}
                        </pre>
                      </div>
                    )}
                    {step.error && (
                      <p className="text-xs text-red-500 mt-2">{step.error}</p>
                    )}
                  </CollapsibleSection>
                ))
            )}
          </div>
        )}
      </div>

      {/* ── Fixed Input Footer ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur">
        <div className="px-6 py-4">
          <form onSubmit={(e) => { e.preventDefault(); handleSend() }} className="flex items-center gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
              }}
              placeholder={isPaused || stepExecs.length === 0 ? 'type your message...' : isProcessing ? 'thinking...' : 'type your message...'}
              disabled={sending || (isProcessing && !isPaused)}
              className="flex-1 bg-transparent text-white border border-neutral-800 rounded px-3 py-2 text-sm outline-none focus:border-neutral-600 placeholder-neutral-700 resize-none disabled:opacity-30 disabled:cursor-not-allowed"
              rows={1}
              onInput={(e) => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = el.scrollHeight + 'px'
              }}
            />
            <button
              type="submit"
              disabled={sending || isProcessing || !input.trim()}
              className="shrink-0 text-sm text-neutral-200 hover:text-white transition-colors disabled:text-neutral-600 disabled:cursor-not-allowed"
            >
              {sending ? 'sending...' : 'send'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
