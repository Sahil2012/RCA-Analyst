import Anthropic from '@anthropic-ai/sdk'
import { Logging } from '@google-cloud/logging'
import { MetricServiceClient } from '@google-cloud/monitoring'
import { IAnalysisTrigger } from '../incidents/incidentInterfaces'
import { config, prisma } from '../shared'
import { AnthropicLlmClient } from './anthropicLlmClient'
import { GcpLogFetcher } from './rcaLogFetcher'
import { GcpMetricsFetcher } from './rcaMetricsFetcher'
import { RcaAnalyser } from './rcaAnalyser'
import { RcaJudge } from './rcaJudge'
import { PrismaRcaRepository } from './rcaRepository'
import { RcaSanitizer } from './rcaSanitizer'
import { RcaService, RcaServiceOptions } from './rcaService'

export function buildRcaService(): IAnalysisTrigger {
  const llm            = new AnthropicLlmClient(new Anthropic(), config.ANTHROPIC_MODEL, config.RCA_LLM_MAX_TOKENS)
  const logFetcher     = new GcpLogFetcher(new Logging({ projectId: config.GCP_PROJECT_ID }))
  const metricsFetcher = new GcpMetricsFetcher(new MetricServiceClient(), config.GCP_PROJECT_ID)
  const sanitizer      = new RcaSanitizer()
  const analyser       = new RcaAnalyser(llm)
  const judge          = new RcaJudge(llm)
  const repo           = new PrismaRcaRepository(prisma)

  const options: RcaServiceOptions = {
    maxAttempts:        config.RCA_MAX_ATTEMPTS,
    judgePassThreshold: config.RCA_JUDGE_THRESHOLD,
    logWindowBeforeMs:  config.RCA_LOG_WINDOW_BEFORE_MIN * 60 * 1000,
    logWindowAfterMs:   config.RCA_LOG_WINDOW_AFTER_MIN  * 60 * 1000,
  }

  return new RcaService(logFetcher, metricsFetcher, sanitizer, analyser, judge, repo, options)
}
