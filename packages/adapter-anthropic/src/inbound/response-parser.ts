import type { LLMResponseIR, Choice, Message, ContentPart } from '@llm-bridge/core'

import type { AnthropicResponse, AnthropicContent } from '../types'

/**
 * Parse Anthropic response to IR
 */
export function parseResponse(response: unknown): LLMResponseIR {
  const res = response as AnthropicResponse

  // Parse content
  const contentParts: ContentPart[] = res.content.map((part) => parseContentPart(part))

  const message: Message = {
    role: 'assistant',
    content: contentParts.length === 1 && contentParts[0]?.type === 'text'
      ? (contentParts[0] as { text: string }).text
      : contentParts,
  }

  const choice: Choice = {
    index: 0,
    message,
    finishReason: mapStopReason(res.stop_reason),
  }

  return {
    id: res.id,
    model: res.model,
    choices: [choice],
    usage: {
      promptTokens: res.usage.input_tokens,
      completionTokens: res.usage.output_tokens,
      totalTokens: res.usage.input_tokens + res.usage.output_tokens,
    },
    raw: response,
  }
}

function parseContentPart(part: AnthropicContent): ContentPart {
  switch (part.type) {
    case 'text':
      return {
        type: 'text',
        text: part.text,
      }
    case 'tool_use':
      return {
        type: 'tool_use',
        id: part.id,
        name: part.name,
        input: part.input,
      }
    default:
      return {
        type: 'text',
        text: JSON.stringify(part),
      }
  }
}

function mapStopReason(reason: string | null): Choice['finishReason'] {
  if (!reason) return 'stop'

  const reasonMap: Record<string, Choice['finishReason']> = {
    'end_turn': 'stop',
    'max_tokens': 'length',
    'stop_sequence': 'stop',
    'tool_use': 'tool_calls',
  }

  return reasonMap[reason] ?? 'stop'
}
