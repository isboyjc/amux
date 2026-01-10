import type { LLMAdapter } from '../adapter'
import type { LLMResponseIR } from '../ir/response'
import type { LLMStreamEvent, SSEEvent } from '../ir/stream'

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
   * Maximum number of retries for failed requests
   */
  maxRetries?: number

  /**
   * Custom headers
   */
  headers?: Record<string, string>

  /**
   * Authentication header name (default: 'Authorization')
   */
  authHeaderName?: string

  /**
   * Authentication header prefix (default: 'Bearer')
   * Set to empty string if no prefix is needed
   */
  authHeaderPrefix?: string

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

  /**
   * Fixed target model (highest priority)
   * If set, ignores the inbound model and always uses this model
   */
  targetModel?: string

  /**
   * Model mapping function (second priority)
   * Receives the inbound model name and returns the outbound model name
   */
  modelMapper?: (inboundModel: string) => string

  /**
   * Model mapping table (third priority)
   * Maps inbound model names to outbound model names
   */
  modelMapping?: {
    [inboundModel: string]: string
  }
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
 * Amux Bridge interface
 */
export interface LLMBridge {
  /**
   * Send a chat request
   * Returns response in inbound adapter's format
   */
  chat(request: unknown): Promise<unknown>

  /**
   * Send a chat request (raw IR response)
   * Returns raw IR response for custom processing
   * Use this when you need to access the IR directly
   */
  chatRaw(request: unknown): Promise<LLMResponseIR>

  /**
   * Send a streaming chat request
   * Returns SSE events in inbound adapter's format
   * This is the recommended method for streaming - events can be directly written to HTTP response
   */
  chatStream(request: unknown): AsyncIterable<SSEEvent>

  /**
   * Send a streaming chat request (raw IR events)
   * Returns raw IR stream events for custom processing
   * Use this when you need to customize the stream handling
   */
  chatStreamRaw(request: unknown): AsyncIterable<LLMStreamEvent>

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
