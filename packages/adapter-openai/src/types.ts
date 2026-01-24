import type { ToolCall, JSONSchema } from '@amux.ai/llm-bridge'

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
 * OpenAI Chat Completions API request format
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
 * OpenAI Chat Completions API response format
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

// ============================================
// OpenAI Responses API Types (New API)
// ============================================

/**
 * Responses API input content item
 * Supports both explicit type format and shorthand format
 */
export type ResponsesInputItem =
  | {
      type: 'message'
      role: 'user' | 'assistant' | 'system' | 'developer'
      content: string | ResponsesContentPart[]
    }
  | {
      type: 'item_reference'
      id: string
    }
  | {
      // Shorthand format without explicit type
      role: 'user' | 'assistant' | 'system' | 'developer'
      content: string | ResponsesContentPart[]
      type?: undefined
    }

/**
 * Responses API content part
 */
export type ResponsesContentPart =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string; detail?: 'auto' | 'low' | 'high' }
  | { type: 'input_file'; file_id: string }

/**
 * Responses API tool definition
 */
export type ResponsesTool =
  | {
      type: 'function'
      name: string
      description?: string
      parameters?: JSONSchema
      strict?: boolean
    }
  | {
      type: 'web_search_preview'
      search_context_size?: 'low' | 'medium' | 'high'
    }
  | {
      type: 'file_search'
      vector_store_ids: string[]
      max_num_results?: number
    }
  | {
      type: 'code_interpreter'
    }

/**
 * Responses API text format configuration
 */
export interface ResponsesTextFormat {
  format?: {
    type: 'text' | 'json_object' | 'json_schema'
    json_schema?: {
      name: string
      description?: string
      schema: Record<string, unknown>
      strict?: boolean
    }
  }
}

/**
 * Responses API request format
 */
export interface ResponsesRequest {
  model: string
  input: string | ResponsesInputItem[]
  instructions?: string
  tools?: ResponsesTool[]
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; name: string }
  parallel_tool_calls?: boolean
  stream?: boolean
  temperature?: number
  top_p?: number
  max_output_tokens?: number
  truncation?: 'auto' | 'disabled'
  metadata?: Record<string, string>
  store?: boolean
  reasoning?: {
    effort?: 'low' | 'medium' | 'high'
    summary?: 'auto' | 'concise' | 'detailed'
  }
  text?: ResponsesTextFormat
  previous_response_id?: string
  user?: string
}

/**
 * Responses API output item
 */
export type ResponsesOutputItem =
  | {
      type: 'message'
      id: string
      role: 'assistant'
      content: ResponsesOutputContent[]
      status: 'completed' | 'incomplete'
    }
  | {
      type: 'function_call'
      id: string
      call_id: string
      name: string
      arguments: string
      status: 'completed' | 'incomplete'
    }
  | {
      type: 'function_call_output'
      id: string
      call_id: string
      output: string
    }
  | {
      type: 'web_search_call'
      id: string
      status: 'completed' | 'searching' | 'incomplete'
    }
  | {
      type: 'reasoning'
      id: string
      content: Array<{ type: 'reasoning_text'; text: string }>
    }

/**
 * Responses API output content
 */
export type ResponsesOutputContent =
  | { type: 'output_text'; text: string; annotations?: unknown[]; logprobs?: unknown[] }
  | { type: 'refusal'; refusal: string }

/**
 * Responses API response format
 */
export interface ResponsesResponse {
  id: string
  object: 'response'
  created_at: number
  model: string
  status: 'completed' | 'failed' | 'incomplete' | 'in_progress'
  output: ResponsesOutputItem[]
  output_text?: string // Convenience field for simple text responses
  usage?: {
    input_tokens: number
    input_tokens_details?: {
      cached_tokens?: number
    }
    output_tokens: number
    output_tokens_details?: {
      reasoning_tokens?: number
    }
    total_tokens: number
  }
  error?: {
    type?: string
    code: string
    message: string
    param?: string
  }
  incomplete_details?: {
    reason: string
  }
}

/**
 * Responses API stream event
 */
export interface ResponsesStreamEvent {
  type:
    | 'response.created'
    | 'response.in_progress'
    | 'response.completed'
    | 'response.failed'
    | 'response.incomplete'
    | 'response.output_item.added'
    | 'response.output_item.done'
    | 'response.content_part.added'
    | 'response.content_part.done'
    | 'response.output_text.delta'
    | 'response.output_text.done'
    | 'response.function_call_arguments.delta'
    | 'response.function_call_arguments.done'
    | 'response.reasoning_summary_text.delta'
    | 'response.reasoning_summary_text.done'
    | 'error'
  response?: ResponsesResponse
  output_index?: number
  content_index?: number
  item?: ResponsesOutputItem
  part?: ResponsesOutputContent
  delta?: string
  text?: string
  error?: {
    type: string
    code: string
    message: string
  }
}
