import { logger } from '../shared/logger'
import { IIncidentFalsePositive, IIncidentRepository } from './incidentInterfaces'

const INFRA_WINDOW_MS = 60_000
// 2+ other services spiking simultaneously → infra-wide event, not service-specific
const INFRA_THRESHOLD = 2

export class IncidentFalsePositive implements IIncidentFalsePositive {
  constructor(private readonly repo: IIncidentRepository) {}

  async isInfraWideSpike(): Promise<boolean> {
    const count = await this.repo.countRecentDistinctServices(INFRA_WINDOW_MS)
    if (count >= INFRA_THRESHOLD) {
      logger.warn('Infra-wide spike detected', { distinctServices: count })
      return true
    }
    return false
  }
}
