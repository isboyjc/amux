import { createOpenAICompatStreamBuilder } from '@amux.ai/llm-bridge'
import type { StreamEventBuilder } from '@amux.ai/llm-bridge'

import type { MinimaxReasoningDetail } from '../types'

/**
 * MiniMax stream event builder
 * Uses reasoning_details array format and includes reasoning_tokens in usage.
 */
export function createStreamBuilder(): StreamEventBuilder {
  return createOpenAICompatStreamBuilder({
    chunkIdPrefix: 'minimax',
    startDelta: { role: 'assistant' },
    reasoningFormat: (event) => {
      if (!event.reasoning?.delta) return null
      const reasoningDetails: MinimaxReasoningDetail[] = [
        { type: 'thinking', text: event.reasoning.delta },
      ]
      return { reasoning_details: reasoningDetails }
    },
    extraFinishReasons: {
      error: 'stop',
    },
    buildUsage: (usage) => {
      if (!usage) return undefined
      return {
        prompt_tokens: usage.promptTokens ?? 0,
        completion_tokens: usage.completionTokens ?? 0,
        total_tokens: usage.totalTokens ?? 0,
        completion_tokens_details: usage.details?.reasoningTokens
          ? { reasoning_tokens: usage.details.reasoningTokens }
          : undefined,
      }
    },
    buildError: (error) => ({
      error: {
        message: error.message,
        type: error.type,
        code: error.code,
      },
    }),
  })
}
