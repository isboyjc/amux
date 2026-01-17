import type { HTTPRequestOptions, HTTPResponse } from './types'
import { APIError, NetworkError, TimeoutError } from '../errors'

/**
 * Simple HTTP client for making requests to LLM APIs
 */
export class HTTPClient {
  private defaultHeaders: Record<string, string>
  private defaultTimeout: number
  private maxRetries: number
  private provider: string
  private maxResponseSize: number

  constructor(options?: {
    headers?: Record<string, string>
    timeout?: number
    maxRetries?: number
    provider?: string
    maxResponseSize?: number
  }) {
    this.defaultHeaders = options?.headers ?? {}
    this.defaultTimeout = options?.timeout ?? 60000 // 60 seconds
    this.maxRetries = options?.maxRetries ?? 3
    this.provider = options?.provider ?? 'unknown'
    this.maxResponseSize = options?.maxResponseSize ?? 100 * 1024 * 1024 // 100MB default
  }

  /**
   * Determine if a status code should be retried
   * @private
   */
  private shouldRetry(status: number): boolean {
    // Retry on: timeout, rate limit, and server errors
    const retryableStatuses = [408, 429, 500, 502, 503, 504]
    return retryableStatuses.includes(status)
  }

  /**
   * Calculate backoff delay with jitter
   * @private
   */
  private getBackoffDelay(attempt: number, retryAfter?: number): number {
    // If server provides Retry-After header, use it
    if (retryAfter !== undefined && retryAfter > 0) {
      return retryAfter * 1000 // Convert to milliseconds
    }

    // Exponential backoff with jitter
    const baseDelay = Math.pow(2, attempt) * 1000
    const jitter = Math.random() * baseDelay * 0.1
    return baseDelay + jitter
  }

  /**
   * Make an HTTP request with retry logic
   */
  async request<T = unknown>(
    options: HTTPRequestOptions,
    retries: number = 0
  ): Promise<HTTPResponse<T>> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, options.timeout ?? this.defaultTimeout)

    try {
      const response = await fetch(options.url, {
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          ...this.defaultHeaders,
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: options.signal ?? controller.signal,
      })

      clearTimeout(timeoutId)

      // Check response size limit
      const contentLength = response.headers.get('content-length')
      if (contentLength) {
        const size = parseInt(contentLength, 10)
        if (size > this.maxResponseSize) {
          throw new NetworkError(
            `Response size (${size} bytes) exceeds maximum allowed size (${this.maxResponseSize} bytes)`
          )
        }
      }

      // Check HTTP status
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const headers = Object.fromEntries(response.headers.entries())
        throw new APIError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          this.provider,
          errorData,
          { headers }
        )
      }

      const data = (await response.json()) as T

      return {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data,
      }
    } catch (error) {
      clearTimeout(timeoutId)

      // Return APIError as-is
      if (error instanceof APIError) {
        // Retry on retryable status codes
        if (this.shouldRetry(error.status) && retries < this.maxRetries) {
          // Check for Retry-After header
          const retryAfter = error.response?.headers?.['retry-after']
          const retryAfterSeconds = retryAfter
            ? parseInt(retryAfter, 10)
            : undefined
          const delay = this.getBackoffDelay(retries, retryAfterSeconds)
          await new Promise((resolve) => setTimeout(resolve, delay))
          return this.request(options, retries + 1)
        }
        throw error
      }

      // Handle abort/timeout errors
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new TimeoutError(
          'Request timeout',
          options.timeout ?? this.defaultTimeout
        )
        // Retry on timeout
        if (retries < this.maxRetries) {
          const delay = this.getBackoffDelay(retries)
          await new Promise((resolve) => setTimeout(resolve, delay))
          return this.request(options, retries + 1)
        }
        throw timeoutError
      }

      // Wrap other errors as NetworkError
      const networkError = new NetworkError('Network request failed', error)
      // Retry on network errors
      if (retries < this.maxRetries) {
        const delay = this.getBackoffDelay(retries)
        await new Promise((resolve) => setTimeout(resolve, delay))
        return this.request(options, retries + 1)
      }
      throw networkError
    }
  }

  /**
   * Make a streaming HTTP request
   */
  async *requestStream(
    options: HTTPRequestOptions
  ): AsyncIterable<string> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, options.timeout ?? this.defaultTimeout)

    try {
      const response = await fetch(options.url, {
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...this.defaultHeaders,
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: options.signal ?? controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const headers = Object.fromEntries(response.headers.entries())
        throw new APIError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          this.provider,
          errorData,
          { headers }
        )
      }

      if (!response.body) {
        throw new NetworkError('Response body is null')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      let totalBytes = 0

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          // Check total received bytes
          totalBytes += value.length
          if (totalBytes > this.maxResponseSize) {
            throw new NetworkError(
              `Streaming response size (${totalBytes} bytes) exceeds maximum allowed size (${this.maxResponseSize} bytes)`
            )
          }

          const chunk = decoder.decode(value, { stream: true })
          yield chunk
        }
      } finally {
        reader.releaseLock()
      }
    } catch (error) {
      clearTimeout(timeoutId)

      // Return APIError as-is
      if (error instanceof APIError) {
        throw error
      }

      // Handle abort/timeout errors
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(
          'Request timeout',
          options.timeout ?? this.defaultTimeout
        )
      }

      // Wrap other errors as NetworkError
      if (error instanceof NetworkError) {
        throw error
      }
      throw new NetworkError('Network request failed', error)
    }
  }
}
