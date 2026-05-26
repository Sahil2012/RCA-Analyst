import { DomainIncident, IAnalysisTrigger } from '../incidents/incidentInterfaces'
import { logger } from '../shared/logger'
import {
  IRcaAnalyser,
  IRcaJudge,
  IRcaLogFetcher,
  IRcaMetricsFetcher,
  IRcaRepository,
  IRcaSanitizer,
  LogFetchParams,
  MetricFetchParams,
} from './rcaInterfaces'
import { AnalysisOutput, RcaContext } from './rcaTypes'

export type RcaServiceOptions = {
  maxAttempts:        number
  judgePassThreshold: number
  logWindowBeforeMs:  number
  logWindowAfterMs:   number
}

export class RcaService implements IAnalysisTrigger {
  constructor(
    private readonly logFetcher:     IRcaLogFetcher,
    private readonly metricsFetcher: IRcaMetricsFetcher,
    private readonly sanitizer:      IRcaSanitizer,
    private readonly analyser:       IRcaAnalyser,
    private readonly judge:          IRcaJudge,
    private readonly repo:           IRcaRepository,
    private readonly options:        RcaServiceOptions,
  ) {}

  analyze(incident: DomainIncident): void {
    this.run(incident).catch(e => {
      logger.error('Unhandled RCA pipeline error', {
        incidentId: incident.id,
        error:      e instanceof Error ? e.message : String(e),
      })
    })
  }

  private async run(incident: DomainIncident): Promise<void> {
    const meta        = { incidentId: incident.id, service: incident.serviceName }
    const windowStart = new Date(incident.occurredAt.getTime() - this.options.logWindowBeforeMs)
    const windowEnd   = new Date(incident.occurredAt.getTime() + this.options.logWindowAfterMs)

    const context = await this.fetchContext(incident, windowStart, windowEnd)

    let lastAnalysis:      AnalysisOutput | null = null
    let lastJudgeScore     = 0
    let lastJudgeFeedback: string | null         = null

    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt++) {
      logger.info('RCA attempt started', { ...meta, attempt })

      const analysisResult = await this.analyser.analyse(incident, context, lastJudgeFeedback)
      if (!analysisResult.ok) {
        logger.warn('Analyser failed', { ...meta, attempt, error: analysisResult.error.message })
        continue
      }
      lastAnalysis = analysisResult.data

      const judgeResult = await this.judge.score(incident, lastAnalysis)
      if (!judgeResult.ok) {
        logger.warn('Judge failed', { ...meta, attempt, error: judgeResult.error.message })
        continue
      }

      lastJudgeScore    = judgeResult.data.judgeScore
      lastJudgeFeedback = judgeResult.data.judgeFeedback

      if (lastJudgeScore >= this.options.judgePassThreshold) {
        await this.repo.persistPassed({
          incidentId:      incident.id,
          rootCause:       lastAnalysis.rootCause,
          confidenceScore: lastAnalysis.confidenceScore,
          judgeScore:      lastJudgeScore,
          judgeFeedback:   lastJudgeFeedback,
          attempts:        attempt,
          logWindowStart:  windowStart,
          logWindowEnd:    windowEnd,
          fiveWhys:        lastAnalysis.fiveWhys,
          symptomDiagram:  lastAnalysis.symptomDiagram,
          actions:         lastAnalysis.remediationActions,
        })
        logger.info('RCA passed', { ...meta, attempt, judgeScore: lastJudgeScore })
        return
      }

      logger.warn('RCA below threshold', { ...meta, attempt, judgeScore: lastJudgeScore })
    }

    await this.repo.persistLowConfidence({
      incidentId:      incident.id,
      rootCause:       lastAnalysis?.rootCause ?? 'Analysis failed — LLM errors on all attempts',
      confidenceScore: lastAnalysis?.confidenceScore ?? 0,
      judgeScore:      lastJudgeScore,
      judgeFeedback:   lastJudgeFeedback,
      attempts:        this.options.maxAttempts,
      logWindowStart:  windowStart,
      logWindowEnd:    windowEnd,
      fiveWhys:        lastAnalysis?.fiveWhys,
      symptomDiagram:  lastAnalysis?.symptomDiagram,
    })

    logger.warn('RCA exhausted all attempts', { ...meta, finalJudgeScore: lastJudgeScore })
  }

  private async fetchContext(
    incident:    DomainIncident,
    windowStart: Date,
    windowEnd:   Date,
  ): Promise<RcaContext> {
    const logParams: LogFetchParams = {
      serviceName: incident.serviceName,
      namespace:   incident.namespace,
      podName:     incident.podName,
      windowStart,
      windowEnd,
    }
    const metricParams: MetricFetchParams = {
      serviceName: incident.serviceName,
      namespace:   incident.namespace,
      windowStart,
      windowEnd,
    }

    const [logsResult, metricsResult] = await Promise.all([
      this.logFetcher.fetch(logParams),
      this.metricsFetcher.fetch(metricParams),
    ])

    if (!logsResult.ok) {
      logger.warn('Log fetch failed, continuing without logs', {
        incidentId: incident.id,
        error:      logsResult.error.message,
      })
    }
    if (!metricsResult.ok) {
      logger.warn('Metrics fetch failed, continuing without metrics', {
        incidentId: incident.id,
        error:      metricsResult.error.message,
      })
    }

    const rawLogs  = logsResult.ok ? logsResult.data : []
    const sanitized = this.sanitizer.sanitize(rawLogs)
    const metrics   = metricsResult.ok ? metricsResult.data : undefined

    return { logs: sanitized, metrics }
  }
}
