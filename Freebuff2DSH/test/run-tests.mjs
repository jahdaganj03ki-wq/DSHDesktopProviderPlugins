import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const tests = readdirSync(new URL('.', import.meta.url)).filter(name => name.endsWith('.test.ts'))
for (const test of tests) {
  const result = spawnSync(process.execPath, ['--loader', './tools/ts-loader.mjs', '-e', `import('./test/${test}')`], { stdio: 'inherit', shell: false })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
