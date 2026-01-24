import { parseOpenAICompatibleError } from '@amux.ai/llm-bridge'
import type { LLMErrorIR } from '@amux.ai/llm-bridge'

/**
 * Parse DeepSeek error to IR
 */
export function parseError(error: unknown): LLMErrorIR {
  return parseOpenAICompatibleError(error)
}
