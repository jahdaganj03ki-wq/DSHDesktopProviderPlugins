import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto'
import type { FreebuffAccount } from './types.js'

interface StoredAccount extends Omit<FreebuffAccount, 'token'> { tokenCiphertext: string }
interface StoredDocument { version: 2; accounts: StoredAccount[] }

function seal(token: string, key: Buffer): string {
  if (key.length !== 32) throw new Error('Freebuff vault key must be exactly 32 bytes')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url')
}

function unseal(value: string, key: Buffer): string {
  const packed = Buffer.from(value, 'base64url')
  if (packed.length < 28) throw new Error('invalid Freebuff vault secret')
  const decipher = createDecipheriv('aes-256-gcm', key, packed.subarray(0, 12))
  decipher.setAuthTag(packed.subarray(12, 28))
  return Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString('utf8')
}

function publicAccount(account: FreebuffAccount) {
  const { token: _token, ...safe } = account
  return safe
}

/** Host-side account store. Production deployments should replace token storage with DPAPI/keychain. */
export class AccountVault {
  private accounts = new Map<string, FreebuffAccount>()
  private saveTail: Promise<void> = Promise.resolve()
  constructor(private readonly filename: string, private readonly key: Buffer) {}

  async load(): Promise<void> {
    try {
      const raw = JSON.parse(await readFile(this.filename, 'utf8')) as StoredDocument
      if (raw.version !== 2 || !Array.isArray(raw.accounts)) throw new Error('invalid Freebuff account document')
      for (const stored of raw.accounts) {
        const { tokenCiphertext, ...metadata } = stored
        this.accounts.set(stored.id, { ...metadata, token: unseal(tokenCiphertext, this.key) })
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }

  listPublic(): ReturnType<typeof publicAccount>[] { return [...this.accounts.values()].map(publicAccount) }
  listHost(): FreebuffAccount[] { return [...this.accounts.values()].map(account => ({ ...account })) }
  /** Internal host map used by the scheduler; never expose this to browser code. */
  hostMap(): Map<string, FreebuffAccount> { return this.accounts }
  get(id: string): FreebuffAccount | undefined { const account = this.accounts.get(id); return account && { ...account } }

  async add(input: { alias: string; token: string; userId?: string; email?: string; weight?: number }): Promise<FreebuffAccount> {
    if (!input.token.trim()) throw new Error('Freebuff token is required')
    const account: FreebuffAccount = {
      id: randomUUID(), alias: input.alias.trim() || 'Freebuff account', token: input.token,
      userId: input.userId, email: input.email, enabled: true, weight: Math.max(1, input.weight ?? 1),
      quotaState: 'unknown', breakerState: 'closed', inFlight: 0, consecutiveFailures: 0,
    }
    this.accounts.set(account.id, account)
    await this.save()
    return { ...account }
  }

  async update(id: string, patch: Partial<Omit<FreebuffAccount, 'id' | 'token'>>): Promise<void> {
    const account = this.accounts.get(id)
    if (!account) throw new Error('unknown Freebuff account')
    Object.assign(account, patch)
    await this.save()
  }

  async remove(id: string): Promise<void> { this.accounts.delete(id); await this.save() }

  async save(): Promise<void> {
    const operation = this.saveTail.then(async () => {
      await mkdir(dirname(this.filename), { recursive: true })
      const temp = `${this.filename}.${process.pid}.tmp`
      const document: StoredDocument = {
        version: 2,
        accounts: [...this.accounts.values()].map(({ token, ...metadata }) => ({ ...metadata, tokenCiphertext: seal(token, this.key) })),
      }
      await writeFile(temp, JSON.stringify(document, null, 2), { mode: 0o600 })
      await rename(temp, this.filename)
    })
    this.saveTail = operation.catch(() => undefined)
    await operation
  }
}
