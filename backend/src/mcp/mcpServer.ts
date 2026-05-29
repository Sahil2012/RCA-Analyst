import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { Server } from 'node:http'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod/v3'
import { logger } from '../shared/logger'

export function startMcpServer(db: PrismaClient, port: number): Server {
  const mcp = new McpServer({
    name:    'rca-analyst',
    version: '1.0.0',
  })

  // ── Tool: list_incidents ──────────────────────────────────────────────────

  mcp.registerTool(
    'list_incidents',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    {
      description: 'List recent incidents. Optionally filter by status (OPEN, INVESTIGATING, RESOLVED, FALSE_POSITIVE, LOW_CONFIDENCE) and limit (1-50, default 10).',
      inputSchema: {
        status: z.string(),
        limit:  z.number(),
      },
    } as any,
    async (args: Record<string, unknown>) => {
      const limit  = Math.min(Math.max(Number(args['limit']) || 10, 1), 50)
      const status = (args['status'] as string) || undefined
      logger.info('MCP: list_incidents called', { status: status ?? 'ALL', limit })

      const incidents = await db.incident.findMany({
        where:   status ? { status: status as never } : undefined,
        orderBy: { occurredAt: 'desc' },
        take:    limit,
        select: {
          id:          true,
          serviceName: true,
          namespace:   true,
          type:        true,
          severity:    true,
          status:      true,
          occurredAt:  true,
          _count:      { select: { analyses: true } },
        },
      })

      const rows = incidents.map(i =>
        `[${i.id}] ${i.serviceName}/${i.namespace} | ${i.type} | ${i.severity} | ${i.status} | ${i.occurredAt.toISOString()} | analyses: ${i._count.analyses}`,
      )

      return {
        content: [{
          type: 'text' as const,
          text: rows.length > 0
            ? `Found ${rows.length} incident(s):\n\n${rows.join('\n')}`
            : 'No incidents found.',
        }],
      }
    },
  )

  // ── Tool: get_incident_analysis ───────────────────────────────────────────

  mcp.registerTool(
    'get_incident_analysis',
    {
      description: 'Get the full root cause analysis and remediation actions for a specific incident by its ID.',
      inputSchema: {
        incidentId: z.string(),
      },
    } as any,
    async (args: Record<string, unknown>) => {
      const incidentId = args['incidentId'] as string
      logger.info('MCP: get_incident_analysis called', { incidentId })

      const incident = await db.incident.findUnique({
        where:   { id: incidentId },
        include: {
          analyses: {
            orderBy: { createdAt: 'desc' },
            take:    1,
            include: { actions: { orderBy: { priority: 'asc' } } },
          },
        },
      })

      if (!incident) {
        return { content: [{ type: 'text' as const, text: `No incident found with id: ${incidentId}` }] }
      }

      const analysis = incident.analyses[0]
      if (!analysis) {
        return {
          content: [{
            type: 'text' as const,
            text: `Incident ${incidentId} (${incident.serviceName} | ${incident.status}) has no analysis yet.`,
          }],
        }
      }

      const actionLines = analysis.actions.map(a =>
        `  [${a.priority}] ${a.actionTitle}: ${a.actionDescription} (auto: ${a.automationSupported}, confidence: ${a.confidenceScore.toFixed(2)})`,
      )

      const text = [
        `## Incident: ${incident.serviceName} / ${incident.namespace}`,
        `Type: ${incident.type}  Severity: ${incident.severity}  Status: ${incident.status}`,
        `Occurred: ${incident.occurredAt.toISOString()}`,
        '',
        `## Root Cause Analysis (${analysis.status} — ${analysis.attempts} attempt(s))`,
        `Root Cause: ${analysis.rootCause}`,
        `Confidence: ${analysis.confidenceScore.toFixed(2)}  Judge Score: ${analysis.judgeScore.toFixed(2)}`,
        analysis.judgeFeedback ? `Judge Feedback: ${analysis.judgeFeedback}` : '',
        '',
        `## Remediation Actions (${analysis.actions.length})`,
        ...actionLines,
      ].filter(Boolean).join('\n')

      return { content: [{ type: 'text' as const, text }] }
    },
  )

  // ── Tool: list_remediation_actions ────────────────────────────────────────

  mcp.registerTool(
    'list_remediation_actions',
    {
      description: 'List remediation actions by execution status (PENDING, EXECUTED, FAILED, SKIPPED — default PENDING), ordered by priority.',
      inputSchema: {
        executionStatus: z.string(),
        limit:           z.number(),
      },
    } as any,
    async (args: Record<string, unknown>) => {
      const status = ((args['executionStatus'] as string) || 'PENDING') as never
      const limit  = Math.min(Math.max(Number(args['limit']) || 20, 1), 50)
      logger.info('MCP: list_remediation_actions called', { executionStatus: status, limit })

      const actions = await db.remediationAction.findMany({
        where:   { executionStatus: status },
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
        take:    limit,
        include: {
          analysis: {
            select: {
              incidentId: true,
              incident:   { select: { serviceName: true, namespace: true } },
            },
          },
        },
      })

      if (actions.length === 0) {
        return { content: [{ type: 'text' as const, text: `No ${(args['executionStatus'] as string) ?? 'PENDING'} remediation actions found.` }] }
      }

      const rows = actions.map(a =>
        `[${a.priority}] ${a.analysis.incident.serviceName}/${a.analysis.incident.namespace} — ${a.actionTitle}: ${a.actionDescription} (auto: ${a.automationSupported})`,
      )

      return {
        content: [{
          type: 'text' as const,
          text: `${actions.length} action(s):\n\n${rows.join('\n')}`,
        }],
      }
    },
  )

  // ── Tool: get_service_health ──────────────────────────────────────────────

  mcp.registerTool(
    'get_service_health',
    {
      description: 'Get a health summary for a specific service — incident history, current status, and open issues. limitDays defaults to 7.',
      inputSchema: {
        serviceName: z.string(),
        limitDays:   z.number(),
      },
    } as any,
    async (args: Record<string, unknown>) => {
      const serviceName = args['serviceName'] as string
      const days        = Math.min(Math.max(Number(args['limitDays']) || 7, 1), 30)
      logger.info('MCP: get_service_health called', { serviceName, limitDays: days })

      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

      const incidents = await db.incident.findMany({
        where:   { serviceName, occurredAt: { gte: since } },
        orderBy: { occurredAt: 'desc' },
        include: {
          analyses: {
            take:    1,
            orderBy: { createdAt: 'desc' },
            select:  { status: true, rootCause: true, confidenceScore: true },
          },
        },
      })

      if (incidents.length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: `No incidents for "${serviceName}" in the last ${days} days. Service appears healthy.`,
          }],
        }
      }

      const open  = incidents.filter(i => i.status === 'OPEN').length
      const lines = incidents.map(i => {
        const rca     = i.analyses[0]
        const rcaLine = rca ? ` → ${rca.rootCause.slice(0, 80)}` : ' → No RCA yet'
        return `  ${i.occurredAt.toISOString().slice(0, 16)} | ${i.type} | ${i.severity} | ${i.status}${rcaLine}`
      })

      return {
        content: [{
          type: 'text' as const,
          text: [
            `## Service Health: ${serviceName} (last ${days} days)`,
            `Total incidents: ${incidents.length}  Open: ${open}`,
            '',
            ...lines,
          ].join('\n'),
        }],
      }
    },
  )

  // ── Wire transport and start ──────────────────────────────────────────────

  const app       = createMcpExpressApp({ host: '0.0.0.0' })
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })

  app.all('/mcp', async (req, res) => {
    await transport.handleRequest(req, res, req.body)
  })

  mcp.connect(transport).catch(e => {
    logger.error('MCP server connect error', { error: e instanceof Error ? e.message : String(e) })
  })

  const server = app.listen(port, () => {
    logger.info('MCP server listening', { port, endpoint: `http://0.0.0.0:${port}/mcp` })
  })

  server.on('error', e => {
    logger.error('MCP server error', { error: e.message })
  })

  return server
}
