'use client'

export const runtime = 'edge'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Flow {
  id: string
  name: string
  description: string | null
}

interface FlowRun {
  id: string
  flow_id: string
  status: string
  started_at: number | null
  completed_at: number | null
  created_at?: string
}

interface FlowRunWithTitle extends FlowRun {
  title: string
  flowName: string
}

export default function Home() {
  const router = useRouter()
  const [flows, setFlows] = useState<Flow[]>([])
  const [flowRuns, setFlowRuns] = useState<FlowRunWithTitle[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFlow, setSelectedFlow] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [flowsRes, flowRunsRes] = await Promise.all([
          fetch('/api/proxy/rest/v1/knowledge?namespace=eq.flow&is_active=eq.true', {
            headers: { 'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '', 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}` }
          }),
          fetch('/api/proxy/flow-runs'),
        ])
        let flowsList: Flow[] = []
        if (flowsRes.ok) {
          const data = await flowsRes.json()
          const raw = Array.isArray(data) ? data : []
          flowsList = raw
            .filter((k: Record<string,unknown>) => k.namespace === 'flow' || (k.context as Record<string,unknown>)?.flow_id)
            .map((k: Record<string,unknown>) => ({
              id: String((k.context as Record<string,unknown>)?.flow_id ?? k.id),
              name: String(k.name),
              description: (k.readable ?? null) as string | null,
            }))
          setFlows(flowsList)
        }
        const flowMap = new Map(flowsList.map((f) => [f.id, f.name]))

        let runs: FlowRun[] = []
        if (flowRunsRes.ok) {
          const data = await flowRunsRes.json()
          runs = Array.isArray(data) ? data : []
        }

        // Show latest 30 runs, sorted by created_at desc
        const sorted = [...runs].sort((a, b) => {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
          return bTime - aTime
        })
        const latest = sorted.slice(0, 30)

        // Show immediately with id-based titles, then enrich with context
        const initial = latest.map((run) => ({
          ...run,
          title: run.id.slice(0, 8),
          flowName: flowMap.get(run.flow_id) || run.flow_id.slice(0, 8),
        }))
        setFlowRuns(initial)
        setLoading(false)

        // Fetch context for each run in background to get first variable value as title
        for (const run of latest) {
          try {
            const ctxRes = await fetch(`/api/proxy/flow-runs/${run.id}/context`)
            if (ctxRes.ok) {
              const ctx = await ctxRes.json()
              const vars = ctx.available_variables ?? []
              const firstVal = vars.find((v: unknown) => {
                const val = typeof v === 'object' && v !== null ? (v as Record<string, unknown>).value : undefined
                return val !== undefined && val !== null && String(val).trim()
              })
              if (firstVal) {
                const val = typeof firstVal === 'object' ? (firstVal as Record<string, unknown>).value : null
                if (val) {
                  const title = String(val).replace(/\s+/g, ' ').trim().slice(0, 60)
                  setFlowRuns((prev) => prev.map((r) => r.id === run.id ? { ...r, title } : r))
                }
              }
            }
          } catch {
            // keep id-based title
          }
        }
      } catch (e) {
        console.error('Failed to fetch data', e)
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const startFlow = async (flowId: string) => {
    if (starting) return
    setSelectedFlow(flowId)
    setStarting(true)
    try {
      const res = await fetch('/api/proxy/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flowId }),
      })
      const data = await res.json()
      console.log('start response:', JSON.stringify(data))
      const runId = data.flowRunId ?? data.id ?? data.flow_run_id ?? data.runId ?? data.executionId
      if (runId) {
        router.push(`/flow-run/${runId}?flowId=${flowId}`)
      } else {
        console.error('no run id in response', data)
      }
    } catch (e) {
      console.error('Failed to start flow', e)
    }
    setStarting(false)
    setSelectedFlow(null)
  }

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-lg mb-8">flows</h1>

        {loading ? (
          <p className="text-neutral-600">loading...</p>
        ) : (
          <>
            {flows.length > 0 && (
              <div className="space-y-1 mb-12">
                {flows.map((flow) => (
                  <div key={flow.id} className="px-3 py-2">
                    <div className="flex items-center gap-4">
                      <span className="text-neutral-400 text-sm truncate flex-1">
                        {flow.name}
                      </span>
                      <button
                        onClick={() => startFlow(flow.id)}
                        disabled={starting && selectedFlow === flow.id}
                        className="text-xs text-neutral-600 hover:text-white disabled:opacity-30 transition-colors"
                      >
                        {starting && selectedFlow === flow.id ? '...' : 'start'}
                      </button>
                    </div>
                    {flow.description && (
                      <p className="text-neutral-600 text-xs mt-1">{flow.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <h2 className="text-sm text-neutral-600 mb-4">flow runs</h2>
            {flowRuns.length === 0 ? (
              <p className="text-neutral-600 text-xs">no flow runs yet</p>
            ) : (
              <div className="space-y-1">
                {flowRuns.map((run) => (
                  <div
                    key={run.id}
                    onClick={() => router.push(`/flow-run/${run.id}`)}
                    className="px-3 py-2 cursor-pointer hover:bg-neutral-900 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-neutral-200 text-sm truncate flex-1">
                        {run.title}
                      </span>
                      <span className="text-xs text-neutral-600">{run.flowName}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}