import type { LLMResponseIR, Choice, Role } from '@amux.ai/llm-bridge'
import { mapFinishReason } from '@amux.ai/llm-bridge'

import type { DeepSeekResponse } from '../types'

/**
 * Parse DeepSeek response to IR
 */
export function parseResponse(response: unknown): LLMResponseIR {
  const res = response as DeepSeekResponse

  const choices: Choice[] = res.choices.map((choice) => ({
    index: choice.index,
    message: {
      role: choice.message.role as Role,
      content: choice.message.content ?? '',
      toolCalls: choice.message.tool_calls,
      // DeepSeek-specific: reasoning content
      reasoningContent: choice.message.reasoning_content,
    },
    finishReason: mapFinishReason(choice.finish_reason),
    logprobs: choice.logprobs,
  }))

  return {
    id: res.id,
    model: res.model,
    choices,
    created: res.created,
    systemFingerprint: res.system_fingerprint,
    usage: res.usage
      ? {
          promptTokens: res.usage.prompt_tokens,
          completionTokens: res.usage.completion_tokens,
          totalTokens: res.usage.total_tokens,
          details: {
            reasoningTokens: res.usage.completion_tokens_details?.reasoning_tokens,
            // DeepSeek-specific: cache tokens
            cachedTokens: res.usage.prompt_cache_hit_tokens,
          },
        }
      : undefined,
    // Store DeepSeek-specific cache info in extensions
    extensions: res.usage?.prompt_cache_hit_tokens !== undefined
      ? {
          deepseek: {
            promptCacheHitTokens: res.usage.prompt_cache_hit_tokens,
            promptCacheMissTokens: res.usage.prompt_cache_miss_tokens,
          },
        }
      : undefined,
    raw: response,
  }
}
