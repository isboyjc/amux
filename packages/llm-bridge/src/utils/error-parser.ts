import type { LLMErrorIR, ErrorType } from '../ir/error'
import type { FinishReason } from '../ir/response'

/**
 * Standard error type mappings used by OpenAI-compatible APIs
 */
const STANDARD_ERROR_TYPE_MAP: Record<string, ErrorType> = {
  invalid_request_error: 'validation',
  authentication_error: 'authentication',
  permission_error: 'permission',
  not_found_error: 'not_found',
  rate_limit_error: 'rate_limit',
  api_error: 'api',
  server_error: 'server',
  insufficient_quota: 'rate_limit', // Common in some providers
  invalid_api_key: 'authentication', // Zhipu-specific
}

/**
 * Standard error code mappings (used by some providers like Qwen)
 */
const STANDARD_ERROR_CODE_MAP: Record<string, ErrorType> = {
  InvalidParameter: 'validation',
  InvalidApiKey: 'authentication',
  AccessDenied: 'permission',
  ModelNotFound: 'not_found',
  Throttling: 'rate_limit',
  InternalError: 'server',
}

/**
 * Standard finish reason mappings used by OpenAI-compatible APIs
 */
const STANDARD_FINISH_REASON_MAP: Record<string, FinishReason> = {
  stop: 'stop',
  length: 'length',
  tool_calls: 'tool_calls',
  content_filter: 'content_filter',
  function_call: 'tool_calls', // Legacy OpenAI
  insufficient_system_resource: 'error', // DeepSeek-specific
  sensitive: 'content_filter', // Zhipu-specific
}

/**
 * Map finish reason string to IR finish reason
 * @param reason - The finish reason string from the provider
 * @param customMappings - Optional custom mappings to extend/override standard mappings
 * @param defaultReason - Default reason if not found (default: 'stop')
 */
export function mapFinishReason(
  reason?: string,
  customMappings?: Record<string, FinishReason>,
  defaultReason: FinishReason = 'stop'
): FinishReason {
  if (!reason) return defaultReason

  const reasonMap = customMappings
    ? { ...STANDARD_FINISH_REASON_MAP, ...customMappings }
    : STANDARD_FINISH_REASON_MAP

  return reasonMap[reason] ?? defaultReason
}

/**
 * Map error type or code string to IR error type
 * @param type - The error type string from the provider
 * @param code - The error code string from the provider (optional)
 * @param customTypeMappings - Optional custom type mappings to extend/override standard mappings
 * @param customCodeMappings - Optional custom code mappings to extend/override standard mappings
 */
export function mapErrorType(
  type?: string,
  code?: string,
  customTypeMappings?: Record<string, ErrorType>,
  customCodeMappings?: Record<string, ErrorType>
): ErrorType {
  // Try code first (more specific)
  if (code) {
    const codeMap = customCodeMappings
      ? { ...STANDARD_ERROR_CODE_MAP, ...customCodeMappings }
      : STANDARD_ERROR_CODE_MAP

    if (codeMap[code]) return codeMap[code]
  }

  // Fall back to type
  if (type) {
    const typeMap = customTypeMappings
      ? { ...STANDARD_ERROR_TYPE_MAP, ...customTypeMappings }
      : STANDARD_ERROR_TYPE_MAP

    return typeMap[type] ?? 'unknown'
  }

  return 'unknown'
}

/**
 * Parse OpenAI-compatible error response to IR
 * Works for OpenAI, DeepSeek, Moonshot, Qwen, Zhipu, and other compatible APIs
 *
 * @param error - The error object from the provider
 * @param customTypeMappings - Optional custom error type mappings
 * @param customCodeMappings - Optional custom error code mappings
 */
export function parseOpenAICompatibleError(
  error: unknown,
  customTypeMappings?: Record<string, ErrorType>,
  customCodeMappings?: Record<string, ErrorType>
): LLMErrorIR {
  // Check for standard OpenAI error format: { error: { message, type, code } }
  if (error && typeof error === 'object' && 'error' in error) {
    const err = (error as { error: { message: string; type?: string; code?: string } })
      .error

    return {
      type: mapErrorType(err.type, err.code, customTypeMappings, customCodeMappings),
      message: err.message,
      code: err.code,
      raw: error,
    }
  }

  // Fallback for non-standard error format
  return {
    type: 'unknown',
    message: String(error),
    raw: error,
  }
}
