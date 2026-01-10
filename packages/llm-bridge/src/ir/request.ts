import type { GenerationConfig } from '../types/generation'
import type { Message } from '../types/message'
import type { Tool, ToolChoice } from '../types/tool'

/**
 * Unified Intermediate Representation for LLM Requests
 * This is the core data structure that all adapters convert to/from
 */
export interface LLMRequestIR {
  /**
   * Conversation messages
   * Supports multi-turn dialogue with role-based messages
   */
  messages: Message[]

  /**
   * Model identifier (optional in IR, may be determined by router)
   */
  model?: string

  /**
   * Tools/Functions available for the model to call
   */
  tools?: Tool[]

  /**
   * Tool choice strategy
   */
  toolChoice?: ToolChoice

  /**
   * Streaming configuration
   */
  stream?: boolean

  /**
   * Generation parameters
   */
  generation?: GenerationConfig

  /**
   * System prompt (some providers use separate field)
   */
  system?: string

  /**
   * Metadata for tracking and routing
   */
  metadata?: {
    requestId?: string
    userId?: string
    sessionId?: string
    tags?: string[]
    [key: string]: unknown
  }

  /**
   * Provider-specific extensions
   * Allows passthrough of vendor-specific features
   */
  extensions?: {
    [provider: string]: unknown
  }

  /**
   * Raw original request (for debugging/logging)
   */
  raw?: unknown
}
