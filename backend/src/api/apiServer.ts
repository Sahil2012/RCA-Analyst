import express, { Express } from 'express'
import { PrismaClient } from '@prisma/client'
import swaggerUi from 'swagger-ui-express'
import { incidentRoutes } from './routes/incidents'
import { actionRoutes } from './routes/actions'
import { swaggerSpec } from './swaggerSpec'

export function createApiApp(db: PrismaClient): Express {
  const app = express()
  app.use(express.json())

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))
  app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec))

  app.use('/api/incidents', incidentRoutes(db))
  app.use('/api/actions',   actionRoutes(db))

  return app
}
