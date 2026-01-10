/**
 * Error types
 */
export type ErrorType =
  | 'network' // Network error
  | 'api' // API error
  | 'validation' // Validation error
  | 'rate_limit' // Rate limit error
  | 'authentication' // Authentication error
  | 'permission' // Permission error
  | 'not_found' // Resource not found
  | 'server' // Server error
  | 'unknown' // Unknown error

/**
 * Unified error structure
 */
export interface LLMErrorIR {
  /**
   * Error type
   */
  type: ErrorType

  /**
   * Error message
   */
  message: string

  /**
   * Error code (provider-specific)
   */
  code?: string

  /**
   * HTTP status code
   */
  status?: number

  /**
   * Whether the error is retryable
   */
  retryable?: boolean

  /**
   * Additional error details
   */
  details?: {
    [key: string]: unknown
  }

  /**
   * Original error (for debugging)
   */
  raw?: unknown
}
