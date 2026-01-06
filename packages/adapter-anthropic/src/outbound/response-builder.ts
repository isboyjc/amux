import type { LLMResponseIR, Message, ContentPart } from '@llm-bridge/core'

import type { AnthropicResponse, AnthropicContent } from '../types'

/**
 * Build Anthropic response from IR
 */
export function buildResponse(ir: LLMResponseIR): AnthropicResponse {
  const choice = ir.choices[0]
  if (!choice) {
    throw new Error('No choices in response')
  }

  // Build content
  const content: AnthropicContent[] = buildContent(choice.message)

  return {
    id: ir.id,
    type: 'message',
    role: 'assistant',
    content,
    model: ir.model,
    stop_reason: mapFinishReason(choice.finishReason),
    stop_sequence: null,
    usage: {
      input_tokens: ir.usage?.promptTokens ?? 0,
      output_tokens: ir.usage?.completionTokens ?? 0,
    },
  }
}

function buildContent(message: Message): AnthropicContent[] {
  if (typeof message.content === 'string') {
    return [{ type: 'text', text: message.content }]
  }

  return message.content.map((part) => buildContentPart(part))
}

function buildContentPart(part: ContentPart): AnthropicContent {
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

function mapFinishReason(reason?: string): string {
  if (!reason) return 'end_turn'

  const reasonMap: Record<string, string> = {
    'stop': 'end_turn',
    'length': 'max_tokens',
    'tool_calls': 'tool_use',
  }

  return reasonMap[reason] ?? 'end_turn'
}
