import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleFootballApi } from '../server/vercelApi.ts'

export default function handler(request: IncomingMessage, response: ServerResponse) {
  return handleFootballApi(request, response)
}
