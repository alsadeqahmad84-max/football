import type { IncomingMessage, ServerResponse } from 'node:http'
import { footballHighlightsProxy } from './footballHighlights.ts'
import { apiFootballProxy, fplProxy, premierLeagueMatchProxy } from './footballApis.ts'
import { leagueCoachesProxy } from './leagueCoaches.ts'
import { leagueRankingsProxy } from './leagueRankings.ts'

type Middleware = (request: IncomingMessage, response: ServerResponse, next: (error?: unknown) => void) => unknown
type MiddlewarePlugin = { configureServer?: (server: unknown) => void }
type MountedMiddleware = { prefix: string; middleware: Middleware }

const mounted: MountedMiddleware[] = []
const mockViteServer = {
  middlewares: {
    use(prefix: string, middleware: Middleware) {
      mounted.push({ prefix, middleware })
    },
  },
}

const plugins: MiddlewarePlugin[] = [
  fplProxy(),
  premierLeagueMatchProxy(),
  apiFootballProxy(process.env.API_FOOTBALL_KEY || ''),
  footballHighlightsProxy(process.env.TAVILY_API_KEY || ''),
  leagueCoachesProxy(process.env.API_FOOTBALL_KEY || ''),
  leagueRankingsProxy(),
]

for (const plugin of plugins) plugin.configureServer?.(mockViteServer)
mounted.sort((left, right) => right.prefix.length - left.prefix.length)

export async function handleFootballApi(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const originalUrl = request.url || '/'
  const requestPath = new URL(originalUrl, 'http://localhost').pathname
  const route = mounted.find(({ prefix }) => requestPath === prefix || requestPath.startsWith(`${prefix}/`))

  response.setHeader('X-Content-Type-Options', 'nosniff')
  if (!route) {
    response.statusCode = 404
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.end(JSON.stringify({ error: 'API route not found.' }))
    return
  }

  const query = originalUrl.includes('?') ? originalUrl.slice(originalUrl.indexOf('?')) : ''
  request.url = `${requestPath.slice(route.prefix.length) || '/'}${query}`
  let continued = false
  try {
    await new Promise<void>((resolve, reject) => {
      const next = (error?: unknown) => {
        continued = true
        if (error) reject(error)
        else resolve()
      }
      Promise.resolve(route.middleware(request, response, next)).then(resolve, reject)
    })
    if (!response.writableEnded && continued) {
      response.statusCode = 404
      response.setHeader('Content-Type', 'application/json; charset=utf-8')
      response.end(JSON.stringify({ error: 'API route not found.' }))
    } else if (!response.writableEnded) {
      response.statusCode = 204
      response.end()
    }
  } catch {
    if (!response.headersSent) {
      response.statusCode = 502
      response.setHeader('Content-Type', 'application/json; charset=utf-8')
      response.end(JSON.stringify({ error: 'Football data is temporarily unavailable.' }))
    }
  } finally {
    request.url = originalUrl
  }
}
