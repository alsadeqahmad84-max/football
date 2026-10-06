import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { footballHighlightsProxy } from './server/footballHighlights.ts'
import { leagueRankingsProxy } from './server/leagueRankings.ts'
import { leagueCoachesProxy } from './server/leagueCoaches.ts'
import { apiFootballProxy, fplProxy, premierLeagueMatchProxy } from './server/footballApis.ts'

function tavilyProxy(apiKey: string) {
  const requests = new Map<string, number[]>()
  const middleware = async (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => {
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.setHeader('Allow', 'POST')
      res.end(JSON.stringify({ error: 'Use POST to search.' }))
      return
    }
    const origin = req.headers.origin
    if (origin && req.headers.host && new URL(origin).host !== req.headers.host) {
      res.statusCode = 403
      res.end(JSON.stringify({ error: 'Cross-origin requests are not allowed.' }))
      return
    }
    const now = Date.now()
    const ip = req.socket.remoteAddress || 'local'
    const recent = (requests.get(ip) || []).filter((time) => now - time < 60_000)
    if (recent.length >= 12) {
      res.statusCode = 429
      res.end(JSON.stringify({ error: 'Search limit reached. Please wait a minute and try again.' }))
      return
    }
    recent.push(now)
    requests.set(ip, recent)

    let body = ''
    try {
      for await (const chunk of req) {
        body += chunk.toString()
        if (body.length > 4096) {
          res.statusCode = 413
          res.end(JSON.stringify({ error: 'Search request is too large.' }))
          return
        }
      }
      const payload = JSON.parse(body) as { query?: unknown }
      const query = typeof payload.query === 'string' ? payload.query.trim() : ''
      if (query.length < 3 || query.length > 200) {
        res.statusCode = 400
        res.end(JSON.stringify({ error: 'Search text must be between 3 and 200 characters.' }))
        return
      }
      if (!apiKey) {
        res.statusCode = 503
        res.end(JSON.stringify({ error: 'Tavily is not configured. Add TAVILY_API_KEY to .env.local and restart the app.' }))
        return
      }

      const upstream = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, search_depth: 'basic', topic: 'general', max_results: 6, include_answer: true }),
        signal: AbortSignal.timeout(20_000),
      })
      if (!upstream.ok) {
        res.statusCode = upstream.status === 429 ? 429 : upstream.status === 432 || upstream.status === 433 ? 402 : 502
        res.end(JSON.stringify({ error: upstream.status === 401 ? 'Tavily rejected the configured API key.' : upstream.status === 429 ? 'Tavily rate limit reached. Please wait and try again.' : upstream.status === 432 || upstream.status === 433 ? 'Tavily account usage limit reached.' : 'Tavily search is temporarily unavailable.' }))
        return
      }
      const data = await upstream.json() as { answer?: string; results?: { title?: string; url?: string; content?: string; score?: number; published_date?: string }[] }
      const results = (data.results || []).filter((item) => typeof item.url === 'string' && /^https?:\/\//i.test(item.url)).slice(0, 6).map((item) => ({
        title: String(item.title || item.url), url: item.url!, content: String(item.content || '').slice(0, 1800), score: Number(item.score || 0), published_date: item.published_date,
      }))
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify({ answer: data.answer, results }))
    } catch {
      if (res.headersSent) return
      res.statusCode = body ? 400 : 502
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: body ? 'Invalid search request.' : 'Tavily search is temporarily unavailable.' }))
    }
  }
  return {
    name: 'tavily-search-proxy',
    configureServer(server: { middlewares: { use: (path: string, middleware: typeof middleware) => void } }) {
      server.middlewares.use('/api/tavily/search', middleware)
    },
    configurePreviewServer(server: { middlewares: { use: (path: string, middleware: typeof middleware) => void } }) {
      server.middlewares.use('/api/tavily/search', middleware)
    },
  }
}

