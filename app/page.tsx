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
}

export default function Home() {
  const router = useRouter()
  const [flows, setFlows] = useState<Flow[]>([])
  const [flowRuns, setFlowRuns] = useState<FlowRun[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFlow, setSelectedFlow] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [flowsRes, flowRunsRes] = await Promise.all([
          fetch('/api/proxy/api/flows'),
          fetch('/api/proxy/flow-runs'),
        ])
        if (flowsRes.ok) {
          const data = await flowsRes.json()
          setFlows(Array.isArray(data) ? data : [])
        }
        if (flowRunsRes.ok) {
          const data = await flowRunsRes.json()
          setFlowRuns(Array.isArray(data) ? data : [])
        }
      } catch (e) {
        console.error('Failed to fetch data', e)
      }
      setLoading(false)
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
      if (data.flowRunId) {
        router.push(`/flow-run/${data.flowRunId}?flowId=${flowId}`)
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
                      <span className="text-neutral-400 text-sm truncate flex-1">
                        {run.id.slice(0, 8)}...
                      </span>
                      <span className="text-xs text-neutral-600">{run.status}</span>
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