import type { LLMStreamEvent, FinishReason } from '@amux.ai/llm-bridge'

import type { ResponsesStreamEvent } from '../types'

/**
 * Map Responses API status to IR finish reason
 */
function mapFinishReason(status: string): FinishReason {
  const statusMap: Record<string, FinishReason> = {
    completed: 'stop',
    failed: 'stop',
    incomplete: 'length',
  }
  return statusMap[status] ?? 'stop'
}

/**
 * Parse Responses API stream event to IR stream event
 */
export function parseResponsesStream(
  chunk: unknown
): LLMStreamEvent | LLMStreamEvent[] | null {
  const event = chunk as ResponsesStreamEvent

  switch (event.type) {
    case 'response.created':
    case 'response.in_progress':
      return {
        type: 'start',
        id: event.response?.id ?? '',
        model: event.response?.model ?? '',
        raw: chunk,
      }

    case 'response.output_text.delta':
      return {
        type: 'content',
        id: '',
        model: '',
        content: {
          type: 'content',
          delta: event.delta ?? '',
          index: event.output_index ?? 0,
        },
        raw: chunk,
      }

    case 'response.reasoning_summary_text.delta':
      return {
        type: 'reasoning',
        id: '',
        model: '',
        reasoning: {
          type: 'reasoning',
          delta: event.delta ?? '',
        },
        raw: chunk,
      }

    case 'response.function_call_arguments.delta':
      return {
        type: 'tool_call',
        id: '',
        model: '',
        toolCall: {
          type: 'tool_call',
          arguments: event.delta,
          index: event.output_index ?? 0,
        },
        raw: chunk,
      }

    case 'response.output_item.added':
      if (event.item?.type === 'function_call') {
        return {
          type: 'tool_call',
          id: '',
          model: '',
          toolCall: {
            type: 'tool_call',
            id: event.item.call_id,
            name: event.item.name,
            index: event.output_index ?? 0,
          },
          raw: chunk,
        }
      }
      return null

    case 'response.completed':
    case 'response.failed':
    case 'response.incomplete':
      return {
        type: 'end',
        id: event.response?.id ?? '',
        model: event.response?.model ?? '',
        finishReason: mapFinishReason(event.response?.status ?? 'completed'),
        usage: event.response?.usage
          ? {
              promptTokens: event.response.usage.input_tokens,
              completionTokens: event.response.usage.output_tokens,
              totalTokens: event.response.usage.total_tokens,
              details: event.response.usage.output_tokens_details?.reasoning_tokens
                ? {
                    reasoningTokens: event.response.usage.output_tokens_details.reasoning_tokens,
                  }
                : undefined,
            }
          : undefined,
        raw: chunk,
      }

    case 'error':
      return {
        type: 'error',
        id: '',
        model: '',
        error: {
          type: 'api',
          message: event.error?.message ?? 'Unknown error',
          code: event.error?.code,
        },
        raw: chunk,
      }

    default:
      return null
  }
}
