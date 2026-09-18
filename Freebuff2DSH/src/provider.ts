import { classifyFreebuffError, maySwitchAccount } from './errors.js'
import { AccountScheduler } from './scheduler.js'
import { FreebuffTransport } from './freebuff-transport.js'
import type { FreebuffAccount, FreebuffRequest, FailoverPolicy } from './types.js'

const AGENTS: Record<string, string> = {
  'deepseek/deepseek-v4-flash': 'base2-free-deepseek-flash',
  'deepseek/deepseek-v4-pro': 'base2-free-deepseek',
  'minimax/minimax-m3': 'base2-free-minimax-m3',
  'openai/gpt-5.6-luna': 'base2-free-luna',
  'z-ai/glm-5.2': 'base2-free-glm',
}

export const FREEBUFF_MODELS = Object.keys(AGENTS)

interface Session { instanceId: string; model: string; expiresAt: number }

function asString(value: unknown): string { return typeof value === 'string' ? value : '' }
function asSession(value: Record<string, unknown>, model: string): Session {
  const instanceId = asString(value.instanceId)
  if (!instanceId) throw new Error('Freebuff session response has no instanceId')
  const raw = asString(value.expiresAt)
  const parsed = raw ? Date.parse(raw) : Number(value.expiresAt)
  return { instanceId, model: asString(value.model) || model, expiresAt: Number.isFinite(parsed) && parsed > 0 ? parsed : Date.now() + 5 * 60_000 }
}

/** Native Freebuff lifecycle: account → session → agent run → SSE chat. */
export class FreebuffProvider {
  private readonly sessions = new Map<string, Session>()
  private readonly runs = new Map<string, string>()
  private readonly locks = new Map<string, Promise<void>>()
  private ready: Promise<void> = Promise.resolve()

  constructor(
    private readonly accounts: Map<string, FreebuffAccount>,
    private readonly policy: FailoverPolicy,
    private readonly transport = new FreebuffTransport(),
    private readonly persist?: () => Promise<void>,
  ) {}

  setReady(ready: Promise<void>): void { this.ready = ready }

  models(): readonly string[] { return FREEBUFF_MODELS }

  async *stream(request: FreebuffRequest): AsyncIterable<Uint8Array> {
    await this.ready
    const scheduler = new AccountScheduler(this.accounts)
    const tried = new Set<string>()
    let switches = 0
    const maxAttempts = this.policy.enabled ? Math.max(1, this.policy.maxAttempts) : 1

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const account = scheduler.select(tried, this.policy)
      if (!account) throw new Error('No eligible Freebuff account remains')
      tried.add(account.id)
      const previous = this.locks.get(account.id) ?? Promise.resolve()
      let release!: () => void
      const turn = new Promise<void>(resolve => { release = resolve })
      this.locks.set(account.id, previous.then(() => turn))
      await previous

      let sent = false
      try {
        const session = await this.ensureSession(account, request.model)
        const runId = await this.ensureRun(account, request.model)
        const response = await this.transport.chat(account.token, this.transform(request, session.instanceId, runId), session.instanceId)
        for await (const chunk of response.body) {
          sent = true
          yield chunk
        }
        scheduler.recordSuccess(account)
        await this.persist?.()
        return
      } catch (error) {
        const value = error as { status?: number; body?: string }
        const outcome = classifyFreebuffError({ status: value.status, body: value.body, error, bytesSent: sent, sideEffectAccepted: sent })
        scheduler.recordFailure(account, outcome.class, outcome.resetAt, outcome.retryAfterMs)
        await this.persist?.()
        const canSwitch = switches < this.policy.maxAccountSwitches && attempt < maxAttempts && maySwitchAccount(outcome, request, this.policy)
        if (!canSwitch) throw error
        switches++
      } finally {
        scheduler.release(account)
        release()
      }
    }
  }

  private transform(request: FreebuffRequest, instanceId: string, runId: string): FreebuffRequest {
    const body = structuredClone(request.body)
    const messages = Array.isArray(body.messages) ? body.messages as Array<Record<string, unknown>> : []
    if (!messages.length || messages[0]?.role !== 'system') messages.unshift({ role: 'system', content: 'You are Buffy, the strategic coding assistant.' })
    body.messages = messages
    body.provider = { data_collection: 'deny' }
    body.stop = ['"cb_easp"']
    body.stream = true
    body.codebuff_metadata = { run_id: runId, client_id: 'dsh-freebuff', cost_mode: 'free', freebuff_instance_id: instanceId }
    return { ...request, body }
  }

  private async ensureSession(account: FreebuffAccount, model: string): Promise<Session> {
    const key = `${account.id}:${model}`
    const cached = this.sessions.get(key)
    if (cached && cached.expiresAt - Date.now() > 60_000) return cached
    const current = await this.transport.session(account.token, 'GET', model)
    if (current.status === 'active' && asString(current.model) === model && asString(current.instanceId)) {
      const session = asSession(current, model); this.sessions.set(key, session); return session
    }
    const admitted = await this.transport.admitSession(account.token, model)
    if (asString(admitted.status) === 'queued' && asString(admitted.instanceId)) {
      for (let poll = 0; poll < 8; poll++) {
        await new Promise(resolve => setTimeout(resolve, 1500))
        const current = await this.transport.session(account.token, 'GET', model, asString(admitted.instanceId))
        if (current.status === 'active' && asString(current.instanceId)) {
          const session = asSession(current, model); this.sessions.set(key, session); return session
        }
      }
      throw new Error('Freebuff session remained queued')
    }
    const session = asSession(admitted, model); this.sessions.set(key, session); return session
  }

  private async ensureRun(account: FreebuffAccount, model: string): Promise<string> {
    const key = `${account.id}:${model}`
    const cached = this.runs.get(key)
    if (cached) return cached
    const run = await this.transport.startRun(account.token, AGENTS[model] ?? AGENTS['deepseek/deepseek-v4-flash']!)
    const runId = asString(run.runId)
    if (!runId) throw new Error('Freebuff run response has no runId')
    this.runs.set(key, runId)
    return runId
  }
}
