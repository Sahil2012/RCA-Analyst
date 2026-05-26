import { Result } from './types'

export type LlmRequest = {
  systemPrompt: string
  userPrompt:   string
  toolName:     string
  toolSchema:   Record<string, unknown>
  runName?:     string
}

export type LlmResponse = {
  output: unknown
}

export interface ILlmClient {
  complete(req: LlmRequest): Promise<Result<LlmResponse>>
}
