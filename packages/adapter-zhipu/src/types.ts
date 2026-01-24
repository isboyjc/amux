import type { ToolCall, JSONSchema } from '@amux.ai/llm-bridge'

/**
 * Zhipu message format (OpenAI-compatible)
 */
export interface ZhipuMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | null
  name?: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

/**
 * Zhipu tool format (same as OpenAI)
 */
export interface ZhipuTool {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters?: JSONSchema
  }
}

/**
 * Zhipu response format configuration
 */
export interface ZhipuResponseFormat {
  type: 'text' | 'json_object'
}

/**
 * Zhipu stream options
 */
export interface ZhipuStreamOptions {
  include_usage?: boolean
}

/**
 * Zhipu request format
 * Based on OpenAI with some Zhipu-specific features
 */
export interface ZhipuRequest {
  model: string
  messages: ZhipuMessage[]
  tools?: ZhipuTool[]
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } }
  stream?: boolean
  stream_options?: ZhipuStreamOptions
  temperature?: number
  top_p?: number
  max_tokens?: number
  stop?: string | string[]
  presence_penalty?: number
  frequency_penalty?: number
  n?: number
  response_format?: ZhipuResponseFormat
  // Zhipu-specific
  do_sample?: boolean
  request_id?: string
  user_id?: string
}

/**
 * Zhipu response usage
 */
export interface ZhipuUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

/**
 * Zhipu response format
 */
export interface ZhipuResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string | null
      tool_calls?: ToolCall[]
    }
    finish_reason: string
  }>
  usage?: ZhipuUsage
  request_id?: string
}

/**
 * Zhipu stream chunk format
 */
export interface ZhipuStreamChunk {
  id: string
  object: string
  created: number
  model: string
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
  }>
  usage?: ZhipuUsage
}

/**
 * Zhipu error format
 */
export interface ZhipuError {
  error: {
    message: string
    type: string
    param?: string
    code?: string
  }
}
