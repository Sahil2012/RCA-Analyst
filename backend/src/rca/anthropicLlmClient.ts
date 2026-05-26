import Anthropic from '@anthropic-ai/sdk'
import { traceable } from 'langsmith/traceable'
import { ILlmClient, LlmRequest, LlmResponse } from '../shared/llmClient'
import { Result, err, ok } from '../shared/types'

export class AnthropicLlmClient implements ILlmClient {
  constructor(
    private readonly client:    Anthropic,
    private readonly model:     string,
    private readonly maxTokens: number,
  ) {}

  async complete(req: LlmRequest): Promise<Result<LlmResponse>> {
    try {
      const createMessage = traceable(
        (params: Anthropic.MessageCreateParamsNonStreaming) =>
          this.client.messages.create(params) as Promise<Anthropic.Message>,
        { name: req.runName ?? 'anthropic-complete', run_type: 'llm' },
      )

      const response = await createMessage({
        model:      this.model,
        max_tokens: this.maxTokens,
        system:     req.systemPrompt,
        tools: [{
          name:         req.toolName,
          description:  `Submit the structured ${req.toolName} result`,
          input_schema: req.toolSchema as Anthropic.Tool['input_schema'],
        }],
        tool_choice: { type: 'tool', name: req.toolName },
        messages:    [{ role: 'user', content: req.userPrompt }],
      })

      const toolUse = response.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      )
      if (!toolUse) return err(new Error('No tool_use block in Anthropic response'))

      return ok({ output: toolUse.input })
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)))
    }
  }
}
