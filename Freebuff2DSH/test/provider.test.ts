import test from 'node:test'
import assert from 'node:assert/strict'
import { FreebuffProvider } from '../src/provider.js'
import type { FreebuffAccount, FailoverPolicy } from '../src/types.js'

const policy: FailoverPolicy = { enabled: true, maxAttempts: 2, maxAccountSwitches: 1, allowStreamingFailover: false, allowNonIdempotentFailover: false, maxConcurrentPerAccount: 1 }
const make = (id: string): FreebuffAccount => ({ id, alias: id, token: id, enabled: true, weight: 1, quotaState: 'unknown', breakerState: 'closed', inFlight: 0, consecutiveFailures: 0 })

function fakeTransport(failFirst: boolean, failAfterBytes = false) {
  let calls = 0
  return {
    async session() { return { status: 'active', model: 'deepseek/deepseek-v4-flash', instanceId: 'instance' } },
    async admitSession() { return { status: 'active', instanceId: 'instance' } },
    async startRun() { return { runId: 'run' } },
    async chat(token: string) {
      calls++
      if (failFirst && calls === 1) throw Object.assign(new Error('quota'), { status: 429, body: '{"code":"quota_exhausted"}' })
      return { body: (async function* () { yield new TextEncoder().encode('data: {}\n\n'); if (failAfterBytes) throw Object.assign(new Error('quota'), { status: 429, body: '{"code":"quota_exhausted"}' }) })() }
    },
  }
}

test('provider switches before bytes on typed quota exhaustion', async () => {
  const accounts = new Map([['a', make('a')], ['b', make('b')]])
  const provider = new FreebuffProvider(accounts, policy, fakeTransport(true) as any)
  const chunks: Uint8Array[] = []
  for await (const chunk of provider.stream({ model: 'deepseek/deepseek-v4-flash', body: { messages: [] }, stream: true, sideEffect: 'none' })) chunks.push(chunk)
  assert.equal(chunks.length, 1)
  assert.equal([...accounts.values()].filter(account => account.quotaState === 'exhausted').length, 1)
})
