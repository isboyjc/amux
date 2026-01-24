import type { ToolCall, JSONSchema } from '@amux.ai/llm-bridge'

/**
 * Qwen message content part types
 * Extended from OpenAI with audio and video support
 */
export type QwenContentPart =
  | { type: 'text'; text: string }
  | {
      type: 'image_url'
      image_url: {
        url: string
        detail?: 'auto' | 'low' | 'high'
      }
    }
  | {
      type: 'input_audio'
      input_audio: {
        data: string
        format: 'mp3' | 'wav' | 'pcm'
      }
    }
  | {
      type: 'video'
      video: string[] // Array of image URLs for video frames
    }
  | {
      type: 'video_url'
      video_url: {
        url: string
      }
    }

/**
 * Qwen message format
 * Extended from OpenAI with reasoning_content support
 */
export interface QwenMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | QwenContentPart[] | null
  name?: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
  /**
   * Qwen-specific: Reasoning content (for QwQ model)
   */
  reasoning_content?: string
}

/**
 * Qwen tool format (same as OpenAI)
 */
export interface QwenTool {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters?: JSONSchema
    strict?: boolean
  }
}

/**
 * Qwen response format configuration
 */
export interface QwenResponseFormat {
  type: 'text' | 'json_object'
}

/**
 * Qwen stream options
 */
export interface QwenStreamOptions {
  include_usage?: boolean
}

/**
 * Qwen request format
 * Based on OpenAI with Qwen-specific extensions
 */
export interface QwenRequest {
  model: string
  messages: QwenMessage[]
  tools?: QwenTool[]
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } }
  stream?: boolean
  stream_options?: QwenStreamOptions
  temperature?: number
  top_p?: number
  max_tokens?: number
  stop?: string | string[]
  presence_penalty?: number
  frequency_penalty?: number
  response_format?: QwenResponseFormat
  seed?: number
  /**
   * Qwen-specific: Enable deep thinking mode (for QwQ model)
   */
  enable_thinking?: boolean
  /**
   * Qwen-specific: Enable web search
   */
  enable_search?: boolean
  /**
   * Qwen-specific: Video frame rate for video input
   */
  fps?: number
}

/**
 * Qwen response usage
 */
export interface QwenUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

/**
 * Qwen response format
 */
export interface QwenResponse {
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
       * Qwen-specific: Reasoning content
       */
      reasoning_content?: string
    }
    finish_reason: string
  }>
  usage?: QwenUsage
}

/**
 * Qwen stream chunk format
 */
export interface QwenStreamChunk {
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
       * Qwen-specific: Reasoning content delta
       */
      reasoning_content?: string
    }
    finish_reason?: string | null
  }>
  usage?: QwenUsage
}

/**
 * Qwen error format
 */
export interface QwenError {
  error: {
    message: string
    type: string
    param?: string
    code?: string
  }
}
