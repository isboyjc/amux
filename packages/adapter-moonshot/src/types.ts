import type { ToolCall, JSONSchema } from '@amux/llm-bridge'

/**
 * Kimi message format (OpenAI-compatible)
 */
export interface KimiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | null
  name?: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

/**
 * Kimi tool format (same as OpenAI)
 */
export interface KimiTool {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters?: JSONSchema
  }
}

/**
 * Kimi response format configuration
 */
export interface KimiResponseFormat {
  type: 'text' | 'json_object'
}

/**
 * Kimi stream options
 */
export interface KimiStreamOptions {
  include_usage?: boolean
}

/**
 * Kimi request format
 * Based on OpenAI with some limitations
 */
export interface KimiRequest {
  model: string
  messages: KimiMessage[]
  tools?: KimiTool[]
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } }
  stream?: boolean
  stream_options?: KimiStreamOptions
  temperature?: number
  top_p?: number
  max_tokens?: number
  stop?: string | string[]
  presence_penalty?: number
  frequency_penalty?: number
  n?: number
  response_format?: KimiResponseFormat
}

/**
 * Kimi response usage
 */
export interface KimiUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

/**
 * Kimi response format
 */
export interface KimiResponse {
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
  usage?: KimiUsage
}

/**
 * Kimi stream chunk format
 */
export interface KimiStreamChunk {
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
  usage?: KimiUsage
}

/**
 * Kimi error format
 */
export interface KimiError {
  error: {
    message: string
    type: string
    param?: string
    code?: string
  }
}
