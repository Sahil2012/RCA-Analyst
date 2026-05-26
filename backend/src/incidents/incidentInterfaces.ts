import { $Enums } from '@prisma/client'
import { Result } from '../shared/types'
import { IncidentEvent } from './incidentTypes'

// ─── Domain entity ────────────────────────────────────────────────────────────
// Own type — no Prisma model coupling. Swap the DB and this stays stable.

export type DomainIncident = {
  id:           string
  serviceName:  string
  namespace:    string
  podName?:     string | null
  severity:     $Enums.Severity
  type:         $Enums.IncidentType
  status:       $Enums.IncidentStatus
  occurrences:  number
  occurredAt:   Date
  createdAt:    Date
  updatedAt:    Date
  resolvedAt?:  Date | null
}

// ─── Repository ───────────────────────────────────────────────────────────────

export interface IIncidentRepository {
  create(event: IncidentEvent, status?: $Enums.IncidentStatus): Promise<DomainIncident>
  findOpenDuplicate(serviceName: string, type: $Enums.IncidentType, windowMs: number): Promise<DomainIncident | null>
  countRecentDistinctServices(windowMs: number): Promise<number>
  updateStatus(id: string, status: $Enums.IncidentStatus): Promise<void>
}

// ─── Domain services ──────────────────────────────────────────────────────────

export interface IIncidentDedup {
  isDuplicate(event: IncidentEvent): Promise<boolean>
  markSeen(event: IncidentEvent): void
}

export interface IIncidentFalsePositive {
  isInfraWideSpike(): Promise<boolean>
}

export type ProcessOutcome = 'duplicate' | 'false_positive' | 'created'

export interface IIncidentService {
  process(event: IncidentEvent): Promise<Result<ProcessOutcome>>
}

export interface IAnalysisTrigger {
  analyze(incident: DomainIncident): void
}
