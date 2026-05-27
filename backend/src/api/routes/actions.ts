import { Router } from 'express'
import { PrismaClient, $Enums } from '@prisma/client'

const VALID_EXECUTION_STATUSES = new Set(Object.values($Enums.ExecutionStatus))

export function actionRoutes(db: PrismaClient): Router {
  const router = Router()

  router.get('/', async (req, res) => {
    try {
      const executionStatus = req.query.executionStatus as string | undefined
      const limit           = Math.min(Number(req.query.limit ?? 20), 100)

      const where = executionStatus ? { executionStatus: executionStatus as never } : {}

      const actions = await db.remediationAction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take:    limit,
        include: {
          analysis: {
            select: {
              incidentId: true,
              incident:   { select: { serviceName: true, namespace: true, severity: true, type: true } },
            },
          },
        },
      })

      res.json({
        actions: actions.map(a => ({
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
          analysis:            a.analysis,
        })),
      })
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
    }
  })

  router.patch('/:id/status', async (req, res) => {
    try {
      const { executionStatus } = req.body as { executionStatus: string }

      if (!executionStatus || !VALID_EXECUTION_STATUSES.has(executionStatus as never)) {
        return res.status(400).json({
          error: `executionStatus must be one of: ${[...VALID_EXECUTION_STATUSES].join(', ')}`,
        })
      }

      const action = await db.remediationAction.findUnique({ where: { id: req.params.id } })
      if (!action) return res.status(404).json({ error: 'Action not found' })

      const updated = await db.remediationAction.update({
        where: { id: req.params.id },
        data:  {
          executionStatus: executionStatus as never,
          executedAt:      executionStatus === $Enums.ExecutionStatus.EXECUTED ? new Date() : undefined,
        },
        select: { id: true, executionStatus: true, executedAt: true },
      })

      res.json(updated)
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
    }
  })

  return router
}
