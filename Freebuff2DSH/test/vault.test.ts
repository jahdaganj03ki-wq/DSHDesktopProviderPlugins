import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { AccountVault } from '../src/account-vault.js'

test('vault seals tokens and public account views redact them', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-freebuff-'))
  try {
    const file = join(dir, 'accounts.json')
    const key = randomBytes(32)
    const vault = new AccountVault(file, key)
    const created = await vault.add({ alias: 'one', token: 'secret-token' })
    assert.equal(vault.listPublic()[0]?.token, undefined)
    const raw = await readFile(file, 'utf8')
    assert.equal(raw.includes('secret-token'), false)
    const restored = new AccountVault(file, key)
    await restored.load()
    assert.equal(restored.get(created.id)?.token, 'secret-token')
  } finally { await rm(dir, { recursive: true, force: true }) }
})