function kimiChatProxy(kimiApiKey: string, nemotronApiKey: string) {
  const requests = new Map<string, number[]>()
  const middleware = async (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => {
    if (req.method !== 'POST') {
      res.statusCode = 405; res.setHeader('Allow', 'POST'); res.end(JSON.stringify({ error: 'Use POST to send a chat message.' })); return
    }
    const origin = req.headers.origin
    if (origin && req.headers.host) {
      try { if (new URL(origin).host !== req.headers.host) { res.statusCode = 403; res.end(JSON.stringify({ error: 'Cross-origin requests are not allowed.' })); return } }
      catch { res.statusCode = 403; res.end(JSON.stringify({ error: 'Invalid request origin.' })); return }
    }
    const now = Date.now()
    const ip = req.socket.remoteAddress || 'local'
    const recent = (requests.get(ip) || []).filter((time) => now - time < 60_000)
    if (recent.length >= 12) { res.statusCode = 429; res.end(JSON.stringify({ error: 'Chat limit reached. Please wait a minute and try again.' })); return }
    recent.push(now); requests.set(ip, recent)

    let body = ''
    let upstreamTimedOut = false
    try {
      for await (const chunk of req) {
        body += chunk.toString()
        if (body.length > 32_000) { res.statusCode = 413; res.end(JSON.stringify({ error: 'Chat request is too large.' })); return }
      }
      let payload: { messages?: unknown }
      try { payload = JSON.parse(body) as { messages?: unknown } }
      catch { res.statusCode = 400; res.end(JSON.stringify({ error: 'Invalid chat request.' })); return }
      const messages = payload.messages
      if (!Array.isArray(messages) || messages.length < 2 || messages.length > 12 || !messages.every((message) => message && typeof message === 'object' && ['system', 'user', 'assistant'].includes((message as { role?: string }).role || '') && typeof (message as { content?: unknown }).content === 'string' && ((message as { content: string }).content.length <= 8_000))) {
        res.statusCode = 400; res.end(JSON.stringify({ error: 'Chat messages are invalid or too long.' })); return
      }
      if (!kimiApiKey && !nemotronApiKey) { res.statusCode = 503; res.end(JSON.stringify({ error: 'No NVIDIA chat model is configured. Add a model API key to .env.local and restart the app.' })); return }

      const providers = [
        { name: 'Kimi K3', apiKey: kimiApiKey, model: 'moonshotai/kimi-k3', timeoutMs: 30_000,
          options: { max_tokens: 2_048, seed: 0, stream: true, temperature: 1, reasoning_effort: 'low' } },
        { name: 'Nemotron 3.5 Lightning', apiKey: nemotronApiKey, model: 'nvidia/nemotron-3.5-lightning-30b-a3b', timeoutMs: 45_000,
          options: { max_tokens: 2_048, stream: true, temperature: 1, top_p: 0.95, chat_template_kwargs: { enable_thinking: true }, reasoning_budget: 1_024 } },
      ].filter((provider) => provider.apiKey)
      let lastStatus = 0
      const rejectedProviders: string[] = []
      for (const provider of providers) {
        const controller = new AbortController()
        upstreamTimedOut = false
        const responseTimeout = setTimeout(() => { upstreamTimedOut = true; controller.abort() }, provider.timeoutMs)
        let streamTimeout: ReturnType<typeof setTimeout> | undefined
        res.on('close', () => { if (!res.writableEnded) controller.abort() })
        try {
          const upstream = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${provider.apiKey}`, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
            body: JSON.stringify({ model: provider.model, messages, ...provider.options }),
            signal: controller.signal,
          })
          clearTimeout(responseTimeout)
          if (!upstream.ok || upstream.status === 202 || !upstream.body) {
            lastStatus = upstream.status
            if (upstream.status === 401 || upstream.status === 403) rejectedProviders.push(provider.name)
            await upstream.body?.cancel().catch(() => {})
            continue
          }
          streamTimeout = setTimeout(() => { upstreamTimedOut = true; controller.abort() }, 120_000)
          const decoder = new TextDecoder()
          const pendingChunks: Buffer[] = []
          let sseBuffer = ''
          let emittedContent = false
          for await (const chunk of upstream.body) {
            if (res.destroyed) break
            const bytes = Buffer.from(chunk)
            if (!res.headersSent) pendingChunks.push(bytes)
            else res.write(bytes)
            sseBuffer += decoder.decode(bytes, { stream: true })
            const lines = sseBuffer.split(/\r?\n/)
            sseBuffer = lines.pop() || ''
            for (const line of lines) {
              if (!line.startsWith('data:')) continue
              try {
                const event = JSON.parse(line.slice(5).trim()) as { choices?: { delta?: { content?: unknown } }[] }
                if (typeof event.choices?.[0]?.delta?.content === 'string' && event.choices[0].delta.content) emittedContent = true
              } catch { /* Ignore incomplete or non-JSON stream events. */ }
            }
            if (emittedContent && !res.headersSent) {
              res.statusCode = 200
              res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
              res.setHeader('Cache-Control', 'no-cache, no-transform')
              res.setHeader('X-Accel-Buffering', 'no')
              res.flushHeaders()
              for (const pending of pendingChunks) res.write(pending)
              pendingChunks.length = 0
            }
          }
          clearTimeout(streamTimeout)
          if (!emittedContent) { lastStatus = 502; continue }
          if (!res.destroyed) res.end()
          return
        } catch {
          if (res.headersSent) { if (!res.destroyed) res.end(); return }
        } finally { clearTimeout(responseTimeout); if (streamTimeout) clearTimeout(streamTimeout) }
        if (res.destroyed) return
      }
      res.statusCode = rejectedProviders.length ? 503 : upstreamTimedOut ? 504 : lastStatus === 429 ? 429 : 502
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: rejectedProviders.length ? `NVIDIA rejected the ${rejectedProviders.join(' and ')} API key. Check that key and its access to the selected model.` : upstreamTimedOut ? 'The NVIDIA models took too long to respond. Please try again shortly.' : lastStatus === 429 ? 'Both NVIDIA models are rate limited. Please try again shortly.' : 'Kimi and Nemotron are temporarily unavailable. Please try again shortly.' }))
    } catch {
      if (!res.headersSent) { res.statusCode = upstreamTimedOut ? 504 : 502; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify({ error: upstreamTimedOut ? 'The NVIDIA models took too long to respond. Please try again shortly.' : 'Kimi and Nemotron are temporarily unavailable. Please try again shortly.' })) }
      else if (!res.destroyed) res.end()
    }
  }
  return {
    name: 'nvidia-chat-fallback-proxy',
    configureServer(server: { middlewares: { use: (path: string, middleware: typeof middleware) => void } }) { server.middlewares.use('/api/assistant/chat', middleware) },
    configurePreviewServer(server: { middlewares: { use: (path: string, middleware: typeof middleware) => void } }) { server.middlewares.use('/api/assistant/chat', middleware) },
  }
}

type ReportConfig = { apiKey: string; inboxId: string; recipient: string; sendTime: string; timeZone: string; kimiConfigured: boolean }

function agentMailReports(config: ReportConfig) {
  const requests = new Map<string, number[]>()
  let lastDailySend = ''

  const ready = () => Boolean(config.apiKey && config.inboxId && config.recipient && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.recipient) && /^([01]\d|2[0-3]):[0-5]\d$/.test(config.sendTime))
  const localDateAndTime = (date: Date) => {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: config.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)
    const get = (type: string) => parts.find((part) => part.type === type)?.value || ''
    return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` }
  }
  const makeReport = async (kind: 'test' | 'daily') => {
    let fplStatus = 'Unavailable'
    try {
      const response = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/', { signal: AbortSignal.timeout(10_000) })
      fplStatus = response.ok ? 'Reachable' : `Unavailable (HTTP ${response.status})`
    } catch { /* Report the feed as unavailable when the status probe fails. */ }
    const now = new Date()
    const dateTime = new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'short', timeZone: config.timeZone }).format(now)
    const subject = `${kind === 'test' ? 'Test' : 'Daily'} system report · Premier League Hub · ${localDateAndTime(now).date}`
    const text = [
      `${kind === 'test' ? 'Test' : 'Daily'} system report`,
      `Generated: ${dateTime} (${config.timeZone})`,
      '',
      'Premier League Hub status',
      '• Application: Vite server is running (this report was generated by the server).',
      `• Fantasy Premier League data feed: ${fplStatus}.`,
      `• Kimi K3 assistant: ${config.kimiConfigured ? 'server key is configured' : 'not configured'}.`,
      '• Activity history: stored in the browser and not available to this server report.',
      '• Cloud metrics: simulated in the browser; they are not real infrastructure measurements.',
      '',
      kind === 'test' ? 'This is the one-time test report you requested.' : 'This report is sent by the local app while its development or preview server is running.',
    ].join('\n')
    const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#282333"><h2>${kind === 'test' ? 'Test' : 'Daily'} system report</h2><p><b>Generated:</b> ${dateTime} (${config.timeZone})</p><h3>Premier League Hub status</h3><ul><li><b>Application:</b> Vite server is running.</li><li><b>Fantasy Premier League data feed:</b> ${fplStatus}.</li><li><b>Kimi K3 assistant:</b> ${config.kimiConfigured ? 'server key is configured' : 'not configured'}.</li><li><b>Activity history:</b> stored in the browser; unavailable to this server report.</li><li><b>Cloud metrics:</b> simulated in the browser, not real infrastructure measurements.</li></ul><p>${kind === 'test' ? 'This is the one-time test report you requested.' : 'Sent by the local app while its development or preview server is running.'}</p></div>`
    const response = await fetch(`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(config.inboxId)}/messages/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: config.recipient, subject, text, html }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!response.ok) throw new Error(response.status === 401 ? 'AgentMail rejected the configured key.' : response.status === 429 ? 'AgentMail rate limit reached.' : 'AgentMail could not send the report.')
  }

  const middleware = async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== 'POST') { res.statusCode = 405; res.setHeader('Allow', 'POST'); res.end(JSON.stringify({ error: 'Use POST to send the test report.' })); return }
    const origin = req.headers.origin
    if (origin && req.headers.host) {
      try { if (new URL(origin).host !== req.headers.host) { res.statusCode = 403; res.end(JSON.stringify({ error: 'Cross-origin requests are not allowed.' })); return } }
      catch { res.statusCode = 403; res.end(JSON.stringify({ error: 'Invalid request origin.' })); return }
    }
    const ip = req.socket.remoteAddress || 'local'
    const now = Date.now()
    const recent = (requests.get(ip) || []).filter((time) => now - time < 60_000)
    if (recent.length >= 2) { res.statusCode = 429; res.end(JSON.stringify({ error: 'Please wait before requesting another test report.' })); return }
    recent.push(now); requests.set(ip, recent)
    for await (const _chunk of req) { /* Ignore any client-supplied report contents. */ }
    if (!ready()) { res.statusCode = 503; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'AgentMail is not configured. Set AGENTMAIL_API_KEY, AGENTMAIL_INBOX_ID, and AGENTMAIL_REPORT_TO in .env.local, then restart the app.' })); return }
    try {
      await makeReport('test')
      res.statusCode = 200; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify({ ok: true, message: 'Test report sent.' }))
    } catch (error) {
      res.statusCode = 502; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'AgentMail could not send the report.' }))
    }
  }
  let interval: ReturnType<typeof setInterval> | undefined
  const startSchedule = () => {
    if (interval || !ready()) return
    interval = setInterval(() => {
      const { date, time } = localDateAndTime(new Date())
      if (time !== config.sendTime || date === lastDailySend) return
      lastDailySend = date
      void makeReport('daily').catch((error: unknown) => console.error(`[agentmail-report] ${error instanceof Error ? error.message : 'Daily report failed.'}`))
    }, 15_000)
  }
  return {
    name: 'agentmail-system-reports',
    configureServer(server: { middlewares: { use: (path: string, middleware: typeof middleware) => void }; httpServer?: { once: (event: string, callback: () => void) => void; close?: (callback: () => void) => void } }) {
      server.middlewares.use('/api/reports/test', middleware)
      server.httpServer?.once('listening', startSchedule)
      server.httpServer?.close?.(() => { if (interval) clearInterval(interval) })
    },
    configurePreviewServer(server: { middlewares: { use: (path: string, middleware: typeof middleware) => void }; httpServer?: { once: (event: string, callback: () => void) => void; close?: (callback: () => void) => void } }) {
      server.middlewares.use('/api/reports/test', middleware)
      server.httpServer?.once('listening', startSchedule)
      server.httpServer?.close?.(() => { if (interval) clearInterval(interval) })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tavilyProxy(env.TAVILY_API_KEY || ''), footballHighlightsProxy(env.TAVILY_API_KEY || ''), leagueRankingsProxy(), leagueCoachesProxy(env.API_FOOTBALL_KEY || ''), kimiChatProxy(env.NVIDIA_API_KEY || '', env.NVIDIA_NEMOTRON_API_KEY || ''), agentMailReports({ apiKey: env.AGENTMAIL_API_KEY || '', inboxId: env.AGENTMAIL_INBOX_ID || '', recipient: env.AGENTMAIL_REPORT_TO || '', sendTime: env.AGENTMAIL_REPORT_TIME || '09:00', timeZone: env.AGENTMAIL_REPORT_TIMEZONE || 'Asia/Amman', kimiConfigured: Boolean(env.NVIDIA_API_KEY || env.NVIDIA_NEMOTRON_API_KEY) }), premierLeagueMatchProxy(), fplProxy(), apiFootballProxy(env.API_FOOTBALL_KEY || '')],
  }
})
