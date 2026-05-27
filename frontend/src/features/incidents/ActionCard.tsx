import { useState } from 'react'
import { ConfidenceBadge, ExecutionBadge, PriorityBadge } from '../../components/Badge'
import { Card } from '../../components/Card'
import { updateActionStatus } from '../../lib/api'
import type { ExecutionStatus, RemediationAction } from '../../types'

const STATUSES: ExecutionStatus[] = ['PENDING', 'EXECUTED', 'FAILED', 'SKIPPED']

export function ActionCard({ action, onStatusChange }: Readonly<{
  action: RemediationAction
  onStatusChange?: (id: string, status: ExecutionStatus) => void
}>) {
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState<ExecutionStatus>(action.executionStatus)
  const [saving, setSaving] = useState(false)

  async function handleStatus(next: ExecutionStatus) {
    if (next === status) return
    setSaving(true)
    try {
      await updateActionStatus(action.id, next)
      setStatus(next)
      onStatusChange?.(action.id, next)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <PriorityBadge priority={action.priority} />
          <ConfidenceBadge level={action.confidenceLevel} />
          {action.automationSupported && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-violet-500/10 text-violet-400 border border-violet-500/20">
              AUTO
            </span>
          )}
        </div>
        <ExecutionBadge status={status} />
      </div>

      <p className="text-sm font-medium text-zinc-100">{action.actionTitle}</p>

      <p className={`text-sm text-zinc-400 leading-relaxed ${!expanded ? 'line-clamp-2' : ''}`}>
        {action.actionDescription}
      </p>
      {action.actionDescription.length > 120 && (
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors text-left"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}

      <div className="grid grid-cols-1 gap-2 pt-1 border-t border-[#1e1e2a]">
        {action.blastRadius && <MetaChip label="Blast radius" value={action.blastRadius} />}
        {action.downtimeRisk && <MetaChip label="Downtime"    value={action.downtimeRisk} />}
        {action.rollback     && <MetaChip label="Rollback"    value={action.rollback} />}
      </div>

      <div className="flex gap-1 pt-1">
        {STATUSES.map(s => (
          <button
            key={s}
            type="button"
            disabled={saving}
            onClick={() => handleStatus(s)}
            className={`flex-1 py-1 text-xs font-mono rounded transition-colors ${
              status === s
                ? 'bg-zinc-700 text-zinc-100'
                : 'text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </Card>
  )
}

function MetaChip({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-zinc-600 font-mono uppercase tracking-wide shrink-0">{label}</span>
      <span className="text-zinc-400">{value}</span>
    </div>
  )
}
