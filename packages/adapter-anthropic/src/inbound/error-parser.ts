import type { LLMErrorIR, ErrorType } from '@amux/llm-bridge'

/**
 * Anthropic error format
 */
interface AnthropicError {
  type: 'error'
  error: {
    type: string
    message: string
  }
}

/**
 * Parse Anthropic error to IR
 */
export function parseError(error: unknown): LLMErrorIR {
  if (error && typeof error === 'object') {
    // Check for Anthropic error format
    if ('type' in error && (error as AnthropicError).type === 'error' && 'error' in error) {
      const err = (error as AnthropicError).error

      return {
        type: mapErrorType(err.type),
        message: err.message,
        code: err.type,
        raw: error,
      }
    }

    // Check for standard error format
    if ('error' in error) {
      const err = (error as { error: { type?: string; message: string } }).error

      return {
        type: mapErrorType(err.type),
        message: err.message,
        code: err.type,
        raw: error,
      }
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
    invalid_request_error: 'validation',
    authentication_error: 'authentication',
    permission_error: 'permission',
    not_found_error: 'not_found',
    rate_limit_error: 'rate_limit',
    api_error: 'api',
    overloaded_error: 'server',
  }

  return typeMap[type] ?? 'unknown'
}
