import type { Usage } from '../ir/response'

/**
 * Standard OpenAI-compatible usage object structure
 */
export interface StandardUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  completion_tokens_details?: {
    reasoning_tokens?: number
  }
  prompt_cache_hit_tokens?: number // DeepSeek
  prompt_cache_miss_tokens?: number // DeepSeek
}

/**
 * Parse OpenAI-compatible usage to IR usage
 * @param usage - Usage object from provider response
 * @returns IR usage object or undefined
 */
export function parseOpenAIUsage(usage?: StandardUsage): Usage | undefined {
  if (!usage) return undefined

  return {
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
    details:
      usage.completion_tokens_details?.reasoning_tokens ||
      usage.prompt_cache_hit_tokens
        ? {
            reasoningTokens: usage.completion_tokens_details?.reasoning_tokens,
            cachedTokens: usage.prompt_cache_hit_tokens,
          }
        : undefined,
  }
}

/**
 * Build OpenAI-compatible usage from IR usage
 * @param usage - IR usage object
 * @param includeReasoningTokens - Whether to include reasoning tokens (default: true)
 * @param includeCacheTokens - Whether to include cache tokens (default: false)
 * @returns OpenAI-compatible usage object or undefined
 */
export function buildOpenAIUsage(
  usage?: Usage,
  includeReasoningTokens: boolean = true,
  includeCacheTokens: boolean = false
): StandardUsage | undefined {
  if (!usage) return undefined

  const result: StandardUsage = {
    prompt_tokens: usage.promptTokens,
    completion_tokens: usage.completionTokens,
    total_tokens: usage.totalTokens,
  }

  // Add reasoning tokens if requested and available
  if (includeReasoningTokens && usage.details?.reasoningTokens) {
    result.completion_tokens_details = {
      reasoning_tokens: usage.details.reasoningTokens,
    }
  }

  // Add cache tokens if requested and available (DeepSeek-specific)
  if (includeCacheTokens && usage.details?.cachedTokens) {
    result.prompt_cache_hit_tokens = usage.details.cachedTokens
  }

  return result
}
