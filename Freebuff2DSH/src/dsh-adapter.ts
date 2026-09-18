import { LlmAdapter, LlmError } from '@deepseek-ai/dsh-llm'
import type { ModelModality } from '@deepseek-ai/dsh-llm'
import { FreebuffProvider } from './provider.js'
import type { FreebuffRequest } from './types.js'

function textOf(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content.map(block => {
    if (!block || typeof block !== 'object') return ''
    const value = block as Record<string, unknown>
    return typeof value.text === 'string' ? value.text : typeof value.content === 'string' ? value.content : ''
  }).join('')
}

function messageBody(options: any): Record<string, unknown> {
  const messages: Array<Record<string, unknown>> = []
  if (typeof options.system === 'string' && options.system.length > 0) messages.push({ role: 'system', content: options.system })
  for (const message of options.messages ?? []) {
    const role = message.role === 'assistant' ? 'assistant' : message.role === 'toolResult' ? 'tool' : message.role === 'system' ? 'system' : 'user'
    messages.push({ role, content: textOf(message.content), ...(message.toolCallId ? { tool_call_id: message.toolCallId } : {}) })
  }
  return {
    messages,
    ...(Array.isArray(options.tools) && options.tools.length ? { tools: options.tools.map((tool: any) => ({ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.parameters } })) } : {}),
    ...(options.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {}),
  }
}

async function* sseChunks(source: AsyncIterable<Uint8Array>, signal?: AbortSignal): AsyncIterable<any> {
  const decoder = new TextDecoder()
  let buffer = ''
  let index = 0
  let started = false
  for await (const bytes of source) {
    if (signal?.aborted) return
    buffer += decoder.decode(bytes, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const raw = line.slice(5).trim()
      if (!raw || raw === '[DONE]') continue
      let event: any
      try { event = JSON.parse(raw) } catch { continue }
      const choice = event.choices?.[0]
      const delta = choice?.delta ?? {}
      if (!started) { started = true; yield { type: 'block-start', index: 0, blockType: 'text' } }
      if (typeof delta.reasoning_content === 'string' && delta.reasoning_content.length > 0) yield { type: 'reasoning-delta', index: 0, text: delta.reasoning_content }
      if (typeof delta.content === 'string' && delta.content.length > 0) yield { type: 'text-delta', index: 0, text: delta.content }
      for (const tool of delta.tool_calls ?? []) {
        yield { type: 'tool-call-delta', index: tool.index ?? index++, id: tool.id ?? '', ...(tool.function?.name ? { name: tool.function.name } : {}), argumentsDelta: tool.function?.arguments ?? '' }
      }
      if (event.usage) yield { type: 'usage', usage: { input: event.usage.prompt_tokens ?? 0, output: event.usage.completion_tokens ?? 0, total: event.usage.total_tokens ?? 0 } }
    }
  }
  if (started) yield { type: 'block-end', index: 0, block: { type: 'text', text: '' } }
  yield { type: 'finish', reason: 'stop' }
}

/** Direct DSH LLM seam adapter. It intentionally exposes only text/tool chunks. */
export class FreebuffLlmAdapter extends LlmAdapter {
  constructor(private readonly provider: FreebuffProvider) { super() }
  providerInfo(provider: string) { return { id: provider, name: 'Freebuff' } }
  listModels(_provider: string) { return Promise.resolve(this.provider.models().map(id => ({ provider: 'freebuff', id, name: id, inputModalities: ['text'] as readonly ModelModality[] }))) }
  resolveModel(provider: string, model: string, _signal?: AbortSignal) { return Promise.resolve({ provider, id: model, name: model, inputModalities: ['text'] as readonly ModelModality[], context: { contextWindow: 1_048_576 } }) }
  async prepareCall(provider: string, model: string, signal?: AbortSignal) { return { model: await this.resolveModel(provider, model), stream: (options: any) => this.stream({ ...options, provider, model, signal }) } }
  async *stream(options: any): AsyncIterable<any> {
    const request: FreebuffRequest = {
      model: options.model,
      body: messageBody(options),
      stream: true,
      sideEffect: Array.isArray(options.tools) && options.tools.length ? 'tool_call' : 'none',
      deadlineMs: 120_000,
    }
    try {
      const response = this.provider.stream(request)
      yield* sseChunks(response, options.signal)
    } catch (error) {
      throw new LlmError(error instanceof Error ? error.message : 'Freebuff request failed', 'FREEBUFF_REQUEST_FAILED')
    }
  }
}

export function createFreebuffLlmAdapter(provider: FreebuffProvider): FreebuffLlmAdapter { return new FreebuffLlmAdapter(provider) }
