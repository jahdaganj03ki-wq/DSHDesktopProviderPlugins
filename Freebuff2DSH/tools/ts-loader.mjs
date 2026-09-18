import { access, readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve as pathResolve } from 'node:path'

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && specifier.endsWith('.js')) {
    const candidate = pathResolve(dirname(fileURLToPath(context.parentURL)), specifier.slice(0, -3) + '.ts')
    try { await access(candidate); return { url: pathToFileURL(candidate).href, shortCircuit: true } } catch {}
  }
  return nextResolve(specifier, context)
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.ts')) {
    const source = await readFile(fileURLToPath(url), 'utf8')
    return { source: stripTypeScriptTypes(source, { mode: 'transform' }), format: 'module', shortCircuit: true }
  }
  return nextLoad(url, context)
}
