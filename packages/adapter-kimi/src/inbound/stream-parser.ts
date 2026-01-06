import type { LLMStreamEvent, FinishReason } from '@llm-bridge/core'

import type { KimiStreamChunk } from '../types'

/**
 * Map Kimi finish reason to IR finish reason
 */
function mapFinishReason(reason: string): FinishReason {
  const reasonMap: Record<string, FinishReason> = {
    stop: 'stop',
    length: 'length',
    tool_calls: 'tool_calls',
    content_filter: 'content_filter',
  }
  return reasonMap[reason] ?? 'stop'
}

/**
 * Parse Kimi stream chunk to IR stream event
 */
export function parseStream(
  chunk: unknown
): LLMStreamEvent | LLMStreamEvent[] | null {
  const data = chunk as KimiStreamChunk

  if (!data.choices || data.choices.length === 0) {
    // Check for usage-only chunk
    if (data.usage) {
      return {
        type: 'end',
        id: data.id,
        model: data.model,
        usage: {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        },
        raw: chunk,
      }
    }
    return null
  }

  const choice = data.choices[0]
  const delta = choice.delta

  // Start event (first chunk with role)
  if (delta.role && !delta.content && !delta.tool_calls) {
    return {
      type: 'start',
      id: data.id,
      model: data.model,
      raw: chunk,
    }
  }

  // Content delta
  if (delta.content) {
    return {
      type: 'content',
      id: data.id,
      model: data.model,
      content: {
        type: 'content',
        delta: delta.content,
        index: choice.index,
      },
      raw: chunk,
    }
  }

  // Tool call delta
  if (delta.tool_calls && delta.tool_calls.length > 0) {
    const toolCall = delta.tool_calls[0]
    return {
      type: 'tool_call',
      id: data.id,
      model: data.model,
      toolCall: {
        type: 'tool_call',
        id: toolCall.id,
        name: toolCall.function?.name,
        arguments: toolCall.function?.arguments,
        index: toolCall.index,
      },
      raw: chunk,
    }
  }

  // End event
  if (choice.finish_reason) {
    return {
      type: 'end',
      id: data.id,
      model: data.model,
      finishReason: mapFinishReason(choice.finish_reason),
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      raw: chunk,
    }
  }

  return null
}
