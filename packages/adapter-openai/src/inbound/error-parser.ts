import { parseOpenAICompatibleError } from '@amux/llm-bridge'
import type { LLMErrorIR } from '@amux/llm-bridge'

/**
 * Parse OpenAI error to IR
 */
export function parseError(error: unknown): LLMErrorIR {
  return parseOpenAICompatibleError(error)
}
