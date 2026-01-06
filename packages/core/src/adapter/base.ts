import type { LLMErrorIR } from '../ir/error'
import type { LLMRequestIR } from '../ir/request'
import type { LLMResponseIR } from '../ir/response'
import type { LLMStreamEvent } from '../ir/stream'
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
     * Get stream handler for provider
     */
    buildStreamHandler?(): StreamHandler

    /**
     * Get error handler for provider
     */
    buildErrorHandler?(): ErrorHandler
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
