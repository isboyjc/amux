import type { LLMErrorIR } from '@amux.ai/llm-bridge'

import type { MinimaxError } from '../types'

/**
 * Parse MiniMax error to IR
 */
export function parseError(error: unknown): LLMErrorIR {
  // Handle axios error format
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'data' in error.response
  ) {
    const data = error.response.data as MinimaxError
    if (data.error) {
      return {
        type: 'api',
        message: data.error.message,
        code: data.error.code,
        raw: error,
      }
    }
  }

  // Handle direct error format
  if (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    typeof error.error === 'object' &&
    error.error !== null
  ) {
    const err = error as MinimaxError
    return {
      type: 'api',
      message: err.error.message,
      code: err.error.code,
      raw: error,
    }
  }

  // Handle generic error
  return {
    type: 'unknown',
    message: error instanceof Error ? error.message : String(error),
    raw: error,
  }
}
