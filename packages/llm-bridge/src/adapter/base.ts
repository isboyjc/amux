import type { LLMErrorIR } from '../ir/error'
import type { LLMRequestIR } from '../ir/request'
import type { LLMResponseIR } from '../ir/response'
import type { LLMStreamEvent, SSEEvent } from '../ir/stream'
import type {
  AdapterCapabilities,
  AdapterInfo,
  ValidationResult,
} from './capabilities'

/**
 * Stream handler function
 */
export type StreamHandler = (
  chunk: unknown
) => LLMStreamEvent | LLMStreamEvent[] | null

/**
 * Error handler function
 */
export type ErrorHandler = (error: unknown) => LLMErrorIR

/**
 * Stream event builder interface
 * Handles stateful conversion of IR stream events to provider-specific SSE events
 */
export interface StreamEventBuilder {
  /**
   * Process an IR stream event and return SSE events
   * May return multiple events (e.g., message_start + content_block_start)
   * May return empty array if no events should be emitted
   */
  process(event: LLMStreamEvent): SSEEvent[]

  /**
   * Get any final events that should be emitted when the stream ends
   * Called after all events have been processed
   */
  finalize?(): SSEEvent[]
}

/**
 * LLM Adapter interface
 * Defines the contract for bidirectional conversion between provider formats and IR
 */
export interface LLMAdapter {
  /**
   * Adapter name (e.g., 'openai', 'anthropic')
   */
  readonly name: string

  /**
   * Adapter version
   */
  readonly version: string

  /**
   * Adapter capabilities
   */
  readonly capabilities: AdapterCapabilities

  /**
   * Inbound conversion (Provider format → IR)
   */
  inbound: {
    /**
     * Parse provider request to IR
     */
    parseRequest(request: unknown): LLMRequestIR

    /**
     * Parse provider response to IR
     */
    parseResponse?(response: unknown): LLMResponseIR

    /**
     * Parse provider stream chunk to IR stream event
     */
    parseStream?(chunk: unknown): LLMStreamEvent | LLMStreamEvent[] | null

    /**
     * Parse provider error to IR error
     */
    parseError?(error: unknown): LLMErrorIR
  }

  /**
   * Outbound conversion (IR → Provider format)
   */
  outbound: {
    /**
     * Build provider request from IR
     */
    buildRequest(ir: LLMRequestIR): unknown

    /**
     * Build provider response from IR
     */
    buildResponse?(ir: LLMResponseIR): unknown

    /**
     * Build provider stream event from IR stream event
     */
    buildStreamEvent?(ir: LLMStreamEvent): unknown

    /**
     * Get stream handler for provider
     */
    buildStreamHandler?(): StreamHandler

    /**
     * Get error handler for provider
     */
    buildErrorHandler?(): ErrorHandler

    /**
     * Create a stream event builder for converting IR events to provider SSE format
     * The builder maintains state for proper event sequencing (e.g., tracking content blocks)
     */
    createStreamBuilder?(): StreamEventBuilder
  }

  /**
   * Validate IR request for this adapter
   */
  validateRequest?(ir: LLMRequestIR): ValidationResult

  /**
   * Check if adapter supports a specific capability
   */
  supportsCapability?(capability: keyof AdapterCapabilities): boolean

  /**
   * Get adapter information
   */
  getInfo(): AdapterInfo
}
