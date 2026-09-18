import test from 'node:test'
import assert from 'node:assert/strict'
import { FreebuffProvider } from '../src/provider.js'
import type { FreebuffAccount, FailoverPolicy } from '../src/types.js'

const make = (id: string): FreebuffAccount => ({ id, alias: id, token: id, enabled: true, weight: 1, quotaState: 'unknown', breakerState: 'closed', inFlight: 0, consecutiveFailures: 0 })
const policy: FailoverPolicy = { enabled: true, maxAttempts: 2, maxAccountSwitches: 1, allowStreamingFailover: false, allowNonIdempotentFailover: false, maxConcurrentPerAccount: 1 }

test('provider never switches after the first stream byte', async () => {
  const accounts = new Map([['a', make('a')], ['b', make('b')]])
  let calls = 0
  const transport = {
    async session() { return { status: 'active', model: 'deepseek/deepseek-v4-flash', instanceId: 'instance' } },
    async admitSession() { return { status: 'active', instanceId: 'instance' } },
    async startRun() { return { runId: 'run' } },
    async chat() { calls++; return { body: (async function* () { yield new TextEncoder().encode('data: {}\n\n'); throw Object.assign(new Error('late quota'), { status: 429, body: '{"code":"quota_exhausted"}' }) })() } },
  }
  const provider = new FreebuffProvider(accounts, policy, transport as any)
  await assert.rejects(async () => { for await (const _chunk of provider.stream({ model: 'deepseek/deepseek-v4-flash', body: {}, stream: true, sideEffect: 'none' })) {} })
  assert.equal(calls, 1)
})
