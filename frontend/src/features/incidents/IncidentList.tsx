import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { SeverityBadge, StatusBadge } from '../../components/Badge'
import { Pagination } from '../../components/Pagination'
import type { IncidentStatus, IncidentSummary, Severity } from '../../types'

const severityAccent: Record<Severity, string> = {
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

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const SKELETON_COLS = [55, 20, 22, 15]

function SkeletonRow() {
  return (
    <tr className="border-b border-(--border)">
      {SKELETON_COLS.map(w => (
        <td key={w} className="px-4 py-4">
          <div className="h-3 bg-zinc-800 rounded animate-pulse" style={{ width: `${w}%` }} />
          {w === 55 && <div className="h-2 bg-zinc-800/60 rounded animate-pulse mt-2" style={{ width: '40%' }} />}
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
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

export function IncidentList({ incidents, loading, activeTab, onTabChange, page, pageSize, total, onPageChange }: Readonly<Props>) {
  const navigate = useNavigate()

  function renderRows() {
    if (loading) return [1,2,3,4,5].map(n => <SkeletonRow key={n} />)
    if (incidents.length === 0) return (
      <tr>
        <td colSpan={4} className="px-4 py-14 text-center text-zinc-600 text-sm">
          No incidents found
        </td>
      </tr>
    )
    return incidents.map((inc, idx) => (
      <tr
        key={inc.id}
        onClick={() => navigate(`/incidents/${inc.id}`)}
        className={`cursor-pointer border-b border-(--border) transition-colors duration-150 hover:bg-blue-500/4 row-enter ${severityRowTint[inc.severity]}`}
        style={{ animationDelay: `${idx * 35}ms` }}
      >
        <td className={`px-4 py-4 ${severityAccent[inc.severity]}`}>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[15px] font-semibold text-zinc-100 leading-none">{inc.serviceName}</span>
            {inc.analysisCount > 0 && <Sparkles size={11} className="text-violet-400/60 shrink-0" />}
          </div>
          <div className="text-[11px] font-mono text-zinc-600 mt-1">
            {inc.namespace}<span className="mx-1.5 text-zinc-700">·</span>{inc.type.replaceAll('_', ' ')}
          </div>
        </td>
        <td className="px-4 py-4 whitespace-nowrap">
          <SeverityBadge severity={inc.severity} />
        </td>
        <td className="px-4 py-4 whitespace-nowrap">
          <StatusBadge status={inc.status} />
        </td>
        <td className="px-4 py-4 text-right">
          <span className="text-zinc-300 font-mono text-sm tabular-nums">{inc.occurrences}×</span>
          <div className="text-[11px] font-mono text-zinc-600 mt-0.5">{formatRelative(inc.occurredAt)}</div>
        </td>
      </tr>
    ))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab.value}
              type="button"
              onClick={() => onTabChange(tab.value)}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-widest rounded transition-colors ${
                activeTab === tab.value
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-(--border) rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-(--border) bg-[#07091f]">
              <th className="px-4 py-2.5 text-left text-[10px] font-mono uppercase tracking-widest text-zinc-600 font-medium w-full">Service</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-mono uppercase tracking-widest text-zinc-600 font-medium whitespace-nowrap">Severity</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-mono uppercase tracking-widest text-zinc-600 font-medium whitespace-nowrap">Status</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-mono uppercase tracking-widest text-zinc-600 font-medium whitespace-nowrap">Activity</th>
            </tr>
          </thead>
          <tbody>
            {renderRows()}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={pageSize} total={total} onChange={onPageChange} />
    </div>
  )
}
