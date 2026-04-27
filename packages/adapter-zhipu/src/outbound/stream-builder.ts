import { createOpenAICompatStreamBuilder } from '@amux.ai/llm-bridge'
import type { StreamEventBuilder } from '@amux.ai/llm-bridge'

/**
 * Zhipu stream event builder
 * No reasoning support; adds 'sensitive' → 'content_filter' finish reason.
 */
export function createStreamBuilder(): StreamEventBuilder {
  return createOpenAICompatStreamBuilder({
    reasoningFormat: 'skip',
    extraFinishReasons: {
      sensitive: 'content_filter',
    },
  })
}
