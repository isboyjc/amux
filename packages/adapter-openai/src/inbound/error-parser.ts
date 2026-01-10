import type { LLMErrorIR, ErrorType } from '@amux/llm-bridge'

/**
 * Parse OpenAI error to IR
 */
export function parseError(error: unknown): LLMErrorIR {
  if (error && typeof error === 'object' && 'error' in error) {
    const err = (error as { error: { message: string; type?: string; code?: string } }).error

    return {
      type: mapErrorType(err.type),
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

function mapErrorType(type?: string): ErrorType {
  if (!type) return 'unknown'

  const typeMap: Record<string, ErrorType> = {
    'invalid_request_error': 'validation',
    'authentication_error': 'authentication',
    'permission_error': 'permission',
    'not_found_error': 'not_found',
    'rate_limit_error': 'rate_limit',
    'api_error': 'api',
    'server_error': 'server',
  }

  return typeMap[type] ?? 'unknown'
}
