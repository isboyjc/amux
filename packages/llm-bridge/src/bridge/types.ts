import type { LLMAdapter } from '../adapter'
import type { LLMErrorIR } from '../ir/error'
import type { LLMRequestIR } from '../ir/request'
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
   * Overrides adapter's default baseUrl
   */
  baseURL?: string

  /**
   * Custom chat endpoint path
   * Overrides adapter's default chatPath
   * Example: '/v1/chat/completions', '/responses'
   */
  chatPath?: string

  /**
   * Custom models endpoint path
   * Overrides adapter's default modelsPath
   * Example: '/v1/models', '/models'
   */
  modelsPath?: string

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
 * Bridge lifecycle hooks
 * 
 * Hooks allow external code to intercept and observe the Bridge's request/response flow
 * at the IR (Intermediate Representation) layer, where all data is in a unified format.
 * 
 * Use cases:
 * - Logging and monitoring (track token usage, latency, errors)
 * - Cost tracking (calculate costs based on token usage)
 * - Debugging and tracing (inspect IR transformations)
 * - Rate limiting and alerting (implement usage-based limits)
 * - Audit logging (record all LLM API calls)
 */
export interface BridgeHooks {
  /**
   * Called after parsing the inbound request into IR, before building the outbound request
   * 
   * @param ir - The unified request IR
   * @returns void or Promise<void>
   * 
   * @example
   * ```typescript
   * onRequest: async (ir) => {
   *   console.log(`Request to model: ${ir.model}`)
   *   console.log(`Message count: ${ir.messages.length}`)
   * }
   * ```
   */
  onRequest?: (ir: LLMRequestIR) => void | Promise<void>

  /**
   * Called after parsing the provider response into IR, before building the final response
   * 
   * This is the ideal place to extract metadata like token usage, as all providers'
   * responses have been normalized to the same IR format.
   * 
   * @param ir - The unified response IR
   * @returns void or Promise<void>
   * 
   * @example
   * ```typescript
   * onResponse: async (ir) => {
   *   if (ir.usage) {
   *     console.log(`Input tokens: ${ir.usage.promptTokens}`)
   *     console.log(`Output tokens: ${ir.usage.completionTokens}`)
   *     await recordTokenUsage(ir.usage)
   *   }
   * }
   * ```
   */
  onResponse?: (ir: LLMResponseIR) => void | Promise<void>

  /**
   * Called for each streaming event after parsing into IR, before building the SSE event
   * 
   * @param event - The unified stream event IR
   * @returns void or Promise<void>
   * 
   * @example
   * ```typescript
   * onStreamEvent: async (event) => {
   *   if (event.type === 'end' && event.usage) {
   *     await recordTokenUsage(event.usage)
   *   }
   * }
   * ```
   */
  onStreamEvent?: (event: LLMStreamEvent) => void | Promise<void>

  /**
   * Called when an error occurs during the request/response flow
   * 
   * @param error - The unified error IR
   * @returns void or Promise<void>
   * 
   * @example
   * ```typescript
   * onError: async (error) => {
   *   console.error(`Bridge error: ${error.message}`)
   *   await logError(error)
   * }
   * ```
   */
  onError?: (error: LLMErrorIR) => void | Promise<void>
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
   * Lifecycle hooks for intercepting IR-level events
   * 
   * Hooks are called at key points in the request/response flow, allowing
   * external code to observe and react to events at the IR layer where all
   * data is in a unified format.
   * 
   * @example
   * ```typescript
   * const bridge = createBridge({
   *   inbound: openaiAdapter,
   *   outbound: anthropicAdapter,
   *   config: { apiKey: '...' },
   *   hooks: {
   *     onResponse: async (ir) => {
   *       // Track token usage in unified format
   *       await recordTokens({
   *         input: ir.usage?.promptTokens ?? 0,
   *         output: ir.usage?.completionTokens ?? 0
   *       })
   *     }
   *   }
   * })
   * ```
   */
  hooks?: BridgeHooks

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
   * List available models from the provider
   * Returns the raw model list response from the provider
   */
  listModels(): Promise<unknown>

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
