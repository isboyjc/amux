import type { LLMStreamEvent } from '@amux/llm-bridge'

import type { AnthropicStreamEvent } from '../types'

/**
 * Parse Anthropic stream event to IR stream event
 */
export function parseStream(
  chunk: unknown
): LLMStreamEvent | LLMStreamEvent[] | null {
  const event = chunk as AnthropicStreamEvent

  switch (event.type) {
    case 'message_start':
      return {
        type: 'start',
        id: event.message?.id,
        model: event.message?.model,
        raw: chunk,
      }

    case 'content_block_start':
      if (event.content_block?.type === 'text') {
        return {
          type: 'content',
          content: {
            type: 'content',
            delta: '',
            index: event.index,
          },
          raw: chunk,
        }
      }
      if (event.content_block?.type === 'tool_use') {
        return {
          type: 'tool_call',
          toolCall: {
            type: 'tool_call',
            id: event.content_block.id,
            name: event.content_block.name,
            index: event.index,
          },
          raw: chunk,
        }
      }
      return null

    case 'content_block_delta':
      if (event.delta?.type === 'text_delta' && event.delta.text !== undefined) {
        return {
          type: 'content',
          content: {
            type: 'content',
            delta: event.delta.text,
            index: event.index,
          },
          raw: chunk,
        }
      }
      if (event.delta?.type === 'input_json_delta' && event.delta.partial_json !== undefined) {
        return {
          type: 'tool_call',
          toolCall: {
            type: 'tool_call',
            arguments: event.delta.partial_json,
            index: event.index,
          },
          raw: chunk,
        }
      }
      return null

    case 'content_block_stop':
      return null

    case 'message_delta':
      if (event.delta?.stop_reason) {
        return {
          type: 'end',
          finishReason: mapStopReason(event.delta.stop_reason),
          raw: chunk,
        }
      }
      return null

    case 'message_stop':
      return {
        type: 'end',
        raw: chunk,
      }

    default:
      return null
  }
}

function mapStopReason(reason: string): LLMStreamEvent['finishReason'] {
  const reasonMap: Record<string, LLMStreamEvent['finishReason']> = {
    'end_turn': 'stop',
    'max_tokens': 'length',
    'stop_sequence': 'stop',
    'tool_use': 'tool_calls',
  }
  return reasonMap[reason] ?? 'stop'
}
