'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Flow {
  id: string
  name: string
  description: string | null
}

export default function Home() {
  const router = useRouter()
  const [flows, setFlows] = useState<Flow[]>([])
  const [loading, setLoading] = useState(true)
  const [prompt, setPrompt] = useState('')
  const [selectedFlow, setSelectedFlow] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    const fetchFlows = async () => {
      try {
        const res = await fetch('/api/proxy/api/flows')
        const data = await res.json()
        setFlows(Array.isArray(data) ? data : [])
      } catch (e) {
        console.error('Failed to fetch flows', e)
      }
      setLoading(false)
    }
    fetchFlows()
  }, [])

  const startFlow = async (flowId: string) => {
    if (!prompt.trim() || starting) return
    setSelectedFlow(flowId)
    setStarting(true)
    try {
      const res = await fetch('/api/proxy/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flowId, input_prompt: prompt }),
      })
      const data = await res.json()
      if (data.flowRunId) {
        router.push(`/flow-run/${data.flowRunId}`)
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
        ) : flows.length === 0 ? (
          <p className="text-neutral-600">no flows found</p>
        ) : (
          <div className="space-y-1">
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

        <div className="mt-12 flex gap-3">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                const firstFlow = flows[0]
                if (firstFlow) startFlow(firstFlow.id)
              }
            }}
            placeholder="enter prompt and click start on a flow..."
            className="flex-1 bg-transparent text-white border-none outline-none text-sm placeholder-neutral-600"
          />
        </div>
      </div>
    </div>
  )
}