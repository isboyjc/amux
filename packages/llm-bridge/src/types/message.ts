/**
 * Message role types
 */
export type Role = 'system' | 'user' | 'assistant' | 'tool'

/**
 * Text content part
 */
export interface TextContent {
  type: 'text'
  text: string
}

/**
 * Image source types
 */
export type ImageSource =
  | {
      type: 'url'
      url: string
    }
  | {
      type: 'base64'
      mediaType: string
      data: string
    }

/**
 * Image content part
 */
export interface ImageContent {
  type: 'image'
  source: ImageSource
}

/**
 * Content part union type
 * Note: Tool calls use OpenAI-style toolCalls field on Message, not content parts
 */
export type ContentPart = TextContent | ImageContent

/**
 * Message content can be a string or an array of content parts
 */
export type MessageContent = string | ContentPart[]

/**
 * Tool call (OpenAI-style)
 * This is the unified format for tool calls in IR
 */
export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string // JSON string
  }
}

/**
 * Message structure supporting multimodal content
 */
export interface Message {
  role: Role
  content: MessageContent
  name?: string

  /**
   * Tool call ID (for tool role messages - tool results)
   * When role is 'tool', this identifies which tool call this is a response to
   */
  toolCallId?: string

  /**
   * Tool calls made by the assistant (OpenAI-style)
   * When role is 'assistant' and the model wants to call tools
   */
  toolCalls?: ToolCall[]

  /**
   * Reasoning/thinking content (DeepSeek, Qwen QwQ, Anthropic extended thinking)
   * Contains the model's chain-of-thought reasoning process
   */
  reasoningContent?: string
}
