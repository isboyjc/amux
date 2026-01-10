import type { LLMResponseIR, ContentPart } from '@amux/llm-bridge'

import type { ZhipuResponse } from '../types'

/**
 * Convert content to string for Zhipu response
 */
function contentToString(content: string | ContentPart[]): string | null {
  if (typeof content === 'string') {
    return content || null
  }

  if (!content || content.length === 0) {
    return null
  }

  return content
    .filter((part) => part.type === 'text')
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('')
}

/**
 * Build Zhipu response from IR
 */
export function buildResponse(ir: LLMResponseIR): ZhipuResponse {
  return {
    id: ir.id,
    object: 'chat.completion',
    created: ir.created ?? Math.floor(Date.now() / 1000),
    model: ir.model,
    choices: ir.choices.map((choice) => ({
      index: choice.index,
      message: {
        role: choice.message.role,
        content: contentToString(choice.message.content),
        tool_calls: choice.message.toolCalls,
      },
      finish_reason: choice.finishReason ?? 'stop',
    })),
    usage: ir.usage
      ? {
          prompt_tokens: ir.usage.promptTokens,
          completion_tokens: ir.usage.completionTokens,
          total_tokens: ir.usage.totalTokens,
        }
      : undefined,
  }
}
