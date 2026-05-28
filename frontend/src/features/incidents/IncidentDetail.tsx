import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Card } from '../../components/Card'
import { AnalysisStatusBadge, SeverityBadge, StatusBadge } from '../../components/Badge'
import { MermaidChart } from '../../components/MermaidChart'
import { FiveWhys } from './FiveWhys'
import { ActionCard } from './ActionCard'
import { getAnalysis, getIncident, triggerAnalysis } from '../../lib/api'
import type { AnalysisReport, IncidentDetail as IIncidentDetail } from '../../types'

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function ScoreBar({ value, label }: Readonly<{ value: number; label: string }>) {
  const pct   = Math.round(value * 100)
  let color = 'bg-orange-500'
  if (pct >= 80) color = 'bg-green-500'
  else if (pct >= 60) color = 'bg-yellow-500'
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs text-zinc-500">{label}</span>
        <span className="text-xs font-mono text-zinc-300">{pct}%</span>
      </div>
      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function MetaRow({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-xs text-zinc-600">{label}</dt>
      <dd className="text-xs text-zinc-300 font-mono text-right">{value}</dd>
    </div>
  )
}

export function IncidentDetail() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const [incident, setIncident]     = useState<IIncidentDetail | null>(null)
  const [analysis, setAnalysis]     = useState<AnalysisReport | null>(null)
  const [loading, setLoading]       = useState(true)
  const [missing, setMissing]       = useState(false)
  const [triggering, setTriggering] = useState(false)
  const [triggered, setTriggered]   = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([getIncident(id), getAnalysis(id).catch(() => null)])
      .then(([inc, ana]) => { setIncident(inc); setAnalysis(ana) })
      .catch(() => setMissing(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-4">
      {[1,2,3,4].map(n => (
        <div key={n} className="h-16 bg-zinc-900 rounded-lg animate-pulse" />
      ))}
    </div>
  )

  if (missing || !incident) return (
    <div className="max-w-7xl mx-auto px-4 py-20 text-center text-zinc-600">Incident not found</div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full">
      <button type="button" onClick={() => navigate('/')}
        className="flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-300 transition-colors mb-6"
      >
        <ArrowLeft size={14} /> Back
      </button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">{incident.serviceName}</h1>
          <p className="text-sm text-zinc-500 font-mono mt-0.5">
            {incident.namespace}{incident.podName ? ` · ${incident.podName}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SeverityBadge severity={incident.severity} />
          <StatusBadge status={incident.status} />
          {analysis && <AnalysisStatusBadge status={analysis.status} />}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {analysis ? (
            <>
              <Card className="p-5">
                <h2 className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-3">Root Cause</h2>
                <p className="text-zinc-100 leading-relaxed">{analysis.rootCause}</p>
              </Card>

              {analysis.fiveWhys && analysis.fiveWhys.length > 0 && (
                <Card className="p-5">
                  <h2 className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-4">5-Whys Analysis</h2>
                  <FiveWhys items={analysis.fiveWhys} />
                </Card>
              )}

              {analysis.symptomDiagram && (
                <Card className="p-5">
                  <h2 className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-4">Root Cause → Symptoms</h2>
                  <MermaidChart diagram={analysis.symptomDiagram} />
                </Card>
              )}

              {analysis.actions.length > 0 && (
                <div>
                  <h2 className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-3">Remediation Actions</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {analysis.actions.map(a => <ActionCard key={a.id} action={a} />)}
                  </div>
                </div>
              )}
            </>
          ) : (
            <Card className="p-8 text-center space-y-4">
              <p className="text-zinc-600 text-sm">No analysis available yet</p>
              {triggered ? (
                <p className="text-xs text-indigo-400 font-mono">Analysis queued — refresh in ~30s</p>
              ) : (
                <button
                  type="button"
                  disabled={triggering}
                  onClick={() => {
                    if (!id) return
                    setTriggering(true)
                    triggerAnalysis(id)
                      .then(() => setTriggered(true))
                      .catch(() => {})
                      .finally(() => setTriggering(false))
                  }}
                  className="px-4 py-2 text-xs font-mono bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded transition-colors"
                >
                  {triggering ? 'Queuing…' : 'Trigger Analysis'}
                </button>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-600 mb-3">Incident</h3>
            <dl className="space-y-2.5">
              <MetaRow label="Type"        value={incident.type.replaceAll('_', ' ')} />
              <MetaRow label="Source"      value={incident.source} />
              <MetaRow label="Occurrences" value={`${incident.occurrences}×`} />
              <MetaRow label="Occurred"    value={fmt(incident.occurredAt)} />
              {incident.resolvedAt && <MetaRow label="Resolved" value={fmt(incident.resolvedAt)} />}
            </dl>
          </Card>

          {analysis && (
            <Card className="p-4">
              <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-600 mb-3">Analysis</h3>
              <div className="space-y-3 mb-3">
                <ScoreBar value={analysis.confidenceScore} label="Confidence" />
                <ScoreBar value={analysis.judgeScore}      label="Judge score" />
              </div>
              <dl className="space-y-2.5 pt-3 border-t border-[#1e1e2a]">
                <MetaRow label="Attempts" value={String(analysis.attempts)} />
                <MetaRow label="Actions"  value={String(analysis.actions.length)} />
                {analysis.judgeFeedback && (
                  <div>
                    <dt className="text-xs text-zinc-600 mb-1">Judge feedback</dt>
                    <dd className="text-xs text-zinc-400 leading-relaxed">{analysis.judgeFeedback}</dd>
                  </div>
                )}
              </dl>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
