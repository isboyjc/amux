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
 * Tool use content part (for Anthropic-style tool calls)
 */
export interface ToolUseContent {
  type: 'tool_use'
  id: string
  name: string
  input: unknown
}

/**
 * Tool result content part (for Anthropic-style tool results)
 */
export interface ToolResultContent {
  type: 'tool_result'
  toolUseId: string
  content: string | ContentPart[]
  isError?: boolean
}

/**
 * Content part union type
 */
export type ContentPart =
  | TextContent
  | ImageContent
  | ToolUseContent
  | ToolResultContent

/**
 * Message content can be a string or an array of content parts
 */
export type MessageContent = string | ContentPart[]

/**
 * Tool call (OpenAI-style)
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
  toolCallId?: string
  toolCalls?: ToolCall[]

  /**
   * Reasoning/thinking content (DeepSeek, Qwen QwQ, Anthropic extended thinking)
   * Contains the model's chain-of-thought reasoning process
   */
  reasoningContent?: string
}
