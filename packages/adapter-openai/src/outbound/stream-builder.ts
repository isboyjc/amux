import { createOpenAICompatStreamBuilder } from '@amux.ai/llm-bridge'
import type { StreamEventBuilder } from '@amux.ai/llm-bridge'

/**
 * OpenAI stream event builder
 * Uses shared OpenAI-compatible builder with default settings.
 * Reasoning events are folded into content (OpenAI doesn't have a separate reasoning field).
 */
export function createStreamBuilder(): StreamEventBuilder {
  return createOpenAICompatStreamBuilder({
    reasoningFormat: 'content',
  })
}
