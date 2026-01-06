import type { ToolCall, JSONSchema } from '@llm-bridge/core'

/**
 * DeepSeek message content part types (same as OpenAI)
 */
export type DeepSeekContentPart =
  | { type: 'text'; text: string }
  | {
      type: 'image_url'
      image_url: {
        url: string
        detail?: 'auto' | 'low' | 'high'
      }
    }

/**
 * DeepSeek message format
 * Extended from OpenAI with reasoning_content support
 */
export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | DeepSeekContentPart[] | null
  name?: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
  /**
   * Reasoning content (for deepseek-reasoner model)
   * Contains the model's chain-of-thought reasoning process
   */
  reasoning_content?: string
  /**
   * Beta: Prefix mode - force model to start with specific content
   */
  prefix?: boolean
}

/**
 * DeepSeek tool format (same as OpenAI)
 */
export interface DeepSeekTool {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters?: JSONSchema
    strict?: boolean
  }
}

/**
 * DeepSeek response format configuration
 */
export interface DeepSeekResponseFormat {
  type: 'text' | 'json_object'
}

/**
 * DeepSeek thinking configuration
 */
export interface DeepSeekThinking {
  type: 'enabled' | 'disabled'
}

/**
 * DeepSeek stream options
 */
export interface DeepSeekStreamOptions {
  include_usage?: boolean
}

/**
 * DeepSeek request format
 * Based on OpenAI with DeepSeek-specific extensions
 */
export interface DeepSeekRequest {
  model: string
  messages: DeepSeekMessage[]
  tools?: DeepSeekTool[]
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } }
  stream?: boolean
  stream_options?: DeepSeekStreamOptions
  temperature?: number
  top_p?: number
  max_tokens?: number
  stop?: string | string[]
  presence_penalty?: number
  frequency_penalty?: number
  response_format?: DeepSeekResponseFormat
  logprobs?: boolean
  top_logprobs?: number
  /**
   * DeepSeek-specific: Enable thinking/reasoning mode
   */
  thinking?: DeepSeekThinking
}

/**
 * DeepSeek response usage with cache and reasoning details
 */
export interface DeepSeekUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  /**
   * DeepSeek-specific: Cached prompt tokens
   */
  prompt_cache_hit_tokens?: number
  prompt_cache_miss_tokens?: number
  /**
   * DeepSeek-specific: Reasoning tokens breakdown
   */
  completion_tokens_details?: {
    reasoning_tokens?: number
  }
}

/**
 * DeepSeek response format
 */
export interface DeepSeekResponse {
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
       * DeepSeek-specific: Reasoning content
       */
      reasoning_content?: string
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
      /**
       * DeepSeek-specific: Reasoning content logprobs
       */
      reasoning_content?: Array<{
        token: string
        logprob: number
        top_logprobs?: Array<{
          token: string
          logprob: number
        }>
      }>
    }
  }>
  usage?: DeepSeekUsage
}

/**
 * DeepSeek stream chunk format
 */
export interface DeepSeekStreamChunk {
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
       * DeepSeek-specific: Reasoning content delta
       */
      reasoning_content?: string
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
  usage?: DeepSeekUsage
}

/**
 * DeepSeek error format
 */
export interface DeepSeekError {
  error: {
    message: string
    type: string
    param?: string
    code?: string
  }
}
