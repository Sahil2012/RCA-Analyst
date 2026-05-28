import { z } from 'zod'

// Type definitions for watcher service
export const AnomalyTypeSchema = z.enum([
  'HIGH_CPU',
  'HIGH_MEMORY',
  'HIGH_ERROR_RATE',
  'POD_CRASH',
  'POD_RESTART',
])

export type AnomalyType = z.infer<typeof AnomalyTypeSchema>

// Must match backend Prisma IncidentSource enum
export const IncidentSourceSchema = z.enum(['GCP_MONITORING', 'GCP_LOGGING', 'MANUAL'])
export type IncidentSource = z.infer<typeof IncidentSourceSchema>

export const SeveritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
export type Severity = z.infer<typeof SeveritySchema>

// Must match backend Prisma IncidentType enum — POD_RESTART is watcher-internal, published as POD_CRASH
export const IncidentTypeSchema = z.enum(['HIGH_CPU', 'HIGH_MEMORY', 'HIGH_ERROR_RATE', 'POD_CRASH', 'LATENCY_SPIKE'])
export type IncidentType = z.infer<typeof IncidentTypeSchema>

export const IncidentEventSchema = z.object({
  serviceName: z.string().min(1),
  namespace: z.string().min(1),
  podName: z.string().optional(),
  severity: SeveritySchema,
  type: IncidentTypeSchema,
  occurrences: z.number().int().positive(),
  source: IncidentSourceSchema.default('GCP_MONITORING'),
  correlationId: z.string().optional(),
  occurredAt: z.string().datetime(),
})

export type IncidentEvent = z.infer<typeof IncidentEventSchema>

export const AnomalySchema = z.object({
  service: z.string(),
  namespace: z.string(),
  pod: z.string(),
  type: AnomalyTypeSchema,
  value: z.number(),
  threshold: z.number(),
  timestamp: z.date(),
})

export type Anomaly = z.infer<typeof AnomalySchema>

export const PodStatusSchema = z.object({
  name: z.string(),
  namespace: z.string(),
  phase: z.enum(['Pending', 'Running', 'Succeeded', 'Failed', 'Unknown']),
  restartCount: z.number(),
  lastRestartTime: z.date().optional(),
  crashed: z.boolean(),
  service: z.string(),
})

export type PodStatus = z.infer<typeof PodStatusSchema>

// Incident rules configuration
export const IncidentRules = {
  HIGH_CPU: {
    threshold: 80,
    duration: 60000, // 1 minute in ms
    severity: 'HIGH' as const,
  },
  HIGH_MEMORY: {
    threshold: 85,
    duration: 60000,
    severity: 'HIGH' as const,
  },
  HIGH_ERROR_RATE: {
    threshold: 5, // errors per second
    duration: 30000, // 30 seconds
    severity: 'CRITICAL' as const,
  },
  POD_CRASH: {
    severity: 'CRITICAL' as const,
  },
  POD_RESTART: {
    threshold: 3, // restarts within duration
    duration: 300000, // 5 minutes
    severity: 'MEDIUM' as const,
  },
}

export const mapAnomalyToIncidentSource = (anomalyType: AnomalyType): IncidentSource => {
  switch (anomalyType) {
    case 'POD_CRASH':
    case 'POD_RESTART':
      return 'GCP_MONITORING' // K8s events surfaced via GCP Monitoring
    case 'HIGH_ERROR_RATE':
      return 'GCP_LOGGING'
    default:
      return 'GCP_MONITORING'
  }
}

// POD_RESTART is watcher-internal; publish as POD_CRASH to match backend IncidentType
export const mapAnomalyToIncidentType = (anomalyType: AnomalyType): IncidentType => {
  return anomalyType === 'POD_RESTART' ? 'POD_CRASH' : anomalyType
}

// Determine severity based on anomaly type and value
export const determineSeverity = (
  type: AnomalyType,
  value: number,
  threshold: number,
): Severity => {
  const ratio = value / threshold

  if (type === 'HIGH_ERROR_RATE' || type === 'POD_CRASH') {
    return 'CRITICAL'
  }

  if (ratio > 1.5) return 'CRITICAL'
  if (ratio > 1.2) return 'HIGH'
  if (ratio > 1.1) return 'MEDIUM'
  return 'LOW'
}
