import { createServer, Server } from 'node:http'
import { PrismaClient } from '@prisma/client'
import { IAnalysisTrigger } from '../incidents/incidentInterfaces'
import { logger } from '../shared/logger'
import { createApiApp } from './apiServer'

export function startApiServer(db: PrismaClient, port: number, analysisTrigger?: IAnalysisTrigger): Server {
  const server = createServer(createApiApp(db, analysisTrigger))

  server.listen(port, () => {
    logger.info('API server listening', { port })
  })

  return server
}
