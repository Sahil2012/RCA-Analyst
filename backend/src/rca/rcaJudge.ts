import { DomainIncident } from '../incidents/incidentInterfaces'
import { ILlmClient } from '../shared/llmClient'
import { Result, err, ok } from '../shared/types'
import { IRcaJudge } from './rcaInterfaces'
import { AnalysisOutput, JudgeOutput, JudgeOutputSchema } from './rcaTypes'

const TOOL_NAME = 'submit_judgement'

const TOOL_SCHEMA = {
  type: 'object',
  properties: {
    judgeScore: {
      type:        'number',
      description: 'Quality score of the analysis, 0.0 to 1.0. Score >= 0.7 means reliable enough to act on.',
    },
    judgeFeedback: {
      type:        'string',
      description: 'Specific, actionable feedback on what is good or lacking in the analysis.',
    },
  },
  required: ['judgeScore', 'judgeFeedback'],
} as const

export class RcaJudge implements IRcaJudge {
  constructor(private readonly llm: ILlmClient) {}

  async score(incident: DomainIncident, analysis: AnalysisOutput): Promise<Result<JudgeOutput>> {
    const result = await this.llm.complete({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt:   this.buildUserPrompt(incident, analysis),
      toolName:     TOOL_NAME,
      toolSchema:   TOOL_SCHEMA,
      runName:      'rca-judge',
    })

    if (!result.ok) return result

    const parsed = JudgeOutputSchema.safeParse(result.data.output)
    if (!parsed.success) {
      return err(new Error(`Invalid judge output: ${parsed.error.message}`))
    }
    return ok(parsed.data)
  }

  private buildUserPrompt(incident: DomainIncident, analysis: AnalysisOutput): string {
    const actions = analysis.remediationActions
      .map(a => `  [${a.priority}] ${a.actionTitle}: ${a.actionDescription} (auto: ${a.automationSupported})`)
      .join('\n')

    return [
      '## Incident',
      `Service: ${incident.serviceName}  Type: ${incident.type}  Severity: ${incident.severity}`,
      '',
      '## Analysis to Evaluate',
      `Root Cause: ${analysis.rootCause}`,
      `Confidence: ${analysis.confidenceScore}`,
      '',
      'Remediation Actions:',
      actions,
    ].join('\n')
  }
}

const SYSTEM_PROMPT = `You are an expert SRE evaluating the quality of an incident root cause analysis.
Score on: accuracy (does it match the evidence?), specificity (is it actionable?),
completeness (are all symptoms addressed?), and remediation quality (are actions appropriate?).
Be strict — a score >= 0.7 means this analysis is reliable enough to act on immediately.`
