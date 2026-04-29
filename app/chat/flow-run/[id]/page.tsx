'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

export default function FlowRunPage() {
  const params = useParams()
  const flowRunId = params?.id as string
  const [runs, setRuns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!flowRunId) return
    const fetchRuns = async () => {
      const res = await fetch(`/api/step-runs?flow_run_id=${flowRunId}`)
      const data = await res.json()
      if (Array.isArray(data)) setRuns(data)
      setLoading(false)
    }
    fetchRuns()
    const interval = setInterval(fetchRuns, 2000)
    return () => clearInterval(interval)
  }, [flowRunId])

  if (loading) return <div style={{ padding: 20, color: '#888' }}>Loading...</div>

  return (
    <div style={{ background: '#000', color: '#f0f0f0', minHeight: '100vh', padding: 20, fontFamily: 'monospace' }}>
      {runs.map(run => (
        <div key={run.id} style={{ marginBottom: 24, borderBottom: '1px solid #333', paddingBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            <span style={{ color: '#aaa' }}>{run.step_id}</span>
            <span style={{
              color: run.status === 'completed' ? '#4caf50' : run.status === 'running' ? '#2196f3' : '#ff9800'
            }}>{run.status}</span>
          </div>
          <pre style={{ fontSize: 12, color: '#999', margin: '4px 0' }}>variables: {JSON.stringify(run.trace?.variables, null, 2)}</pre>
          <pre style={{ fontSize: 12, color: '#999', margin: '4px 0' }}>api_calls: {JSON.stringify(run.trace?.api_calls, null, 2)}</pre>
          <pre style={{ fontSize: 12, color: '#999', margin: '4px 0' }}>queries: {JSON.stringify(run.trace?.queries, null, 2)}</pre>
          <pre style={{ fontSize: 12, color: '#999', margin: '4px 0' }}>rules_fired: {JSON.stringify(run.trace?.rules_fired, null, 2)}</pre>
        </div>
      ))}
    </div>
  )
}