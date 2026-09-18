import { homedir } from 'node:os'
import { join } from 'node:path'
import { AccountVault } from './account-vault.js'
import { FreebuffProvider } from './provider.js'
import { FreebuffTransport } from './freebuff-transport.js'
import { FreebuffLlmAdapter } from './dsh-adapter.js'
import { registerFreebuffRoutes } from './routes.js'
import type { FailoverPolicy } from './types.js'

export const name = 'llm-freebuff'
export const inject = ['llm']

export interface FreebuffConfig extends Partial<FailoverPolicy> {
  baseUrl?: string
  vaultPath?: string
  vaultKey?: string
  userAgent?: string
}

function keyFromConfig(config: FreebuffConfig): Buffer {
  const encoded = config.vaultKey ?? process.env.DSH_FREEBUFF_VAULT_KEY
  if (!encoded) throw new Error('DSH_FREEBUFF_VAULT_KEY is required; set a 32-byte base64url key before adding accounts')
  const key = Buffer.from(encoded, 'base64url')
  if (key.length !== 32) throw new Error('DSH_FREEBUFF_VAULT_KEY must decode to exactly 32 bytes')
  return key
}

export function apply(ctx: any, config: FreebuffConfig = {}): void {
  const policy: FailoverPolicy = {
    enabled: config.enabled ?? false,
    maxAttempts: Math.max(1, config.maxAttempts ?? 1),
    maxAccountSwitches: Math.max(0, config.maxAccountSwitches ?? 0),
    allowStreamingFailover: false,
    allowNonIdempotentFailover: false,
    maxConcurrentPerAccount: Math.max(1, config.maxConcurrentPerAccount ?? 1),
  }
  const filename = config.vaultPath ?? join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), '.freebuff-auth.json')
  const vault = new AccountVault(filename, keyFromConfig(config))
  const accounts = vault.hostMap()
  const provider = new FreebuffProvider(accounts, policy, new FreebuffTransport({ baseUrl: config.baseUrl, userAgent: config.userAgent }), () => vault.save())
  const loading = vault.load().catch(error => {
    ctx.logger?.error?.(`dsh-freebuff: cannot load account vault: ${error instanceof Error ? error.message : String(error)}`)
    throw error
  })
  provider.setReady(loading)
  ctx.llm.registerAdapter(['freebuff'], new FreebuffLlmAdapter(provider))
  if (typeof ctx.inject === 'function') ctx.inject(['webServer'], (webCtx: any) => registerFreebuffRoutes(webCtx, vault))
}
