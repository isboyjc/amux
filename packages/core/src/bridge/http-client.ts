import type { HTTPRequestOptions, HTTPResponse } from './types'

/**
 * Simple HTTP client for making requests to LLM APIs
 */
export class HTTPClient {
  private defaultHeaders: Record<string, string>
  private defaultTimeout: number

  constructor(options?: {
    headers?: Record<string, string>
    timeout?: number
  }) {
    this.defaultHeaders = options?.headers ?? {}
    this.defaultTimeout = options?.timeout ?? 60000 // 60 seconds
  }

  /**
   * Make an HTTP request
   */
  async request<T = unknown>(
    options: HTTPRequestOptions
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

      const data = (await response.json()) as T

      return {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data,
      }
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
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
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      if (!response.body) {
        throw new Error('Response body is null')
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
      throw error
    }
  }
}
