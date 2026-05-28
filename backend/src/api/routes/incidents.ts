import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { IAnalysisTrigger } from '../../incidents/incidentInterfaces'

export function incidentRoutes(db: PrismaClient, analysisTrigger?: IAnalysisTrigger): Router {
  const router = Router()

  router.get('/', async (req, res) => {
    try {
      const status = req.query.status as string | undefined
      const limit  = Math.min(Number(req.query.limit  ?? 20), 100)
      const offset = Number(req.query.offset ?? 0)

      const where = status ? { status: status as never } : {}

      const [rows, total] = await Promise.all([
        db.incident.findMany({
          where,
          orderBy: { occurredAt: 'desc' },
          take:    limit,
          skip:    offset,
          include: { _count: { select: { analyses: true } } },
        }),
        db.incident.count({ where }),
      ])

      res.json({
        incidents: rows.map(r => ({
          id:            r.id,
          serviceName:   r.serviceName,
          namespace:     r.namespace,
          severity:      r.severity,
          type:          r.type,
          status:        r.status,
          occurrences:   r.occurrences,
          occurredAt:    r.occurredAt,
          analysisCount: r._count.analyses,
        })),
        total,
      })
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
    }
  })

  router.get('/:id', async (req, res) => {
    try {
      const incident = await db.incident.findUnique({
        where:   { id: req.params.id },
        include: {
          analyses: {
            orderBy: { createdAt: 'desc' },
            take:    1,
            select:  { id: true, status: true, confidenceScore: true, judgeScore: true },
          },
        },
      })

      if (!incident) return res.status(404).json({ error: 'Incident not found' })

      res.json({
        id:             incident.id,
        serviceName:    incident.serviceName,
        namespace:      incident.namespace,
        podName:        incident.podName,
        severity:       incident.severity,
        type:           incident.type,
        status:         incident.status,
        occurrences:    incident.occurrences,
        source:         incident.source,
        correlationId:  incident.correlationId,
        occurredAt:     incident.occurredAt,
        resolvedAt:     incident.resolvedAt,
        createdAt:      incident.createdAt,
        latestAnalysis: incident.analyses[0] ?? null,
      })
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
    }
  })

  router.get('/:id/analysis', async (req, res) => {
    try {
      const analysis = await db.incidentAnalysis.findFirst({
        where:   { incidentId: req.params.id },
        orderBy: { createdAt: 'desc' },
        include: { actions: { orderBy: { priority: 'asc' } } },
      })

      if (!analysis) return res.status(404).json({ error: 'Analysis not found' })

      res.json({
        id:             analysis.id,
        incidentId:     analysis.incidentId,
        rootCause:      analysis.rootCause,
        confidenceScore: analysis.confidenceScore,
        judgeScore:     analysis.judgeScore,
        judgeFeedback:  analysis.judgeFeedback,
        fiveWhys:       analysis.fiveWhys,
        symptomDiagram: analysis.symptomDiagram,
        attempts:       analysis.attempts,
        status:         analysis.status,
        logWindowStart: analysis.logWindowStart,
        logWindowEnd:   analysis.logWindowEnd,
        createdAt:      analysis.createdAt,
        actions:        analysis.actions.map(a => ({
          id:                  a.id,
          actionTitle:         a.actionTitle,
          actionDescription:   a.actionDescription,
          actionType:          a.actionType,
          priority:            a.priority,
          confidenceScore:     a.confidenceScore,
          confidenceLevel:     a.confidenceLevel,
          automationSupported: a.automationSupported,
          blastRadius:         a.blastRadius,
          downtimeRisk:        a.downtimeRisk,
          rollback:            a.rollback,
          executionStatus:     a.executionStatus,
          executedAt:          a.executedAt,
        })),
      })
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
    }
  })

  router.post('/:id/analyze', async (req, res) => {
    try {
      if (!analysisTrigger) {
        return res.status(503).json({ error: 'Analysis trigger not available' })
      }

      const incident = await db.incident.findUnique({ where: { id: req.params.id } })
      if (!incident) return res.status(404).json({ error: 'Incident not found' })

      analysisTrigger.analyze({
        id:          incident.id,
        serviceName: incident.serviceName,
        namespace:   incident.namespace,
        podName:     incident.podName,
        severity:    incident.severity,
        type:        incident.type,
        status:      incident.status,
        occurrences: incident.occurrences,
        occurredAt:  incident.occurredAt,
        createdAt:   incident.createdAt,
        updatedAt:   incident.updatedAt,
        resolvedAt:  incident.resolvedAt,
      })

      res.json({ queued: true })
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
    }
  })

  return router
}
