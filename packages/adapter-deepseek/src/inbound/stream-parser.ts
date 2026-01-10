import type { LLMStreamEvent, FinishReason } from '@amux/llm-bridge'

import type { DeepSeekStreamChunk } from '../types'

/**
 * Map DeepSeek finish reason to IR finish reason
 */
function mapFinishReason(reason: string): FinishReason {
  const reasonMap: Record<string, FinishReason> = {
    stop: 'stop',
    length: 'length',
    tool_calls: 'tool_calls',
    content_filter: 'content_filter',
    insufficient_system_resource: 'error',
  }
  return reasonMap[reason] ?? 'stop'
}

/**
 * Parse DeepSeek stream chunk to IR stream event
 */
export function parseStream(
  chunk: unknown
): LLMStreamEvent | LLMStreamEvent[] | null {
  const data = chunk as DeepSeekStreamChunk

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
          details: {
            reasoningTokens: data.usage.completion_tokens_details?.reasoning_tokens,
            cachedTokens: data.usage.prompt_cache_hit_tokens,
          },
        },
        raw: chunk,
      }
    }
    return null
  }

  const choice = data.choices[0]
  if (!choice) return null

  const delta = choice.delta
  const events: LLMStreamEvent[] = []

  // Start event (first chunk with role)
  if (delta.role && !delta.content && !delta.tool_calls && !delta.reasoning_content) {
    return {
      type: 'start',
      id: data.id,
      model: data.model,
      raw: chunk,
    }
  }

  // DeepSeek-specific: Reasoning content delta
  if (delta.reasoning_content) {
    events.push({
      type: 'reasoning',
      id: data.id,
      model: data.model,
      reasoning: {
        type: 'reasoning',
        delta: delta.reasoning_content,
        index: choice.index,
      },
      raw: chunk,
    })
  }

  // Content delta
  if (delta.content) {
    events.push({
      type: 'content',
      id: data.id,
      model: data.model,
      content: {
        type: 'content',
        delta: delta.content,
        index: choice.index,
      },
      raw: chunk,
    })
  }

  // Tool call delta
  if (delta.tool_calls && delta.tool_calls.length > 0) {
    const toolCall = delta.tool_calls[0]
    if (toolCall) {
      events.push({
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
      })
    }
  }

  // End event
  if (choice.finish_reason) {
    events.push({
      type: 'end',
      id: data.id,
      model: data.model,
      finishReason: mapFinishReason(choice.finish_reason),
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
            details: {
              reasoningTokens: data.usage.completion_tokens_details?.reasoning_tokens,
              cachedTokens: data.usage.prompt_cache_hit_tokens,
            },
          }
        : undefined,
      raw: chunk,
    })
  }

  if (events.length === 0) {
    return null
  }

  const firstEvent = events[0]
  return events.length === 1 && firstEvent ? firstEvent : events
}
