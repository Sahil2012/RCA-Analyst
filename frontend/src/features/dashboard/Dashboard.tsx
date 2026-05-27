import { useEffect, useState } from 'react'
import { StatsStrip } from '../../components/StatsStrip'
import { IncidentList } from '../incidents/IncidentList'
import { getIncidents } from '../../lib/api'
import type { IncidentStatus, IncidentSummary } from '../../types'

export function Dashboard() {
  const [incidents, setIncidents] = useState<IncidentSummary[]>([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState<IncidentStatus | 'ALL'>('ALL')

  useEffect(() => {
    setLoading(true)
    const params = tab === 'ALL' ? undefined : { status: tab }
    getIncidents(params)
      .then(d => { setIncidents(d.incidents); setTotal(d.total) })
      .finally(() => setLoading(false))
  }, [tab])

  const open          = incidents.filter(i => i.status === 'OPEN').length
  const investigating = incidents.filter(i => i.status === 'INVESTIGATING').length
  const analysed      = incidents.filter(i => i.analysisCount > 0).length

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full">
      <div className="mb-8">
        <p className="text-xs font-mono uppercase tracking-widest text-zinc-600 mb-1">Overview</p>
        <h1 className="text-2xl font-bold text-zinc-50 tracking-tight">Incidents</h1>
      </div>
      <StatsStrip total={total} open={open} investigating={investigating} analysed={analysed} />
      <IncidentList incidents={incidents} loading={loading} activeTab={tab} onTabChange={setTab} />
    </div>
  )
}
