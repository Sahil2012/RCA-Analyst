import { $Enums } from '@prisma/client'
import { z } from 'zod'

// Derive directly from Prisma enums — adding a value to the schema
// automatically validates here without any manual sync.
export const IncidentEventSchema = z.object({
  serviceName:   z.string().min(1),
  namespace:     z.string().min(1),
  podName:       z.string().optional(),
  severity:      z.nativeEnum($Enums.Severity),
  type:          z.nativeEnum($Enums.IncidentType),
  occurrences:   z.number().int().positive(),
  source:        z.nativeEnum($Enums.IncidentSource).default($Enums.IncidentSource.GCP_MONITORING),
  correlationId: z.string().optional(),
  occurredAt:    z.string().datetime(),
})

export type IncidentEvent = z.infer<typeof IncidentEventSchema>
