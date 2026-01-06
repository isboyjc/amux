import type { ToolCall, JSONSchema } from '@llm-bridge/core'

/**
 * OpenAI message content part types
 */
export type OpenAIContentPart =
  | { type: 'text'; text: string }
  | {
      type: 'image_url'
      image_url: {
        url: string
        detail?: 'auto' | 'low' | 'high'
      }
    }

/**
 * OpenAI message format
 */
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | OpenAIContentPart[] | null
  name?: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

/**
 * OpenAI tool format
 */
export interface OpenAITool {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters?: JSONSchema
    strict?: boolean
  }
}

/**
 * OpenAI response format configuration
 */
export interface OpenAIResponseFormat {
  type: 'text' | 'json_object' | 'json_schema'
  json_schema?: {
    name: string
    description?: string
    schema: Record<string, unknown>
    strict?: boolean
  }
}

/**
 * OpenAI stream options
 */
export interface OpenAIStreamOptions {
  include_usage?: boolean
}

/**
 * OpenAI request format
 */
export interface OpenAIRequest {
  model: string
  messages: OpenAIMessage[]
  tools?: OpenAITool[]
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } }
  stream?: boolean
  stream_options?: OpenAIStreamOptions
  temperature?: number
  top_p?: number
  max_tokens?: number
  max_completion_tokens?: number
  stop?: string | string[]
  presence_penalty?: number
  frequency_penalty?: number
  n?: number
  seed?: number
  user?: string
  response_format?: OpenAIResponseFormat
  logprobs?: boolean
  top_logprobs?: number
}

/**
 * OpenAI response usage
 */
export interface OpenAIUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  completion_tokens_details?: {
    reasoning_tokens?: number
  }
}

/**
 * OpenAI response format
 */
export interface OpenAIResponse {
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
  usage?: OpenAIUsage
}

/**
 * OpenAI stream chunk format
 */
export interface OpenAIStreamChunk {
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
  usage?: OpenAIUsage
}

/**
 * OpenAI error format
 */
export interface OpenAIError {
  error: {
    message: string
    type: string
    param?: string
    code?: string
  }
}
