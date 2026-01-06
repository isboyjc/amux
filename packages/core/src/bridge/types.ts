import type { LLMAdapter } from '../adapter'

/**
 * Bridge configuration
 */
export interface BridgeConfig {
  /**
   * API key for the target provider
   */
  apiKey: string

  /**
   * Base URL for the target provider API
   */
  baseURL?: string

  /**
   * Request timeout in milliseconds
   */
  timeout?: number

  /**
   * Custom headers
   */
  headers?: Record<string, string>

  /**
   * Additional provider-specific options
   */
  [key: string]: unknown
}

/**
 * Bridge options
 */
export interface BridgeOptions {
  /**
   * Inbound adapter (parses incoming requests)
   */
  inbound: LLMAdapter

  /**
   * Outbound adapter (builds outgoing requests)
   */
  outbound: LLMAdapter

  /**
   * Configuration for the target provider
   */
  config: BridgeConfig
}

/**
 * Compatibility report
 */
export interface CompatibilityReport {
  compatible: boolean
  issues?: string[]
  warnings?: string[]
}

/**
 * LLM Bridge interface
 */
export interface LLMBridge {
  /**
   * Send a chat request
   */
  chat(request: unknown): Promise<unknown>

  /**
   * Send a streaming chat request
   */
  chatStream(request: unknown): AsyncIterable<unknown>

  /**
   * Check compatibility between inbound and outbound adapters
   */
  checkCompatibility(): CompatibilityReport

  /**
   * Get adapter information
   */
  getAdapters(): {
    inbound: { name: string; version: string }
    outbound: { name: string; version: string }
  }
}

/**
 * HTTP request options
 */
export interface HTTPRequestOptions {
  method: string
  url: string
  headers?: Record<string, string>
  body?: unknown
  timeout?: number
  signal?: AbortSignal
}

/**
 * HTTP response
 */
export interface HTTPResponse<T = unknown> {
  status: number
  statusText: string
  headers: Record<string, string>
  data: T
}
