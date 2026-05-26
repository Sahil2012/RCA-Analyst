import { $Enums } from '@prisma/client'
import { z } from 'zod'

export const RawLogSchema = z.object({
  timestamp: z.string(),
  severity:  z.string(),
  message:   z.string().min(1),
})

export type RawLog = z.infer<typeof RawLogSchema>

export const MetricSummarySchema = z.object({
  cpuMax:     z.number().optional(),
  cpuMean:    z.number().optional(),
  memoryMax:  z.number().optional(),
  memoryMean: z.number().optional(),
})

export type MetricSummary = z.infer<typeof MetricSummarySchema>

export const SanitizedLogEntrySchema = z.object({
  severity:  z.string(),
  message:   z.string(),
  count:     z.number().int().positive(),
  timestamp: z.string(),
})

export const SanitizedLogsSchema = z.object({
  entries:       z.array(SanitizedLogEntrySchema),
  totalDropped:  z.number().int().min(0),
  tokenEstimate: z.number().int().min(0),
})

export type SanitizedLogs     = z.infer<typeof SanitizedLogsSchema>
export type SanitizedLogEntry = z.infer<typeof SanitizedLogEntrySchema>

export const RcaContextSchema = z.object({
  logs:    SanitizedLogsSchema,
  metrics: MetricSummarySchema.optional(),
})

export type RcaContext = z.infer<typeof RcaContextSchema>

export const RemediationActionInputSchema = z.object({
  actionTitle:         z.string().min(1),
  actionDescription:   z.string().min(1),
  actionType:          z.nativeEnum($Enums.ActionType),
  priority:            z.nativeEnum($Enums.ActionPriority),
  confidenceScore:     z.number().min(0).max(1),
  automationSupported: z.boolean(),
  blastRadius:         z.string().min(1),
  downtimeRisk:        z.string().min(1),
  rollback:            z.string().min(1),
  confidenceLevel:     z.enum(['HIGH', 'MEDIUM', 'LOW']),
})

export type RemediationActionInput = z.infer<typeof RemediationActionInputSchema>

export const FiveWhySchema = z.object({
  question: z.string().min(1),
  answer:   z.string().min(1),
})

export const AnalysisOutputSchema = z.object({
  rootCause:          z.string().min(1),
  confidenceScore:    z.number().min(0).max(1),
  fiveWhys:           z.array(FiveWhySchema).min(1),
  symptomDiagram:     z.string().min(1),
  remediationActions: z.array(RemediationActionInputSchema).min(1),
})

export type AnalysisOutput = z.infer<typeof AnalysisOutputSchema>

export const JudgeOutputSchema = z.object({
  judgeScore:    z.number().min(0).max(1),
  judgeFeedback: z.string().min(1),
})

export type JudgeOutput = z.infer<typeof JudgeOutputSchema>
