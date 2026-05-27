import { createServer, Server } from 'node:http'
import { PrismaClient } from '@prisma/client'
import { logger } from '../shared/logger'
import { createApiApp } from './apiServer'

export function startApiServer(db: PrismaClient, port: number): Server {
  const server = createServer(createApiApp(db))

  server.listen(port, () => {
    logger.info('API server listening', { port })
  })

  return server
}
