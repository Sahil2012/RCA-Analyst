import { $Enums, Incident, PrismaClient } from '@prisma/client'
import { DomainIncident, IIncidentRepository } from './incidentInterfaces'
import { IncidentEvent } from './incidentTypes'

export class PrismaIncidentRepository implements IIncidentRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(
    event:  IncidentEvent,
    status: $Enums.IncidentStatus = 'OPEN',
  ): Promise<DomainIncident> {
    const row = await this.db.incident.create({
      data: {
        serviceName:   event.serviceName,
        namespace:     event.namespace,
        podName:       event.podName,
        severity:      event.severity,
        type:          event.type,
        source:        event.source,
        occurrences:   event.occurrences,
        correlationId: event.correlationId,
        occurredAt:    new Date(event.occurredAt),
        status,
      },
    })
    return this.toDomain(row)
  }

  async findOpenDuplicate(
    serviceName: string,
    type:        $Enums.IncidentType,
    windowMs:    number,
  ): Promise<DomainIncident | null> {
    const row = await this.db.incident.findFirst({
      where: {
        serviceName,
        type,
        status:    'OPEN',
        createdAt: { gte: new Date(Date.now() - windowMs) },
      },
    })
    return row ? this.toDomain(row) : null
  }

  async countRecentDistinctServices(windowMs: number): Promise<number> {
    const groups = await this.db.incident.groupBy({
      by:    ['serviceName'],
      where: {
        status:    'OPEN',
        createdAt: { gte: new Date(Date.now() - windowMs) },
      },
    })
    return groups.length
  }

  async updateStatus(id: string, status: $Enums.IncidentStatus): Promise<void> {
    await this.db.incident.update({
      where: { id },
      data:  {
        status,
        resolvedAt: status === 'RESOLVED' ? new Date() : undefined,
      },
    })
  }

  private toDomain(row: Incident): DomainIncident {
    return {
      id:          row.id,
      serviceName: row.serviceName,
      namespace:   row.namespace,
      podName:     row.podName,
      severity:    row.severity,
      type:        row.type,
      status:      row.status,
      occurrences: row.occurrences,
      occurredAt:  row.occurredAt,
      createdAt:   row.createdAt,
      updatedAt:   row.updatedAt,
      resolvedAt:  row.resolvedAt,
    }
  }
}
