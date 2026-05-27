export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE' | 'LOW_CONFIDENCE'
export type IncidentType = 'POD_CRASH' | 'HIGH_CPU' | 'HIGH_MEMORY' | 'HIGH_ERROR_RATE' | 'LATENCY_SPIKE'
export type AnalysisStatus = 'PENDING' | 'PASSED' | 'FAILED' | 'LOW_CONFIDENCE'
export type ActionPriority = 'P0' | 'P1' | 'P2' | 'P3'
export type ExecutionStatus = 'PENDING' | 'EXECUTED' | 'FAILED' | 'SKIPPED'
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW'

export interface IncidentSummary {
  id: string
  serviceName: string
  namespace: string
  severity: Severity
  type: IncidentType
  status: IncidentStatus
  occurrences: number
  occurredAt: string
  analysisCount: number
}

export interface IncidentDetail extends IncidentSummary {
  podName: string | null
  source: string
  correlationId: string | null
  resolvedAt: string | null
  createdAt: string
  latestAnalysis: { id: string; status: AnalysisStatus; confidenceScore: number; judgeScore: number } | null
}

export interface FiveWhy {
  question: string
  answer: string
}

export interface RemediationAction {
  id: string
  actionTitle: string
  actionDescription: string
  priority: ActionPriority
  confidenceLevel: ConfidenceLevel | null
  automationSupported: boolean
  blastRadius: string | null
  downtimeRisk: string | null
  rollback: string | null
  executionStatus: ExecutionStatus
  executedAt: string | null
}

export interface AnalysisReport {
  id: string
  incidentId: string
  rootCause: string
  confidenceScore: number
  judgeScore: number
  judgeFeedback: string | null
  fiveWhys: FiveWhy[] | null
  symptomDiagram: string | null
  attempts: number
  status: AnalysisStatus
  logWindowStart: string | null
  logWindowEnd: string | null
  createdAt: string
  actions: RemediationAction[]
}
