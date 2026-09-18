import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyFreebuffError, maySwitchAccount } from '../src/errors.js'
import { AccountScheduler } from '../src/scheduler.js'
import { FreebuffFailoverExecutor } from '../src/failover.js'
import type { FreebuffAccount } from '../src/types.js'

function account(id: string): FreebuffAccount {
  return { id, alias: id, token: `secret-${id}`, enabled: true, weight: 1, quotaState: 'unknown', breakerState: 'closed', inFlight: 0, consecutiveFailures: 0 }
}

test('only typed quota errors are eligible for account switching', () => {
  const quota = classifyFreebuffError({ status: 429, body: JSON.stringify({ error: { code: 'quota_exhausted', resetAt: 123 } }) })
  const generic = classifyFreebuffError({ status: 429, body: '{}' })
  assert.equal(quota.class, 'quota_exhausted')
  assert.equal(generic.class, 'rate_limit')
  assert.equal(maySwitchAccount(quota, { stream: false, sideEffect: 'none' }, { allowStreamingFailover: false, allowNonIdempotentFailover: false }), true)
})

test('streaming failover is blocked after bytes', () => {
  const outcome = classifyFreebuffError({ status: 429, body: '{"code":"rate_limited"}', bytesSent: true })
  assert.equal(maySwitchAccount(outcome, { stream: true, sideEffect: 'none' }, { allowStreamingFailover: true, allowNonIdempotentFailover: false }), false)
})

test('executor switches only on quota exhaustion before side effects', async () => {
  const a = account('a'); const b = account('b')
  const accounts = new Map([[a.id, a], [b.id, b]])
  const executor = new FreebuffFailoverExecutor(accounts, new AccountScheduler(accounts))
  const used: string[] = []
  const value = await executor.execute({ model: 'deepseek/deepseek-v4-flash', body: {}, stream: false, sideEffect: 'none' }, { enabled: true, maxAttempts: 2, maxAccountSwitches: 1, allowStreamingFailover: false, allowNonIdempotentFailover: false, maxConcurrentPerAccount: 1 }, async ({ account: selected }) => {
    used.push(selected.id)
    if (used.length === 1) throw Object.assign(new Error('quota'), { status: 429, body: '{"code":"quota_exhausted"}' })
    return { value: 'ok', bytesSent: false, sideEffectAccepted: false }
  })
  assert.equal(value, 'ok')
  assert.equal(used.length, 2)
})
