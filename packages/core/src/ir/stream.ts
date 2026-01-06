import type { Message } from '../types/message'
import type { FinishReason, Usage } from './response'

/**
 * Stream event types
 */
export type StreamEventType =
  | 'start' // Stream started
  | 'content' // Content delta
  | 'reasoning' // Reasoning/thinking content delta
  | 'tool_call' // Tool call delta
  | 'end' // Stream ended
  | 'error' // Error occurred

/**
 * Content delta
 */
export interface ContentDelta {
  type: 'content'
  delta: string
  index?: number
}

/**
 * Reasoning content delta (DeepSeek, Qwen, Anthropic)
 */
export interface ReasoningDelta {
  type: 'reasoning'
  delta: string
  index?: number
}

/**
 * Tool call delta
 */
export interface ToolCallDelta {
  type: 'tool_call'
  id?: string
  name?: string
  arguments?: string
  index?: number
}

/**
 * Stream event
 */
export interface LLMStreamEvent {
  /**
   * Event type
   */
  type: StreamEventType

  /**
   * Event ID
   */
  id?: string

  /**
   * Model used
   */
  model?: string

  /**
   * Content delta
   */
  content?: ContentDelta

  /**
   * Reasoning/thinking content delta
   */
  reasoning?: ReasoningDelta

  /**
   * Tool call delta
   */
  toolCall?: ToolCallDelta

  /**
   * Finish reason (for end event)
   */
  finishReason?: FinishReason

  /**
   * Complete message (for end event)
   */
  message?: Message

  /**
   * Usage statistics (for end event, if stream_options.include_usage is true)
   */
  usage?: Usage

  /**
   * Error (for error event)
   */
  error?: {
    message: string
    code?: string
    [key: string]: unknown
  }

  /**
   * Raw original event (for debugging)
   */
  raw?: unknown
}
