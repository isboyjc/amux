/**
 * Base error class for all Amux errors
 */
export class LLMBridgeError extends Error {
  public code: string
  public retryable: boolean
  public details?: unknown

  constructor(
    message: string,
    code: string,
    retryable: boolean = false,
    details?: unknown
  ) {
    super(message)
    this.name = 'LLMBridgeError'
    this.code = code
    this.retryable = retryable
    this.details = details
    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * Error from provider API calls
 */
export class APIError extends LLMBridgeError {
  public status: number
  public provider: string
  public data?: unknown

  constructor(
    message: string,
    status: number,
    provider: string,
    data?: unknown
  ) {
    super(message, 'API_ERROR', status >= 500, data)
    this.name = 'APIError'
    this.status = status
    this.provider = provider
    this.data = data
  }
}

/**
 * Network-related errors (connection failures, timeouts, etc.)
 */
export class NetworkError extends LLMBridgeError {
  public override cause?: unknown

  constructor(message: string, cause?: unknown) {
    super(message, 'NETWORK_ERROR', true, cause)
    this.name = 'NetworkError'
    this.cause = cause
  }
}

/**
 * Request timeout errors
 */
export class TimeoutError extends LLMBridgeError {
  public timeout: number

  constructor(message: string, timeout: number) {
    super(message, 'TIMEOUT_ERROR', true, { timeout })
    this.name = 'TimeoutError'
    this.timeout = timeout
  }
}

/**
 * Validation errors (invalid request format, missing required fields, etc.)
 */
export class ValidationError extends LLMBridgeError {
  public errors: string[]

  constructor(message: string, errors: string[]) {
    super(message, 'VALIDATION_ERROR', false, { errors })
    this.name = 'ValidationError'
    this.errors = errors
  }
}

/**
 * Adapter-related errors (conversion failures, unsupported features, etc.)
 */
export class AdapterError extends LLMBridgeError {
  public adapterName: string

  constructor(
    message: string,
    adapterName: string,
    details?: unknown
  ) {
    super(message, 'ADAPTER_ERROR', false, details)
    this.name = 'AdapterError'
    this.adapterName = adapterName
  }
}

/**
 * Bridge orchestration errors
 */
export class BridgeError extends LLMBridgeError {
  constructor(message: string, details?: unknown) {
    super(message, 'BRIDGE_ERROR', false, details)
    this.name = 'BridgeError'
  }
}
