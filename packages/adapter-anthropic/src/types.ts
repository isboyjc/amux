import type { JSONSchema } from '@llm-bridge/core'

/**
 * Anthropic request format
 */
export interface AnthropicRequest {
  model: string
  messages: AnthropicMessage[]
  system?: string
  tools?: AnthropicTool[]
  tool_choice?: { type: string; name?: string }
  max_tokens: number
  temperature?: number
  top_p?: number
  top_k?: number
  stop_sequences?: string[]
  stream?: boolean
  metadata?: {
    user_id?: string
  }
}

/**
 * Anthropic message format
 */
export interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string | AnthropicContent[]
}

/**
 * Anthropic content types
 */
export type AnthropicContent =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: string; media_type?: string; data?: string; url?: string } }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string | unknown[]; is_error?: boolean }

/**
 * Anthropic tool format
 */
export interface AnthropicTool {
  name: string
  description?: string
  input_schema: JSONSchema
}

/**
 * Anthropic response format
 */
export interface AnthropicResponse {
  id: string
  type: 'message'
  role: 'assistant'
  content: AnthropicContent[]
  model: string
  stop_reason: string | null
  stop_sequence: string | null
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

/**
 * Anthropic stream event
 */
export interface AnthropicStreamEvent {
  type: string
  index?: number
  delta?: {
    type?: string
    text?: string
    stop_reason?: string
  }
  content_block?: AnthropicContent
  message?: Partial<AnthropicResponse>
  usage?: {
    input_tokens?: number
    output_tokens?: number
  }
}
