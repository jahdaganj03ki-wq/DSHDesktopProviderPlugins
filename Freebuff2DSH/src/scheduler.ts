import type { FreebuffAccount, FailoverPolicy } from './types.js'

function available(account: FreebuffAccount, now: number, policy: FailoverPolicy): boolean {
  const cooling = account.cooldownUntil !== undefined && account.cooldownUntil > now
  const exhausted = account.quotaState === 'exhausted' && cooling
  return account.enabled && account.breakerState !== 'open' && account.quotaState !== 'disabled' && account.quotaState !== 'reauth_required' && !exhausted && !cooling && account.inFlight < policy.maxConcurrentPerAccount
}

/** In-memory weighted fair scheduler; persistence remains the vault's responsibility. */
export class AccountScheduler {
  private cursor = 0
  constructor(private readonly accounts: Map<string, FreebuffAccount>) {}

  select(excluded: Set<string>, policy: FailoverPolicy, now = Date.now()): FreebuffAccount | undefined {
    for (const account of this.accounts.values()) {
      if (account.quotaState === 'exhausted' && account.cooldownUntil !== undefined && account.cooldownUntil <= now) {
        account.quotaState = 'cooldown'
      }
    }
    const candidates = [...this.accounts.values()].filter(account => !excluded.has(account.id) && available(account, now, policy))
    if (!candidates.length) return undefined
    const expanded = candidates.flatMap(account => Array.from({ length: Math.max(1, Math.min(32, account.weight)) }, () => account))
    const selected = expanded[this.cursor % expanded.length]
    this.cursor = (this.cursor + 1) % Math.max(1, expanded.length)
    selected.inFlight++
    return selected
  }

  release(account: FreebuffAccount): void { account.inFlight = Math.max(0, account.inFlight - 1) }

  recordFailure(account: FreebuffAccount, klass: FreebuffAccount['lastErrorClass'], resetAt?: number, retryAfterMs?: number): void {
    account.lastErrorClass = klass
    account.consecutiveFailures++
    if (klass === 'quota_exhausted') {
      account.quotaState = 'exhausted'
      account.resetAt = resetAt
      account.cooldownUntil = resetAt ?? Date.now() + Math.min(15 * 60_000, retryAfterMs ?? 60_000)
    } else if (klass === 'auth' || klass === 'banned' || klass === 'country_blocked') {
      account.quotaState = klass === 'auth' ? 'reauth_required' : 'disabled'
      account.enabled = false
    } else if (klass === 'ip_cap') {
      account.cooldownUntil = Date.now() + Math.min(15 * 60_000, retryAfterMs ?? 60_000)
    }
  }

  recordSuccess(account: FreebuffAccount): void {
    account.lastSuccessAt = Date.now(); account.consecutiveFailures = 0; account.lastErrorClass = undefined
    if (account.quotaState === 'unknown' || account.quotaState === 'cooldown') account.quotaState = 'available'
  }
}
