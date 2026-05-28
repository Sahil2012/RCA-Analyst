import { $Enums } from '@prisma/client'
import { z } from 'zod'

// Derive directly from Prisma enums — adding a value to the schema
// automatically validates here without any manual sync.
export const IncidentEventSchema = z.object({
  serviceName:   z.string().min(1),
  namespace:     z.string().min(1),
  podName:       z.string().optional(),
  severity:      z.nativeEnum($Enums.Severity),
  // Normalise legacy/external type values that predate the current enum
  type: z.preprocess((val) => {
    const legacyMap: Record<string, string> = {
      RESOURCE_ANOMALY: 'HIGH_CPU',
      CPU_THROTTLING:   'HIGH_CPU',
      MEMORY_PRESSURE:  'HIGH_MEMORY',
      ERROR_SPIKE:      'HIGH_ERROR_RATE',
      POD_RESTART:      'POD_CRASH',
    }
    return typeof val === 'string' ? (legacyMap[val] ?? val) : val
  }, z.nativeEnum($Enums.IncidentType)),
  occurrences:   z.number().int().positive(),
  source:        z.nativeEnum($Enums.IncidentSource).default($Enums.IncidentSource.GCP_MONITORING),
  correlationId: z.string().optional(),
  occurredAt:    z.string().datetime(),
})

export type IncidentEvent = z.infer<typeof IncidentEventSchema>
