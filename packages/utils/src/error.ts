/**
 * Standard error class for LLM Bridge
 */
export class LLMBridgeError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'LLMBridgeError'
  }
}

/**
 * Normalize error to standard format
 */
export function normalizeError(error: unknown): {
  message: string
  code?: string
  status?: number
  details?: Record<string, unknown>
} {
  if (error instanceof LLMBridgeError) {
    return {
      message: error.message,
      code: error.code,
      status: error.status,
      details: error.details,
    }
  }

  if (error instanceof Error) {
    return {
      message: error.message,
    }
  }

  return {
    message: String(error),
  }
}
