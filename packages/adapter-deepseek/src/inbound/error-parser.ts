import { parseOpenAICompatibleError } from '@amux/llm-bridge'
import type { LLMErrorIR } from '@amux/llm-bridge'

/**
 * Parse DeepSeek error to IR
 */
export function parseError(error: unknown): LLMErrorIR {
  return parseOpenAICompatibleError(error)
}
