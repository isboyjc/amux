import type { LLMErrorIR, ErrorType } from '@amux.ai/llm-bridge'

import type { GeminiError } from '../types'

/**
 * Parse Gemini error to IR
 */
export function parseError(error: unknown): LLMErrorIR {
  if (error && typeof error === 'object' && 'error' in error) {
    const err = (error as GeminiError).error

    return {
      type: mapErrorType(err.status, err.code),
      message: err.message,
      code: err.status,
      status: err.code,
      raw: error,
    }
  }

  return {
    type: 'unknown',
    message: String(error),
    raw: error,
  }
}

function mapErrorType(status?: string, code?: number): ErrorType {
  if (code) {
    const codeMap: Record<number, ErrorType> = {
      400: 'validation',
      401: 'authentication',
      403: 'permission',
      404: 'not_found',
      429: 'rate_limit',
      500: 'server',
    }
    if (codeMap[code]) return codeMap[code]
  }

  if (status) {
    const statusMap: Record<string, ErrorType> = {
      INVALID_ARGUMENT: 'validation',
      UNAUTHENTICATED: 'authentication',
      PERMISSION_DENIED: 'permission',
      NOT_FOUND: 'not_found',
      RESOURCE_EXHAUSTED: 'rate_limit',
      INTERNAL: 'server',
    }
    if (statusMap[status]) return statusMap[status]
  }

  return 'unknown'
}
