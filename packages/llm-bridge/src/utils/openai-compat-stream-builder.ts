import type { LLMStreamEvent, SSEEvent } from '../ir/stream'
import type { StreamEventBuilder } from '../adapter/base'

/**
 * Configuration for customizing the OpenAI-compatible stream builder
 */
export interface OpenAICompatStreamBuilderOptions {
  /**
   * How to handle reasoning events in the stream delta.
   * - 'reasoning_content': emit as `{ reasoning_content: delta }` (DeepSeek, Moonshot, Qwen)
   * - 'content': emit as `{ content: delta }` (OpenAI default, fold into content)
   * - 'skip': do not emit reasoning events (Zhipu)
   * - function: custom handler returning the delta object
   */
  reasoningFormat?:
    | 'reasoning_content'
    | 'content'
    | 'skip'
    | ((event: LLMStreamEvent) => Record<string, unknown> | null)

  /**
   * Extra finish reason mappings to merge with the defaults.
   * e.g. { sensitive: 'content_filter' } for Zhipu
   */
  extraFinishReasons?: Record<string, string>

  /**
   * Custom chunk ID prefix (default: 'chatcmpl')
   */
  chunkIdPrefix?: string

  /**
   * Customize the usage object in the end event.
   * Receives the standard usage and returns the final usage object.
   */
  buildUsage?: (usage: LLMStreamEvent['usage']) => Record<string, unknown> | undefined

  /**
   * Customize the start event delta (default: { role: 'assistant', content: '' })
   */
  startDelta?: Record<string, unknown>

  /**
   * Customize the error event data format
   */
  buildError?: (error: NonNullable<LLMStreamEvent['error']>) => Record<string, unknown>
}

const DEFAULT_FINISH_REASON_MAP: Record<string, string> = {
  stop: 'stop',
  length: 'length',
  tool_calls: 'tool_calls',
  content_filter: 'content_filter',
  end_turn: 'stop',
  max_tokens: 'length',
}

/**
 * Create an OpenAI-compatible stream event builder.
 *
 * This is the shared implementation for all OpenAI-compatible providers
 * (OpenAI, DeepSeek, Moonshot, Qwen, Zhipu, MiniMax). Each adapter
 * only needs to pass options for the parts that differ.
 */
export function createOpenAICompatStreamBuilder(
  options: OpenAICompatStreamBuilderOptions = {}
): StreamEventBuilder {
  const prefix = options.chunkIdPrefix ?? 'chatcmpl'
  let chunkId = `${prefix}-${Date.now()}`
  let model = ''
  const created = Math.floor(Date.now() / 1000)
  const toolCallsState: Map<number, { id: string; name: string }> = new Map()

  const finishReasonMap: Record<string, string> = {
    ...DEFAULT_FINISH_REASON_MAP,
    ...options.extraFinishReasons,
  }

  const startDelta = options.startDelta ?? { role: 'assistant', content: '' }

  function mapFinishReason(reason?: string): string {
    if (!reason) return 'stop'
    return finishReasonMap[reason] ?? 'stop'
  }

  function buildChunk(
    delta: Record<string, unknown>,
    finish_reason: string | null = null,
    extra?: Record<string, unknown>
  ): Record<string, unknown> {
    return {
      id: chunkId,
      object: 'chat.completion.chunk',
      created,
      model,
      choices: [{ index: 0, delta, finish_reason }],
      ...extra,
    }
  }

  return {
    process(event: LLMStreamEvent): SSEEvent[] {
      const events: SSEEvent[] = []

      // Update metadata from event
      if (event.id) chunkId = event.id
      if (event.model) model = event.model

      // Handle start event
      if (event.type === 'start') {
        events.push({ event: 'data', data: buildChunk(startDelta) })
      }

      // Handle content delta
      if (event.type === 'content' && event.content?.delta) {
        events.push({
          event: 'data',
          data: buildChunk({ content: event.content.delta }),
        })
      }

      // Handle reasoning delta
      if (event.type === 'reasoning' && event.reasoning?.delta) {
        const format = options.reasoningFormat ?? 'content'

        if (format === 'skip') {
          // Do nothing
        } else if (format === 'reasoning_content') {
          events.push({
            event: 'data',
            data: buildChunk({ reasoning_content: event.reasoning.delta }),
          })
        } else if (format === 'content') {
          events.push({
            event: 'data',
            data: buildChunk({ content: event.reasoning.delta }),
          })
        } else if (typeof format === 'function') {
          const delta = format(event)
          if (delta) {
            events.push({ event: 'data', data: buildChunk(delta) })
          }
        }
      }

      // Handle tool call
      if (event.type === 'tool_call' && event.toolCall) {
        const toolIndex = event.toolCall.index ?? 0
        const toolCallDelta: Record<string, unknown> = { index: toolIndex }

        if (event.toolCall.name) {
          toolCallDelta.id = event.toolCall.id || `call_${Date.now()}_${toolIndex}`
          toolCallDelta.type = 'function'
          toolCallDelta.function = { name: event.toolCall.name }
          toolCallsState.set(toolIndex, {
            id: toolCallDelta.id as string,
            name: event.toolCall.name,
          })
        }

        if (event.toolCall.arguments) {
          toolCallDelta.function = {
            ...(toolCallDelta.function as Record<string, unknown> | undefined),
            arguments: event.toolCall.arguments,
          }
        }

        events.push({
          event: 'data',
          data: buildChunk({ tool_calls: [toolCallDelta] }),
        })
      }

      // Handle end event
      if (event.type === 'end') {
        const finishReason = mapFinishReason(event.finishReason)

        let usage: Record<string, unknown> | undefined
        if (event.usage) {
          if (options.buildUsage) {
            usage = options.buildUsage(event.usage)
          } else {
            usage = {
              prompt_tokens: event.usage.promptTokens ?? 0,
              completion_tokens: event.usage.completionTokens ?? 0,
              total_tokens: event.usage.totalTokens ?? 0,
            }
          }
        }

        events.push({
          event: 'data',
          data: buildChunk({}, finishReason, usage ? { usage } : undefined),
        })
      }

      // Handle error event
      if (event.type === 'error' && event.error) {
        if (options.buildError) {
          events.push({ event: 'data', data: options.buildError(event.error) })
        } else {
          events.push({
            event: 'data',
            data: {
              error: {
                message: event.error.message,
                type: 'server_error',
                code: event.error.code,
              },
            },
          })
        }
      }

      return events
    },

    finalize(): SSEEvent[] {
      return [{ event: 'data', data: '[DONE]' }]
    },
  }
}
