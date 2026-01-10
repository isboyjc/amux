import type { LLMResponseIR, Choice, Message, ContentPart, ToolCall } from '@amux/llm-bridge'

import type { AnthropicResponse, AnthropicContent } from '../types'

/**
 * Parse Anthropic response to IR
 */
export function parseResponse(response: unknown): LLMResponseIR {
  const res = response as AnthropicResponse

  // Parse content - separate text/image from tool_use
  const contentParts: ContentPart[] = []
  const toolCalls: ToolCall[] = []

  for (const part of res.content) {
    if (part.type === 'tool_use') {
      // Convert tool_use to OpenAI-style toolCalls
      toolCalls.push({
        id: part.id,
        type: 'function',
        function: {
          name: part.name,
          arguments: JSON.stringify(part.input),
        },
      })
    } else {
      contentParts.push(parseContentPart(part))
    }
  }

  const message: Message = {
    role: 'assistant',
    content: contentParts.length === 1 && contentParts[0]?.type === 'text'
      ? contentParts[0].text
      : contentParts.length > 0
      ? contentParts
      : '',
  }

  // Add toolCalls if present
  if (toolCalls.length > 0) {
    message.toolCalls = toolCalls
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
