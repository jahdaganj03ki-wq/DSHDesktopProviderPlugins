export type QuotaState = 'unknown' | 'available' | 'exhausted' | 'cooldown' | 'reauth_required' | 'disabled'
export type BreakerState = 'closed' | 'open' | 'half_open'

export interface FreebuffAccount {
  id: string
  alias: string
  /** Provider token. Keep this object host-side; never send it to the browser. */
  token: string
  userId?: string
  email?: string
  enabled: boolean
  weight: number
  quotaState: QuotaState
  breakerState: BreakerState
  cooldownUntil?: number
  resetAt?: number
  inFlight: number
  lastErrorClass?: FreebuffErrorClass
  lastSuccessAt?: number
  consecutiveFailures: number
}

export type FreebuffErrorClass =
  | 'quota_exhausted'
  | 'rate_limit'
  | 'ip_cap'
  | 'auth'
  | 'permission'
  | 'banned'
  | 'country_blocked'
  | 'session_conflict'
  | 'model_unavailable'
  | 'invalid_request'
  | 'transient'
  | 'timeout'
  | 'network'
  | 'server'
  | 'unknown'

export interface FreebuffErrorOutcome {
  class: FreebuffErrorClass
  providerCode?: string
  retryAfterMs?: number
  resetAt?: number
  bytesSent: boolean
  sideEffectAccepted: boolean
  message: string
}

export interface FreebuffRequest {
  model: string
  body: Record<string, unknown>
  stream: boolean
  idempotencyKey?: string
  sideEffect: 'none' | 'tool_call' | 'agent_action'
  deadlineMs?: number
}

export interface FreebuffResponse {
  status: number
  headers: Headers
  body: AsyncIterable<Uint8Array>
  bytesSent: boolean
}

export interface FreebuffAdapterOptions {
  baseUrl?: string
  userAgent?: string
  fetchImpl?: typeof fetch
}

export interface FailoverPolicy {
  enabled: boolean
  maxAttempts: number
  maxAccountSwitches: number
  allowStreamingFailover: boolean
  allowNonIdempotentFailover: boolean
  maxConcurrentPerAccount: number
}

export const DEFAULT_FAILOVER_POLICY: FailoverPolicy = {
  enabled: false,
  maxAttempts: 1,
  maxAccountSwitches: 0,
  allowStreamingFailover: false,
  allowNonIdempotentFailover: false,
  maxConcurrentPerAccount: 1,
}
