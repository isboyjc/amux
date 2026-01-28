import type { ToolCall, JSONSchema } from '@amux.ai/llm-bridge'

/**
 * MiniMax message content part types (same as OpenAI)
 */
export type MinimaxContentPart =
  | { type: 'text'; text: string }
  | {
      type: 'image_url'
      image_url: {
        url: string
        detail?: 'auto' | 'low' | 'high'
      }
    }

/**
 * MiniMax reasoning detail format
 * Used when reasoning_split is enabled
 */
export interface MinimaxReasoningDetail {
  type: 'thinking'
  text: string
}

/**
 * MiniMax message format
 * Extended from OpenAI with reasoning_details support
 */
export interface MinimaxMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | MinimaxContentPart[] | null
  name?: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
  /**
   * MiniMax-specific: Reasoning details (for Interleaved Thinking)
   * Contains the model's reasoning process in structured format
   */
  reasoning_details?: MinimaxReasoningDetail[]
}

/**
 * MiniMax tool format (same as OpenAI)
 */
export interface MinimaxTool {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters?: JSONSchema
    strict?: boolean
  }
}

/**
 * MiniMax response format configuration
 */
export interface MinimaxResponseFormat {
  type: 'text' | 'json_object'
}

/**
 * MiniMax stream options
 */
export interface MinimaxStreamOptions {
  include_usage?: boolean
}

/**
 * MiniMax request format
 * Based on OpenAI with MiniMax-specific extensions
 */
export interface MinimaxRequest {
  model: string
  messages: MinimaxMessage[]
  tools?: MinimaxTool[]
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } }
  stream?: boolean
  stream_options?: MinimaxStreamOptions
  /**
   * Temperature parameter
   * Range: (0.0, 1.0], recommended: 1.0
   * Values outside this range will return an error
   */
  temperature?: number
  top_p?: number
  max_tokens?: number
  stop?: string | string[]
  response_format?: MinimaxResponseFormat
  /**
   * Number of completions to generate
   * Only supports value 1
   */
  n?: number
  /**
   * MiniMax-specific: Enable reasoning split
   * When true, reasoning content is separated into reasoning_details field
   */
  reasoning_split?: boolean
}

/**
 * MiniMax response usage
 */
export interface MinimaxUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  /**
   * MiniMax-specific: Reasoning tokens breakdown
   */
  completion_tokens_details?: {
    reasoning_tokens?: number
  }
}

/**
 * MiniMax response format
 */
export interface MinimaxResponse {
  id: string
  object: string
  created: number
  model: string
  system_fingerprint?: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string | null
      tool_calls?: ToolCall[]
      /**
       * MiniMax-specific: Reasoning details
       */
      reasoning_details?: MinimaxReasoningDetail[]
    }
    finish_reason: string
    logprobs?: {
      content?: Array<{
        token: string
        logprob: number
        top_logprobs?: Array<{
          token: string
          logprob: number
        }>
      }>
    }
  }>
  usage?: MinimaxUsage
}

/**
 * MiniMax stream chunk format
 */
export interface MinimaxStreamChunk {
  id: string
  object: string
  created: number
  model: string
  system_fingerprint?: string
  choices: Array<{
    index: number
    delta: {
      role?: string
      content?: string
      tool_calls?: Array<{
        index: number
        id?: string
        type?: string
        function?: {
          name?: string
          arguments?: string
        }
      }>
      /**
       * MiniMax-specific: Reasoning details delta
       */
      reasoning_details?: MinimaxReasoningDetail[]
    }
    finish_reason?: string | null
    logprobs?: {
      content?: Array<{
        token: string
        logprob: number
        top_logprobs?: Array<{
          token: string
          logprob: number
        }>
      }>
    }
  }>
  usage?: MinimaxUsage
}

/**
 * MiniMax error format
 */
export interface MinimaxError {
  error: {
    message: string
    type: string
    param?: string
    code?: string
  }
}
