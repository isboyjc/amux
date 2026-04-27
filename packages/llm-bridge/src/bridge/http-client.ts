import { APIError, NetworkError, TimeoutError } from '../errors'

import type { HTTPRequestOptions, HTTPResponse } from './types'

/**
 * Simple HTTP client for making requests to LLM APIs
 */
export class HTTPClient {
  private defaultHeaders: Record<string, string>
  private defaultTimeout: number
  private maxRetries: number
  private provider: string
  private maxResponseSize: number

  /**
   * Timeout between stream chunks (default 5 minutes).
   * If no data is received within this period during streaming, the request is aborted.
   * This is separate from the connection timeout which uses defaultTimeout.
   */
  private streamIdleTimeout: number

  constructor(options?: {
    headers?: Record<string, string>
    timeout?: number
    maxRetries?: number
    provider?: string
    maxResponseSize?: number
    streamIdleTimeout?: number
  }) {
    this.defaultHeaders = options?.headers ?? {}
    this.defaultTimeout = options?.timeout ?? 60000 // 60 seconds
    this.maxRetries = options?.maxRetries ?? 3
    this.provider = options?.provider ?? 'unknown'
    this.maxResponseSize = options?.maxResponseSize ?? 100 * 1024 * 1024 // 100MB default
    this.streamIdleTimeout = options?.streamIdleTimeout ?? 300000 // 5 minutes
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
   * Establish a streaming connection with retry logic.
   * Retries on connection-phase failures (before the response body is consumed).
   * @private
   */
  private async connectStream(
    options: HTTPRequestOptions,
    retries: number = 0
  ): Promise<Response> {
    const controller = new AbortController()
    const connectTimeout = options.timeout ?? this.defaultTimeout
    const timeoutId = setTimeout(() => controller.abort(), connectTimeout)

    try {
      const headers = {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...this.defaultHeaders,
        ...options.headers,
      }

      const response = await fetch(options.url, {
        method: options.method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: options.signal ?? controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const respHeaders = Object.fromEntries(response.headers.entries())
        const error = new APIError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          this.provider,
          errorData,
          { headers: respHeaders }
        )

        // Retry on retryable status codes
        if (this.shouldRetry(error.status) && retries < this.maxRetries) {
          const retryAfter = respHeaders['retry-after']
          const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : undefined
          const delay = this.getBackoffDelay(retries, retryAfterSeconds)
          await new Promise((resolve) => setTimeout(resolve, delay))
          return this.connectStream(options, retries + 1)
        }

        throw error
      }

      return response
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof APIError) {
        throw error
      }

      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new TimeoutError('Stream connection timeout', connectTimeout)
        if (retries < this.maxRetries) {
          const delay = this.getBackoffDelay(retries)
          await new Promise((resolve) => setTimeout(resolve, delay))
          return this.connectStream(options, retries + 1)
        }
        throw timeoutError
      }

      const networkError = new NetworkError('Network request failed', error)
      if (retries < this.maxRetries) {
        const delay = this.getBackoffDelay(retries)
        await new Promise((resolve) => setTimeout(resolve, delay))
        return this.connectStream(options, retries + 1)
      }
      throw networkError
    }
  }

  /**
   * Make a streaming HTTP request.
   * Uses a connection timeout for the initial connection and
   * an idle timeout between chunks during streaming.
   */
  async *requestStream(
    options: HTTPRequestOptions
  ): AsyncIterable<string> {
    // Phase 1: Establish connection (with retry)
    const response = await this.connectStream(options)

    if (!response.body) {
      throw new NetworkError('Response body is null')
    }

    // Phase 2: Read stream with idle timeout (no retry — partial data can't be replayed)
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let totalBytes = 0

    try {
      while (true) {
        // Set up idle timeout for each chunk read
        const idleController = new AbortController()
        const idleTimer = setTimeout(
          () => idleController.abort(),
          this.streamIdleTimeout
        )

        try {
          const { done, value } = await reader.read()
          clearTimeout(idleTimer)

          if (done) break

          totalBytes += value.length
          if (totalBytes > this.maxResponseSize) {
            throw new NetworkError(
              `Streaming response size (${totalBytes} bytes) exceeds maximum allowed size (${this.maxResponseSize} bytes)`
            )
          }

          const chunk = decoder.decode(value, { stream: true })
          yield chunk
        } catch (readError) {
          clearTimeout(idleTimer)

          if (readError instanceof NetworkError) {
            throw readError
          }

          if (readError instanceof Error && readError.name === 'AbortError') {
            throw new TimeoutError(
              'Stream idle timeout: no data received',
              this.streamIdleTimeout
            )
          }

          throw readError
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}
