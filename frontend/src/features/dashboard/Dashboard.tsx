import { useEffect, useState } from 'react'
import { StatsStrip } from '../../components/StatsStrip'
import { IncidentList } from '../incidents/IncidentList'
import { getIncidents } from '../../lib/api'
import type { IncidentStatus, IncidentSummary } from '../../types'

const PAGE_SIZE = 10

export function Dashboard() {
  const [incidents, setIncidents] = useState<IncidentSummary[]>([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState<IncidentStatus | 'ALL'>('ALL')
  const [page, setPage]           = useState(1)

  useEffect(() => {
    setLoading(true)
    const params = {
      ...(tab === 'ALL' ? {} : { status: tab }),
      limit:  PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }
    getIncidents(params)
      .then(d => { setIncidents(d.incidents); setTotal(d.total) })
      .finally(() => setLoading(false))
  }, [tab, page])

  function handleTabChange(next: IncidentStatus | 'ALL') {
    setTab(next)
    setPage(1)
  }

  const open          = incidents.filter(i => i.status === 'OPEN').length
  const investigating = incidents.filter(i => i.status === 'INVESTIGATING').length
  const analysed      = incidents.filter(i => i.analysisCount > 0).length

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 w-full">
      <div className="mb-8 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-[#dde4f0] tracking-tight">Incidents</h1>
        {!loading && <span className="text-xs font-mono text-[#3d4f6a]">{total} total</span>}
      </div>
      <StatsStrip total={total} open={open} investigating={investigating} analysed={analysed} />
      <IncidentList
        incidents={incidents}
        loading={loading}
        activeTab={tab}
        onTabChange={handleTabChange}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={setPage}
      />
    </div>
  )
}
