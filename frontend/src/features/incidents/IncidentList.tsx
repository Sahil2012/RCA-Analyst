import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { SeverityBadge, StatusBadge } from '../../components/Badge'
import type { IncidentStatus, IncidentSummary, Severity } from '../../types'

const severityBar: Record<Severity, string> = {
  CRITICAL: 'border-l-2 border-l-red-500',
  HIGH:     'border-l-2 border-l-orange-500',
  MEDIUM:   'border-l-2 border-l-yellow-500',
  LOW:      'border-l-2 border-l-blue-500',
}

const severityRowTint: Record<Severity, string> = {
  CRITICAL: 'bg-red-500/[0.04]',
  HIGH:     'bg-orange-500/[0.03]',
  MEDIUM:   '',
  LOW:      '',
}

const TABS: Array<{ label: string; value: IncidentStatus | 'ALL' }> = [
  { label: 'All',           value: 'ALL' },
  { label: 'Open',          value: 'OPEN' },
  { label: 'Investigating', value: 'INVESTIGATING' },
  { label: 'Resolved',      value: 'RESOLVED' },
]

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const SKELETON_WIDTHS = [60, 45, 55, 30, 40, 20, 35]

function SkeletonRow() {
  return (
    <tr>
      {SKELETON_WIDTHS.map(w => (
        <td key={w} className="px-4 py-3">
          <div className="h-3 bg-zinc-800 rounded animate-pulse" style={{ width: `${w}%` }} />
        </td>
      ))}
    </tr>
  )
}

interface Props {
  incidents: IncidentSummary[]
  loading: boolean
  activeTab: IncidentStatus | 'ALL'
  onTabChange: (tab: IncidentStatus | 'ALL') => void
}

export function IncidentList({ incidents, loading, activeTab, onTabChange }: Readonly<Props>) {
  const navigate = useNavigate()

  function renderRows() {
    if (loading) return [1,2,3,4,5].map(n => <SkeletonRow key={n} />)
    if (incidents.length === 0) return (
      <tr><td colSpan={7} className="px-4 py-10 text-center text-zinc-600 text-sm">No incidents found</td></tr>
    )
    return incidents.map((inc, idx) => (
      <tr key={inc.id} onClick={() => navigate(`/incidents/${inc.id}`)}
        className={`cursor-pointer transition-colors duration-150 hover:bg-violet-500/5 row-enter ${severityRowTint[inc.severity]}`}
        style={{ animationDelay: `${idx * 35}ms` }}
      >
        <td className={`px-4 py-3.5 text-[15px] font-semibold text-zinc-100 ${severityBar[inc.severity]}`}>
          <span className="flex items-center gap-1.5">
            {inc.serviceName}
            {inc.analysisCount > 0 && <Sparkles size={11} className="text-violet-400/60 shrink-0" />}
          </span>
        </td>
        <td className="px-4 py-3.5 text-zinc-500 font-mono text-[11px]">{inc.namespace}</td>
        <td className="px-4 py-3.5 text-zinc-500 font-mono text-[11px]">{inc.type.replaceAll('_', ' ')}</td>
        <td className="px-4 py-3.5"><SeverityBadge severity={inc.severity} /></td>
        <td className="px-4 py-3.5"><StatusBadge status={inc.status} /></td>
        <td className="px-4 py-3.5 text-zinc-400 tabular-nums text-sm font-mono">{inc.occurrences}×</td>
        <td className="px-4 py-3.5 text-zinc-600 text-[11px] tabular-nums font-mono">{formatTime(inc.occurredAt)}</td>
      </tr>
    ))
  }

  return (
    <div className="bg-[#111116] border border-[#1e1e2a] rounded-lg overflow-hidden">
      <div className="flex border-b border-[#1e1e2a] px-4">
        {TABS.map(tab => (
          <button key={tab.value} type="button" onClick={() => onTabChange(tab.value)}
            className={`py-3 px-3 text-xs font-mono uppercase tracking-widest transition-colors border-b-2 -mb-px ${
              activeTab === tab.value
                ? 'text-violet-400 border-violet-500'
                : 'text-zinc-600 border-transparent hover:text-zinc-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-[#1e1e2a]">
              {['Service','Namespace','Type','Severity','Status','Hits','Time'].map(h => (
                <th key={h} className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-zinc-600 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e1e2a]">
            {renderRows()}
          </tbody>
        </table>
      </div>
    </div>
  )
}
