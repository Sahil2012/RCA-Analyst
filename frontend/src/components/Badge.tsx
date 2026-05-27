import type { AnalysisStatus, ConfidenceLevel, ExecutionStatus, IncidentStatus, ActionPriority, Severity } from '../types'

const base = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium tracking-wide'

export function SeverityBadge({ severity }: Readonly<{ severity: Severity }>) {
  const colors: Record<Severity, string> = {
    CRITICAL: 'bg-red-500/20 text-red-300 border border-red-500/30',
    HIGH:     'bg-orange-500/20 text-orange-300 border border-orange-500/30',
    MEDIUM:   'bg-yellow-500/15 text-yellow-300 border border-yellow-500/25',
    LOW:      'bg-blue-500/15 text-blue-300 border border-blue-500/25',
  }
  return <span className={`${base} ${colors[severity]}`}>{severity}</span>
}

export function StatusBadge({ status }: Readonly<{ status: IncidentStatus }>) {
  const colors: Record<IncidentStatus, string> = {
    OPEN:           'bg-red-500/15 text-red-300 border border-red-500/25',
    INVESTIGATING:  'bg-violet-500/15 text-violet-300 border border-violet-500/25',
    RESOLVED:       'bg-green-500/15 text-green-300 border border-green-500/25',
    FALSE_POSITIVE: 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20',
    LOW_CONFIDENCE: 'bg-orange-500/15 text-orange-300 border border-orange-500/25',
  }
  return (
    <span className={`${base} gap-1.5 ${colors[status]}`}>
      {status === 'OPEN' && <span className="size-1.5 rounded-full bg-red-400 animate-pulse shrink-0" />}
      {status.replaceAll('_', ' ')}
    </span>
  )
}

export function AnalysisStatusBadge({ status }: Readonly<{ status: AnalysisStatus }>) {
  const colors: Record<AnalysisStatus, string> = {
    PASSED:         'bg-green-500/10 text-green-400 border border-green-500/20',
    LOW_CONFIDENCE: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
    PENDING:        'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20',
    FAILED:         'bg-red-500/10 text-red-400 border border-red-500/20',
  }
  return <span className={`${base} ${colors[status]}`}>{status.replace('_', ' ')}</span>
}

export function ConfidenceBadge({ level }: Readonly<{ level: ConfidenceLevel | null }>) {
  if (!level) return null
  const colors: Record<ConfidenceLevel, string> = {
    HIGH:   'bg-[var(--accent-bg)] text-violet-300 border border-[var(--accent-border)]',
    MEDIUM: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
    LOW:    'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20',
  }
  return <span className={`${base} ${colors[level]}`}>{level}</span>
}

export function PriorityBadge({ priority }: Readonly<{ priority: ActionPriority }>) {
  const colors: Record<ActionPriority, string> = {
    P0: 'bg-red-500/20 text-red-300 border border-red-500/30',
    P1: 'bg-orange-500/15 text-orange-400 border border-orange-500/25',
    P2: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
    P3: 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20',
  }
  return <span className={`${base} ${colors[priority]}`}>{priority}</span>
}

export function ExecutionBadge({ status }: Readonly<{ status: ExecutionStatus }>) {
  const colors: Record<ExecutionStatus, string> = {
    PENDING:  'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20',
    EXECUTED: 'bg-green-500/10 text-green-400 border border-green-500/20',
    FAILED:   'bg-red-500/10 text-red-400 border border-red-500/20',
    SKIPPED:  'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20',
  }
  return <span className={`${base} ${colors[status]}`}>{status}</span>
}
