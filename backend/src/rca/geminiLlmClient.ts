import { FunctionCallingMode, FunctionDeclarationSchema, GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import { traceable } from 'langsmith/traceable'
import { ILlmClient, LlmRequest, LlmResponse } from '../shared/llmClient'
import { Result, err, ok } from '../shared/types'

export class GeminiLlmClient implements ILlmClient {
  constructor(
    private readonly client:    GoogleGenerativeAI,
    private readonly model:     string,
    private readonly maxTokens: number,
  ) {}

  async complete(req: LlmRequest): Promise<Result<LlmResponse>> {
    try {
      const model = this.client.getGenerativeModel({
        model: this.model,
        systemInstruction: req.systemPrompt,
        tools: [{
          functionDeclarations: [{
            name:        req.toolName,
            description: `Submit the structured ${req.toolName} result`,
            parameters:  this.toGeminiSchema(req.toolSchema),
          }],
        }],
        generationConfig: {
          maxOutputTokens: this.maxTokens,
        },
      })

      const generateContent = traceable(
        (prompt: string) => model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.ANY } },
        }),
        { name: req.runName ?? 'gemini-complete', run_type: 'llm' },
      )

      const result = await generateContent(req.userPrompt)

      // Use SDK helper first, fall back to manual parts scan
      const calls  = result.response.functionCalls?.() ?? []
      const fnCall = calls[0]
        ?? result.response.candidates?.[0]?.content?.parts
            ?.find((p) => 'functionCall' in p && p.functionCall != null)
            ?.functionCall

      if (!fnCall) return err(new Error('No function call in Gemini response'))

      return ok({ output: fnCall.args })
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)))
    }
  }

  // Gemini schemas are OpenAPI 3.0-compatible — strip JSON Schema-only keys and uppercase type values
  private toGeminiSchema(schema: Record<string, unknown>): FunctionDeclarationSchema {
    const { $schema: _s, $defs: _d, definitions: _def, ...rest } = schema
    return this.mapNode(rest) as FunctionDeclarationSchema
  }

  private mapNode(node: unknown): unknown {
    if (typeof node !== 'object' || node === null) return node
    if (Array.isArray(node)) return node.map((i) => this.mapNode(i))

    const obj = node as Record<string, unknown>
    const out: Record<string, unknown> = {}

    for (const [k, v] of Object.entries(obj)) {
      if (k === 'type' && typeof v === 'string') {
        out[k] = v.toUpperCase() as SchemaType
      } else {
        out[k] = this.mapNode(v)
      }
    }
    return out
  }
}
