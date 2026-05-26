import { DomainIncident } from '../incidents/incidentInterfaces'
import { Result } from '../shared/types'
import {
  AnalysisOutput,
  JudgeOutput,
  MetricSummary,
  RawLog,
  RcaContext,
  RemediationActionInput,
  SanitizedLogs,
} from './rcaTypes'

export type LogFetchParams = {
  serviceName: string
  namespace:   string
  podName?:    string | null
  windowStart: Date
  windowEnd:   Date
}

export type MetricFetchParams = {
  serviceName: string
  namespace:   string
  windowStart: Date
  windowEnd:   Date
}

export type PersistPassedParams = {
  incidentId:      string
  rootCause:       string
  confidenceScore: number
  judgeScore:      number
  judgeFeedback:   string
  attempts:        number
  logWindowStart:  Date
  logWindowEnd:    Date
  actions:         RemediationActionInput[]
}

export type PersistLowConfidenceParams = {
  incidentId:      string
  rootCause:       string
  confidenceScore: number
  judgeScore:      number
  judgeFeedback:   string | null
  attempts:        number
  logWindowStart:  Date
  logWindowEnd:    Date
}

export interface IRcaLogFetcher {
  fetch(params: LogFetchParams): Promise<Result<RawLog[]>>
}

export interface IRcaMetricsFetcher {
  fetch(params: MetricFetchParams): Promise<Result<MetricSummary>>
}

export interface IRcaSanitizer {
  sanitize(logs: RawLog[]): SanitizedLogs
}

export interface IRcaAnalyser {
  analyse(incident: DomainIncident, context: RcaContext, priorFeedback?: string | null): Promise<Result<AnalysisOutput>>
}

export interface IRcaJudge {
  score(incident: DomainIncident, analysis: AnalysisOutput): Promise<Result<JudgeOutput>>
}

export interface IRcaRepository {
  persistPassed(params: PersistPassedParams): Promise<void>
  persistLowConfidence(params: PersistLowConfidenceParams): Promise<void>
}

