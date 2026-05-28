import type { AnalysisReport, ExecutionStatus, IncidentDetail, IncidentStatus, IncidentSummary } from '../types'

const BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

export const getIncidents = (params?: { status?: IncidentStatus; limit?: number; offset?: number }) => {
  const q = new URLSearchParams()
  if (params?.status) q.set('status', params.status)
  if (params?.limit)  q.set('limit',  String(params.limit))
  if (params?.offset) q.set('offset', String(params.offset))
  const qs = q.toString()
  const path = qs ? `/incidents?${qs}` : '/incidents'
  return request<{ incidents: IncidentSummary[]; total: number }>(path)
}

export const getIncident       = (id: string) => request<IncidentDetail>(`/incidents/${id}`)
export const getAnalysis       = (incidentId: string) => request<AnalysisReport>(`/incidents/${incidentId}/analysis`)
export const triggerAnalysis   = (incidentId: string) => request<{ queued: boolean }>(`/incidents/${incidentId}/analyze`, { method: 'POST' })
export const updateActionStatus = (id: string, executionStatus: ExecutionStatus) =>
  request<{ id: string; executionStatus: ExecutionStatus; executedAt: string | null }>(
    `/actions/${id}/status`,
    { method: 'PATCH', body: JSON.stringify({ executionStatus }) },
  )
