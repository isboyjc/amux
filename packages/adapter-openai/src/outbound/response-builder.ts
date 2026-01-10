import type { LLMResponseIR, ContentPart } from '@amux/llm-bridge'

import type { OpenAIResponse } from '../types'

/**
 * Convert content to string for OpenAI response
 */
function contentToString(content: string | ContentPart[]): string | null {
  if (typeof content === 'string') {
    return content || null
  }

  if (!content || content.length === 0) {
    return null
  }

  // Concatenate text parts
  return content
    .filter((part) => part.type === 'text')
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('')
}

/**
 * Build OpenAI response from IR
 */
export function buildResponse(ir: LLMResponseIR): OpenAIResponse {
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
      },
      finish_reason: choice.finishReason ?? 'stop',
      logprobs: choice.logprobs,
    })),
    usage: ir.usage
      ? {
          prompt_tokens: ir.usage.promptTokens,
          completion_tokens: ir.usage.completionTokens,
          total_tokens: ir.usage.totalTokens,
          completion_tokens_details: ir.usage.details?.reasoningTokens
            ? {
                reasoning_tokens: ir.usage.details.reasoningTokens,
              }
            : undefined,
        }
      : undefined,
  }
}
