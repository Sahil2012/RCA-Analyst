import { logger } from '../shared/logger'
import { Result, ok, err } from '../shared/types'
import {
  IAnalysisTrigger,
  IIncidentDedup,
  IIncidentFalsePositive,
  IIncidentRepository,
  IIncidentService,
  ProcessOutcome,
} from './incidentInterfaces'
import { IncidentEvent } from './incidentTypes'

export class IncidentService implements IIncidentService {
  constructor(
    private readonly dedup:              IIncidentDedup,
    private readonly falsePositive:      IIncidentFalsePositive,
    private readonly repo:               IIncidentRepository,
    private readonly analysisTrigger?:   IAnalysisTrigger,
  ) {}

  async process(event: IncidentEvent): Promise<Result<ProcessOutcome>> {
    const meta = { service: event.serviceName, type: event.type }

    try {
      // 1. Dedup — cheapest check first (memory → db)
      if (await this.dedup.isDuplicate(event)) {
        return ok('duplicate')
      }

      // 2. False positive — infra-wide spike detection
      if (await this.falsePositive.isInfraWideSpike()) {
        const incident = await this.repo.create(event, 'FALSE_POSITIVE')
        logger.warn('Incident marked false_positive', { ...meta, incidentId: incident.id })
        return ok('false_positive')
      }

      // 3. Persist as OPEN
      const incident = await this.repo.create(event)
      this.dedup.markSeen(event)
      this.analysisTrigger?.analyze(incident)
      logger.info('Incident created', { ...meta, incidentId: incident.id })

      return ok('created')
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e))
      logger.error('Failed to process incident', { ...meta, error: error.message })
      return err(error)
    }
  }
}
