import { Bridge } from './bridge'
import type { BridgeOptions, LLMBridge } from './types'

/**
 * Create a new LLM Bridge instance
 *
 * @example
 * ```typescript
 * import { createBridge } from '@llm-bridge/core'
 * import { openaiAdapter } from '@llm-bridge/adapter-openai'
 * import { anthropicAdapter } from '@llm-bridge/adapter-anthropic'
 *
 * const bridge = createBridge({
 *   inbound: openaiAdapter,
 *   outbound: anthropicAdapter,
 *   config: {
 *     apiKey: process.env.ANTHROPIC_API_KEY,
 *   }
 * })
 *
 * const response = await bridge.chat({
 *   model: 'gpt-4',
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * })
 * ```
 */
export function createBridge(options: BridgeOptions): LLMBridge {
  return new Bridge(options)
}
