import type { LLMResponseIR } from '@amux/llm-bridge'
import { contentToString } from '@amux/llm-bridge'

import type { DeepSeekResponse } from '../types'

/**
 * Build DeepSeek response from IR
 */
export function buildResponse(ir: LLMResponseIR): DeepSeekResponse {
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
        // DeepSeek-specific: reasoning content
        reasoning_content: choice.message.reasoningContent,
      },
      finish_reason: choice.finishReason ?? 'stop',
      logprobs: choice.logprobs,
    })),
    usage: ir.usage
      ? {
          prompt_tokens: ir.usage.promptTokens,
          completion_tokens: ir.usage.completionTokens,
          total_tokens: ir.usage.totalTokens,
          // DeepSeek-specific: cache tokens
          prompt_cache_hit_tokens: ir.usage.details?.cachedTokens,
          prompt_cache_miss_tokens: (ir.extensions?.deepseek as { promptCacheMissTokens?: number } | undefined)?.promptCacheMissTokens,
          completion_tokens_details: ir.usage.details?.reasoningTokens
            ? {
                reasoning_tokens: ir.usage.details.reasoningTokens,
              }
            : undefined,
        }
      : undefined,
  }
}
