import type { LLMResponseIR } from '@amux.ai/llm-bridge'
import { contentToString } from '@amux.ai/llm-bridge'

import type { OpenAIResponse } from '../types'

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
