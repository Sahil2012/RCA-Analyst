import { DomainIncident } from '../incidents/incidentInterfaces'
import { ILlmClient } from '../shared/llmClient'
import { Result, err, ok } from '../shared/types'
import { IRcaAnalyser } from './rcaInterfaces'
import { AnalysisOutput, AnalysisOutputSchema, RcaContext } from './rcaTypes'

const TOOL_NAME = 'submit_analysis'

const TOOL_SCHEMA = {
  type: 'object',
  properties: {
    rootCause: {
      type:        'string',
      description: 'The identified root cause of the incident',
    },
    confidenceScore: {
      type:        'number',
      description: 'Confidence in the analysis, 0.0 to 1.0',
    },
    fiveWhys: {
      type:        'array',
      description: '5-Whys analysis drilling from observable symptom to systemic root cause. Exactly 5 items.',
      minItems:    5,
      maxItems:    5,
      items: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'The "Why" question at this level' },
          answer:   { type: 'string', description: 'Evidence-based answer from logs/metrics' },
        },
        required: ['question', 'answer'],
      },
    },
    symptomDiagram: {
      type:        'string',
      description: 'Mermaid flowchart (graph TD) tracing root cause → intermediate causes → observable symptoms',
    },
    remediationActions: {
      type:     'array',
      minItems: 1,
      items: {
        type: 'object',
        properties: {
          actionTitle:         { type: 'string' },
          actionDescription:   { type: 'string' },
          actionType:          { type: 'string', enum: ['RESTART_SERVICE', 'SCALE_UP', 'ROLLBACK', 'INCREASE_MEMORY', 'INCREASE_REPLICAS', 'OTHER'] },
          priority:            { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
          confidenceScore:     { type: 'number' },
          automationSupported: { type: 'boolean' },
          blastRadius:         { type: 'string', description: 'Who/what is affected when this action is applied' },
          downtimeRisk:        { type: 'string', description: 'Expected downtime or disruption during remediation' },
          rollback:            { type: 'string', description: 'How to undo this action if it causes issues' },
          confidenceLevel:     { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
        },
        required: ['actionTitle', 'actionDescription', 'actionType', 'priority', 'confidenceScore', 'automationSupported', 'blastRadius', 'downtimeRisk', 'rollback', 'confidenceLevel'],
      },
    },
  },
  required: ['rootCause', 'confidenceScore', 'fiveWhys', 'symptomDiagram', 'remediationActions'],
} as const

export class RcaAnalyser implements IRcaAnalyser {
  constructor(private readonly llm: ILlmClient) {}

  async analyse(incident: DomainIncident, context: RcaContext, priorFeedback?: string | null): Promise<Result<AnalysisOutput>> {
    const result = await this.llm.complete({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt:   this.buildUserPrompt(incident, context, priorFeedback),
      toolName:     TOOL_NAME,
      toolSchema:   TOOL_SCHEMA,
      runName:      'rca-analyser',
    })

    if (!result.ok) return result

    const parsed = AnalysisOutputSchema.safeParse(result.data.output)
    if (!parsed.success) {
      return err(new Error(`Invalid analysis output: ${parsed.error.message}`))
    }
    return ok(parsed.data)
  }

  private buildUserPrompt(incident: DomainIncident, context: RcaContext, priorFeedback?: string | null): string {
    const logLines = context.logs.entries
      .map(e => `[${e.severity}] (x${e.count}) ${e.message}`)
      .join('\n')

    const metricsLines = context.metrics
      ? [
          `CPU:    max=${context.metrics.cpuMax?.toFixed(3) ?? 'N/A'}  mean=${context.metrics.cpuMean?.toFixed(3) ?? 'N/A'}`,
          `Memory: max=${context.metrics.memoryMax?.toFixed(0) ?? 'N/A'}B  mean=${context.metrics.memoryMean?.toFixed(0) ?? 'N/A'}B`,
        ].join('\n')
      : 'Metrics unavailable'

    const podLine    = incident.podName ? `  Pod: ${incident.podName}` : ''
    const feedbackSection = priorFeedback
      ? `\n## Previous Attempt Feedback (address these issues)\n${priorFeedback}`
      : ''

    return [
      '## Incident',
      `Service: ${incident.serviceName}  Namespace: ${incident.namespace}${podLine}`,
      `Type: ${incident.type}  Severity: ${incident.severity}`,
      `Occurred: ${incident.occurredAt.toISOString()}`,
      '',
      `## Logs (${context.logs.entries.length} unique messages, ${context.logs.totalDropped} dropped)`,
      logLines || 'No logs available',
      '',
      '## Metrics',
      metricsLines,
      feedbackSection,
    ].join('\n')
  }
}

const SYSTEM_PROMPT = `You are a senior SRE with deep expertise in Kubernetes, GCP, and distributed systems.
Analyse the provided incident, logs, and metrics to identify the root cause and recommend remediation actions.
Be precise, technical, and actionable. Base your analysis strictly on the provided evidence.

Perform a 5-Whys analysis with exactly 5 levels, drilling from the observable symptom down to the systemic root cause.
Produce a Mermaid flowchart (graph TD) tracing the root cause through intermediate causes to observable symptoms — keep it to 4-6 nodes. Node labels must use plain text only: no parentheses, no slashes, no tildes, no special characters — these break Mermaid's parser. Color-code using classDef: define "classDef root fill:#7c2d12,stroke:#f97316,color:#fed7aa" and "classDef leaf fill:#14532d,stroke:#22c55e,color:#bbf7d0", apply :::root to the root-cause node and :::leaf to the final symptom node.
For each remediation action provide: blast radius (who/what is affected), downtime risk (expected disruption), and rollback procedure (how to undo).`
