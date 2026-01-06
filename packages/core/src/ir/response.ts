import type { Message } from '../types/message'

/**
 * Finish reason types
 */
export type FinishReason =
  | 'stop' // Natural stop
  | 'length' // Max tokens reached
  | 'tool_calls' // Model wants to call tools
  | 'content_filter' // Content filtered
  | 'error' // Error occurred

/**
 * Token usage statistics
 */
export interface Usage {
  promptTokens: number
  completionTokens: number
  totalTokens: number

  /**
   * Detailed token breakdown (provider-specific)
   */
  details?: {
    /**
     * Reasoning/thinking tokens (DeepSeek, Qwen)
     */
    reasoningTokens?: number

    /**
     * Cached prompt tokens (DeepSeek, Anthropic)
     */
    cachedTokens?: number

    /**
     * Cache creation tokens (Anthropic)
     */
    cacheCreationTokens?: number

    /**
     * Cache read tokens (Anthropic)
     */
    cacheReadTokens?: number
  }
}

/**
 * Response choice
 */
export interface Choice {
  index: number
  message: Message
  finishReason?: FinishReason

  /**
   * Log probabilities (if requested)
   */
  logprobs?: {
    content?: Array<{
      token: string
      logprob: number
      topLogprobs?: Array<{
        token: string
        logprob: number
      }>
    }>
  }
}

/**
 * Unified response structure
 */
export interface LLMResponseIR {
  /**
   * Response ID
   */
  id: string

  /**
   * Model used
   */
  model: string

  /**
   * Generated message(s)
   */
  choices: Choice[]

  /**
   * Token usage statistics
   */
  usage?: Usage

  /**
   * Response creation timestamp
   */
  created?: number

  /**
   * System fingerprint (for reproducibility)
   */
  systemFingerprint?: string

  /**
   * Metadata
   */
  metadata?: {
    requestId?: string
    [key: string]: unknown
  }

  /**
   * Provider-specific extensions
   */
  extensions?: {
    [provider: string]: unknown
  }

  /**
   * Raw original response (for debugging/logging)
   */
  raw?: unknown
}
