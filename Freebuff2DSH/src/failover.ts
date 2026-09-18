import { classifyFreebuffError, maySwitchAccount } from './errors.js'
import { AccountScheduler } from './scheduler.js'
import type { FreebuffAccount, FreebuffErrorOutcome, FreebuffRequest, FailoverPolicy } from './types.js'

export interface AttemptResult<T> { value: T; bytesSent: boolean; sideEffectAccepted: boolean }
export interface FreebuffAttemptContext { account: FreebuffAccount; attempt: number }
export type SendAttempt<T> = (context: FreebuffAttemptContext) => Promise<AttemptResult<T>>

export class AllAccountsExhaustedError extends Error {
  constructor(readonly resetAt: ReadonlyMap<string, number | undefined>) { super('No eligible Freebuff account remains') }
}

/** Executes one semantic request; account changes only happen before bytes/side effects. */
export class FreebuffFailoverExecutor {
  constructor(private readonly accounts: Map<string, FreebuffAccount>, private readonly scheduler: AccountScheduler) {}

  async execute<T>(request: FreebuffRequest, policy: FailoverPolicy, send: SendAttempt<T>): Promise<T> {
    const tried = new Set<string>()
    const resetAt = new Map<string, number | undefined>()
    let attempts = 0
    let switches = 0
    const maxAttempts = policy.enabled ? Math.max(1, policy.maxAttempts) : 1

    while (attempts < maxAttempts) {
      attempts++
      const account = this.scheduler.select(tried, policy)
      if (!account) throw new AllAccountsExhaustedError(resetAt)
      tried.add(account.id)

      try {
        const result = await send({ account, attempt: attempts })
        this.scheduler.recordSuccess(account)
        this.scheduler.release(account)
        return result.value
      } catch (error) {
        const outcome = this.outcome(error)
        account.lastErrorClass = outcome.class
        if (outcome.resetAt !== undefined) resetAt.set(account.id, outcome.resetAt)
        this.scheduler.recordFailure(account, outcome.class, outcome.resetAt, outcome.retryAfterMs)
        this.scheduler.release(account)

        const canSwitch = policy.enabled && switches < policy.maxAccountSwitches && attempts < maxAttempts && maySwitchAccount(outcome, request, policy)
        if (!canSwitch) throw error
        switches++
      }
    }

    throw new AllAccountsExhaustedError(resetAt)
  }

  private outcome(error: unknown): FreebuffErrorOutcome {
    const value = error as { status?: number; body?: string; bytesSent?: boolean; sideEffectAccepted?: boolean }
    return classifyFreebuffError({ status: value.status, body: value.body, error, bytesSent: value.bytesSent, sideEffectAccepted: value.sideEffectAccepted })
  }
}
