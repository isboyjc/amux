/**
 * Helper utilities for the proxy server
 */
import { Request, Response } from 'express'

/**
 * Extract API key from request headers
 */
export function extractApiKey(req: Request, headerName: string): string | null {
  const headerValue = req.headers[headerName.toLowerCase()]

  if (typeof headerValue === 'string') {
    // Handle Authorization: Bearer xxx format
    if (headerName.toLowerCase() === 'authorization' && headerValue.startsWith('Bearer ')) {
      return headerValue.slice(7)
    }
    return headerValue
  }

  return null
}

/**
 * Send error response in the appropriate format
 */
export function sendError(
  res: Response,
  status: number,
  type: string,
  message: string,
  format: 'anthropic' | 'openai'
) {
  if (format === 'anthropic') {
    res.status(status).json({
      type: 'error',
      error: { type, message },
    })
  } else {
    res.status(status).json({
      error: {
        message,
        type,
        code: status,
      },
    })
  }
}
