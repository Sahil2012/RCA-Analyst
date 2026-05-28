import { createServer, Server } from 'node:http'
import { config } from './config'
import { logger } from './logger'

export function startHealthServer(): Server {
  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok' }))
      return
    }
    res.writeHead(404)
    res.end()
  })

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(
        `Port ${config.PORT} is already in use — a previous backend process may still be running. ` +
        `Run: lsof -ti :${config.PORT} | xargs kill -9`,
        { port: config.PORT },
      )
      process.exit(1)
    }
    throw err
  })

  server.listen(config.PORT, () => {
    logger.info('Health server listening', { port: config.PORT })
  })

  return server
}
