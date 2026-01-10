import type { LLMResponseIR, Message, ContentPart } from '@amux/llm-bridge'

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
  const content: AnthropicContent[] = []

  // Build content from message content
  if (typeof message.content === 'string') {
    if (message.content) {
      content.push({ type: 'text', text: message.content })
    }
  } else if (Array.isArray(message.content)) {
    for (const part of message.content) {
      content.push(buildContentPart(part))
    }
  }

  // Convert toolCalls to tool_use content
  if (message.toolCalls && message.toolCalls.length > 0) {
    for (const toolCall of message.toolCalls) {
      content.push({
        type: 'tool_use',
        id: toolCall.id,
        name: toolCall.function.name,
        input: JSON.parse(toolCall.function.arguments),
      })
    }
  }

  // If no content, add empty text
  if (content.length === 0) {
    content.push({ type: 'text', text: '' })
  }

  return content
}

function buildContentPart(part: ContentPart): AnthropicContent {
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

function mapFinishReason(reason?: string): string {
  if (!reason) return 'end_turn'

  const reasonMap: Record<string, string> = {
    'stop': 'end_turn',
    'length': 'max_tokens',
    'tool_calls': 'tool_use',
  }

  return reasonMap[reason] ?? 'end_turn'
}
