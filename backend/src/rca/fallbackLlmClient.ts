import { logger } from '../shared/logger'
import { ILlmClient, LlmRequest, LlmResponse } from '../shared/llmClient'
import { Result } from '../shared/types'

export class FallbackLlmClient implements ILlmClient {
  constructor(
    private readonly primary:      ILlmClient,
    private readonly fallback:     ILlmClient,
    private readonly primaryName:  string,
    private readonly fallbackName: string,
  ) {}

  async complete(req: LlmRequest): Promise<Result<LlmResponse>> {
    const result = await this.primary.complete(req)
    if (result.ok) return result

    logger.warn('Primary LLM failed — trying fallback', {
      primary:  this.primaryName,
      fallback: this.fallbackName,
      error:    result.error.message,
    })

    return this.fallback.complete(req)
  }
}
