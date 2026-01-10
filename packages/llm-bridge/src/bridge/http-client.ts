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

  constructor(options?: {
    headers?: Record<string, string>
    timeout?: number
    maxRetries?: number
    provider?: string
  }) {
    this.defaultHeaders = options?.headers ?? {}
    this.defaultTimeout = options?.timeout ?? 60000 // 60 seconds
    this.maxRetries = options?.maxRetries ?? 3
    this.provider = options?.provider ?? 'unknown'
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

      // Check HTTP status
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new APIError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          this.provider,
          errorData
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
        // Retry on 5xx errors
        if (error.status >= 500 && retries < this.maxRetries) {
          const delay = Math.pow(2, retries) * 1000 // Exponential backoff
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
          const delay = Math.pow(2, retries) * 1000
          await new Promise((resolve) => setTimeout(resolve, delay))
          return this.request(options, retries + 1)
        }
        throw timeoutError
      }

      // Wrap other errors as NetworkError
      const networkError = new NetworkError('Network request failed', error)
      // Retry on network errors
      if (retries < this.maxRetries) {
        const delay = Math.pow(2, retries) * 1000
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
        throw new APIError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          this.provider,
          errorData
        )
      }

      if (!response.body) {
        throw new NetworkError('Response body is null')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

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
