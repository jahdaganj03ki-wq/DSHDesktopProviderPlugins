import type { FreebuffAdapterOptions, FreebuffRequest, FreebuffResponse } from './types.js'

const DEFAULT_BASE = 'https://www.codebuff.com'

function withTimeout(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

export class FreebuffTransport {
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly userAgent: string
  constructor(options: FreebuffAdapterOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE).replace(/\/$/, '')
    this.fetchImpl = options.fetchImpl ?? fetch
    this.userAgent = options.userAgent ?? 'dsh-freebuff/0.1'
  }

  async me(token: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/v1/me`, { headers: this.headers(token), signal: withTimeout(signal, 10_000) })
    return this.jsonOrThrow(response)
  }

  async session(token: string, method: 'GET' | 'DELETE', model?: string, instanceId?: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const headers = this.headers(token)
    if (model) headers['x-freebuff-model'] = model
    if (instanceId) headers['x-freebuff-instance-id'] = instanceId
    const response = await this.fetchImpl(`${this.baseUrl}/api/v1/freebuff/session`, { method, headers, signal: withTimeout(signal, 20_000) })
    return this.jsonOrThrow(response)
  }

  async admitSession(token: string, model: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/v1/freebuff/session/admission`, {
      method: 'POST', headers: { ...this.headers(token), 'content-type': 'application/json', 'x-freebuff-model': model },
      body: JSON.stringify({ model }), signal: withTimeout(signal, 20_000),
    })
    return this.jsonOrThrow(response)
  }

  async startRun(token: string, agentId: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/v1/agent-runs`, {
      method: 'POST', headers: { ...this.headers(token), 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'START', agentId, ancestorRunIds: [] }), signal: withTimeout(signal, 20_000),
    })
    return this.jsonOrThrow(response)
  }

  async chat(token: string, request: FreebuffRequest, instanceId: string, signal?: AbortSignal): Promise<FreebuffResponse> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/v1/chat/completions`, {
      method: 'POST', headers: { ...this.headers(token), 'content-type': 'application/json', 'x-freebuff-instance-id': instanceId },
      body: JSON.stringify({ ...request.body, model: request.model, stream: true }), signal: withTimeout(signal, request.deadlineMs ?? 120_000),
    })
    if (!response.ok) {
      const body = await response.text()
      throw Object.assign(new Error(body || `Freebuff HTTP ${response.status}`), { status: response.status, body })
    }
    if (!response.body) throw new Error('Freebuff returned no response body')
    return { status: response.status, headers: response.headers, body: this.iterate(response.body), bytesSent: false }
  }

  private headers(token: string): Record<string, string> { return { authorization: `Bearer ${token}`, 'user-agent': this.userAgent, accept: 'application/json' } }
  private async jsonOrThrow(response: Response): Promise<Record<string, unknown>> { const body = await response.text(); if (!response.ok) throw Object.assign(new Error(body || `Freebuff HTTP ${response.status}`), { status: response.status, body }); return body ? JSON.parse(body) as Record<string, unknown> : {} }
  private async *iterate(body: ReadableStream<Uint8Array>): AsyncIterable<Uint8Array> { const reader = body.getReader(); try { while (true) { const next = await reader.read(); if (next.done) return; yield next.value } } finally { reader.releaseLock() } }
}
