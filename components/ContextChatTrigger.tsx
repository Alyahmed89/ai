'use client'

import { useState } from 'react'

const API_BASE = '/api/proxy'

interface ContextChatTriggerProps {
  label: string
  value: unknown
  stepRunId: string
  flowRunId?: string
  relatedRules?: unknown[]
  className?: string
}

export function ContextChatTrigger({
  label,
  value,
  stepRunId,
  flowRunId,
  relatedRules,
  className = '',
}: ContextChatTriggerProps) {
  const [sending, setSending] = useState(false)

  const handleChat = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (sending) return
    setSending(true)

    try {
      const res = await fetch(`${API_BASE}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flow_id: 'prolog-and-me-flow-id',
          variables: {
            var_context_key: label,
            var_context_value:
              typeof value === 'string' ? value : JSON.stringify(value),
            var_step_run_id: stepRunId,
            var_flow_run_id: flowRunId || '',
            var_related_rules: relatedRules
              ? JSON.stringify(relatedRules)
              : '[]',
          },
        }),
      })

      if (res.status === 404) {
        console.warn('prolog-and-me flow not yet created')
        return
      }

      const data = await res.json()
      if (data.flowRunId) {
        window.open(`/flow-run/${data.flowRunId}`, '_blank')
      }
    } catch (e) {
      console.error('Failed to start context chat', e)
    }
    setSending(false)
  }

  return (
    <span
      className={`group relative ${className}`}
    >
      <button
        onClick={handleChat}
        disabled={sending}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-xs ml-1.5
                   text-neutral-600 hover:text-amber-400 disabled:opacity-30"
        title={`Discuss "${label}" with AI`}
      >
        {sending ? '...' : '💬'}
      </button>
    </span>
  )
}
