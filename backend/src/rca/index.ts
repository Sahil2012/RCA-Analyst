import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { Logging } from '@google-cloud/logging'
import { MetricServiceClient } from '@google-cloud/monitoring'
import { IAnalysisTrigger } from '../incidents/incidentInterfaces'
import { ILlmClient } from '../shared/llmClient'
import { config, logger, prisma } from '../shared'
import { AnthropicLlmClient } from './anthropicLlmClient'
import { FallbackLlmClient } from './fallbackLlmClient'
import { GeminiLlmClient } from './geminiLlmClient'
import { GcpLogFetcher } from './rcaLogFetcher'
import { GcpMetricsFetcher } from './rcaMetricsFetcher'
import { RcaAnalyser } from './rcaAnalyser'
import { RcaJudge } from './rcaJudge'
import { PrismaRcaRepository } from './rcaRepository'
import { RcaSanitizer } from './rcaSanitizer'
import { RcaService, RcaServiceOptions } from './rcaService'

function buildLlmClient(): ILlmClient {
  const anthropic = config.ANTHROPIC_API_KEY
    ? new AnthropicLlmClient(new Anthropic({ apiKey: config.ANTHROPIC_API_KEY }), config.ANTHROPIC_MODEL, config.RCA_LLM_MAX_TOKENS)
    : null

  const gemini = config.GEMINI_API_KEY
    ? new GeminiLlmClient(new GoogleGenerativeAI(config.GEMINI_API_KEY), config.GEMINI_MODEL, config.RCA_LLM_MAX_TOKENS)
    : null

  const primary  = config.LLM_PROVIDER === 'gemini' ? gemini   : anthropic
  const fallback = config.LLM_PROVIDER === 'gemini' ? anthropic : gemini

  if (!primary) throw new Error(`${config.LLM_PROVIDER.toUpperCase()}_API_KEY is required`)

  if (fallback) {
    const primaryName  = config.LLM_PROVIDER
    const fallbackName = config.LLM_PROVIDER === 'gemini' ? 'anthropic' : 'gemini'
    logger.info('LLM fleet active', { primary: primaryName, fallback: fallbackName })
    return new FallbackLlmClient(primary, fallback, primaryName, fallbackName)
  }

  logger.info('LLM single provider (no fallback configured)', { provider: config.LLM_PROVIDER })
  return primary
}

export function buildRcaService(): IAnalysisTrigger {
  const llm            = buildLlmClient()
  const logFetcher     = new GcpLogFetcher(new Logging({ projectId: config.GCP_PROJECT_ID }))
  const metricsFetcher = new GcpMetricsFetcher(new MetricServiceClient(), config.GCP_PROJECT_ID)
  const sanitizer      = new RcaSanitizer({ tokenBudget: config.RCA_LOG_TOKEN_BUDGET, maxMessageChars: config.RCA_LOG_MAX_MESSAGE_CHARS })
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
