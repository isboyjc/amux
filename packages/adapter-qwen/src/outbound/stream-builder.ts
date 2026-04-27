import { createOpenAICompatStreamBuilder } from '@amux.ai/llm-bridge'
import type { StreamEventBuilder } from '@amux.ai/llm-bridge'

/**
 * Qwen stream event builder
 * Uses reasoning_content field for thinking process (QwQ model).
 */
export function createStreamBuilder(): StreamEventBuilder {
  return createOpenAICompatStreamBuilder({
    reasoningFormat: 'reasoning_content',
  })
}
