import type { LLMResponseIR, ContentPart } from '@llm-bridge/core'

import type { QwenResponse } from '../types'

/**
 * Convert content to string for Qwen response
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
 * Build Qwen response from IR
 */
export function buildResponse(ir: LLMResponseIR): QwenResponse {
  return {
    id: ir.id,
    object: 'chat.completion',
    created: ir.created ?? Math.floor(Date.now() / 1000),
    model: ir.model,
    system_fingerprint: ir.systemFingerprint,
    choices: ir.choices.map((choice) => ({
      index: choice.index,
      message: {
        role: choice.message.role,
        content: contentToString(choice.message.content),
        tool_calls: choice.message.toolCalls,
        // Qwen-specific: reasoning content
        reasoning_content: choice.message.reasoningContent,
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
