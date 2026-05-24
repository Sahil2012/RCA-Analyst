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

  server.listen(config.PORT, () => {
    logger.info('Health server listening', { port: config.PORT })
  })

  return server
}
