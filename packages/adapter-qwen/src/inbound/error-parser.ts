import type { LLMErrorIR, ErrorType } from '@llm-bridge/core'

import type { QwenError } from '../types'

/**
 * Parse Qwen error to IR
 */
export function parseError(error: unknown): LLMErrorIR {
  if (error && typeof error === 'object' && 'error' in error) {
    const err = (error as QwenError).error

    return {
      type: mapErrorType(err.type, err.code),
      message: err.message,
      code: err.code,
      raw: error,
    }
  }

  return {
    type: 'unknown',
    message: String(error),
    raw: error,
  }
}

function mapErrorType(type?: string, code?: string): ErrorType {
  if (!type && !code) return 'unknown'

  // Check code first for more specific errors
  if (code) {
    const codeMap: Record<string, ErrorType> = {
      InvalidParameter: 'validation',
      InvalidApiKey: 'authentication',
      AccessDenied: 'permission',
      ModelNotFound: 'not_found',
      Throttling: 'rate_limit',
      InternalError: 'server',
    }
    if (codeMap[code]) return codeMap[code]
  }

  // Fall back to type
  if (type) {
    const typeMap: Record<string, ErrorType> = {
      invalid_request_error: 'validation',
      authentication_error: 'authentication',
      permission_error: 'permission',
      not_found_error: 'not_found',
      rate_limit_error: 'rate_limit',
      api_error: 'api',
      server_error: 'server',
    }
    if (typeMap[type]) return typeMap[type]
  }

  return 'unknown'
}
