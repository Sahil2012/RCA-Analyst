import { $Enums, PrismaClient } from '@prisma/client'
import { logger } from '../shared/logger'
import { IRcaRepository, PersistLowConfidenceParams, PersistPassedParams } from './rcaInterfaces'

export class PrismaRcaRepository implements IRcaRepository {
  constructor(private readonly db: PrismaClient) {}

  async persistPassed(params: PersistPassedParams): Promise<void> {
    logger.info('DB: persisting passed RCA analysis', {
      incidentId:  params.incidentId,
      actionCount: params.actions.length,
      judgeScore:  params.judgeScore,
    })

    await this.db.$transaction(async (tx) => {
      const analysis = await tx.incidentAnalysis.create({
        data: {
          incidentId:      params.incidentId,
          rootCause:       params.rootCause,
          confidenceScore: params.confidenceScore,
          judgeScore:      params.judgeScore,
          judgeFeedback:   params.judgeFeedback,
          attempts:        params.attempts,
          logWindowStart:  params.logWindowStart,
          logWindowEnd:    params.logWindowEnd,
          fiveWhys:        params.fiveWhys,
          symptomDiagram:  params.symptomDiagram,
          status:          $Enums.AnalysisStatus.PASSED,
        },
      })
      logger.info('DB: analysis record created', { incidentId: params.incidentId, analysisId: analysis.id, status: 'PASSED' })

      await tx.remediationAction.createMany({
        data: params.actions.map(action => ({
          analysisId:          analysis.id,
          actionTitle:         action.actionTitle,
          actionDescription:   action.actionDescription,
          actionType:          action.actionType,
          priority:            action.priority,
          confidenceScore:     action.confidenceScore,
          automationSupported: action.automationSupported,
          blastRadius:         action.blastRadius,
          downtimeRisk:        action.downtimeRisk,
          rollback:            action.rollback,
          confidenceLevel:     action.confidenceLevel,
        })),
      })
      logger.info('DB: remediation actions inserted', { incidentId: params.incidentId, analysisId: analysis.id, count: params.actions.length })

      await tx.incident.update({
        where: { id: params.incidentId },
        data:  { status: $Enums.IncidentStatus.INVESTIGATING },
      })
      logger.info('DB: incident status → INVESTIGATING', { incidentId: params.incidentId })
    })
  }

  async persistLowConfidence(params: PersistLowConfidenceParams): Promise<void> {
    logger.info('DB: persisting low confidence RCA analysis', {
      incidentId: params.incidentId,
      attempts:   params.attempts,
      judgeScore: params.judgeScore,
    })

    await this.db.$transaction(async (tx) => {
      await tx.incidentAnalysis.create({
        data: {
          incidentId:      params.incidentId,
          rootCause:       params.rootCause,
          confidenceScore: params.confidenceScore,
          judgeScore:      params.judgeScore,
          judgeFeedback:   params.judgeFeedback,
          attempts:        params.attempts,
          logWindowStart:  params.logWindowStart,
          logWindowEnd:    params.logWindowEnd,
          fiveWhys:        params.fiveWhys,
          symptomDiagram:  params.symptomDiagram,
          status:          $Enums.AnalysisStatus.LOW_CONFIDENCE,
        },
      })

      await tx.incident.update({
        where: { id: params.incidentId },
        data:  { status: $Enums.IncidentStatus.LOW_CONFIDENCE },
      })
      logger.info('DB: incident status → LOW_CONFIDENCE', { incidentId: params.incidentId })
    })
  }
}
