import type {
  LLMRequestIR,
  Message,
  Tool,
  ToolChoice,
  ContentPart,
  TextContent,
  ImageContent,
  ToolCall,
} from '@amux/llm-bridge'

import type { GeminiRequest, GeminiContent } from '../types'

// OpenAI-compatible types for parsing
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | OpenAIContentPart[] | null
  name?: string
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
}

interface OpenAIContentPart {
  type: 'text' | 'image_url'
  text?: string
  image_url?: { url: string; detail?: string }
}

interface OpenAIRequest {
  model?: string
  messages: OpenAIMessage[]
  tools?: Array<{
    type: 'function'
    function: {
      name: string
      description?: string
      parameters?: Record<string, unknown>
    }
  }>
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } }
  temperature?: number
  top_p?: number
  max_tokens?: number
  stop?: string | string[]
  stream?: boolean
}

/**
 * Check if request is in OpenAI format
 */
function isOpenAIFormat(request: unknown): request is OpenAIRequest {
  const req = request as Record<string, unknown>
  return Array.isArray(req.messages)
}

/**
 * Parse Gemini request to IR
 * Supports both native Gemini format and OpenAI-compatible format
 */
export function parseRequest(request: unknown): LLMRequestIR {
  // Check if request is in OpenAI format
  if (isOpenAIFormat(request)) {
    return parseOpenAIRequest(request)
  }

  // Parse native Gemini format
  return parseGeminiRequest(request as GeminiRequest)
}

/**
 * Parse OpenAI-compatible request to IR
 */
function parseOpenAIRequest(req: OpenAIRequest): LLMRequestIR {
  const messages: Message[] = []

  for (const msg of req.messages) {
    messages.push({
      role: msg.role,
      content: parseOpenAIContent(msg.content),
      name: msg.name,
      toolCalls: msg.tool_calls,
      toolCallId: msg.tool_call_id,
    })
  }

  // Parse tools
  const tools: Tool[] | undefined = req.tools?.map((tool): Tool => ({
    type: 'function',
    function: {
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters as Tool['function']['parameters'],
    },
  }))

  // Parse tool choice
  let toolChoice: ToolChoice | undefined
  if (req.tool_choice) {
    if (typeof req.tool_choice === 'string') {
      toolChoice = req.tool_choice as ToolChoice
    } else {
      toolChoice = {
        type: 'function',
        function: { name: req.tool_choice.function.name },
      }
    }
  }

  return {
    messages,
    model: req.model,
    tools,
    toolChoice,
    stream: req.stream,
    generation: {
      temperature: req.temperature,
      topP: req.top_p,
      maxTokens: req.max_tokens,
      stopSequences: req.stop
        ? Array.isArray(req.stop)
          ? req.stop
          : [req.stop]
        : undefined,
    },
    raw: req,
  }
}

function parseOpenAIContent(
  content: string | OpenAIContentPart[] | null
): string | ContentPart[] {
  if (content === null || content === undefined) {
    return ''
  }

  if (typeof content === 'string') {
    return content
  }

  return content.map((part): ContentPart => {
    if (part.type === 'text') {
      return {
        type: 'text',
        text: part.text ?? '',
      } as TextContent
    }

    if (part.type === 'image_url' && part.image_url) {
      const url = part.image_url.url

      // Check if it's a base64 data URL
      if (url.startsWith('data:')) {
        const match = url.match(/^data:([^;]+);base64,(.+)$/)
        if (match) {
          return {
            type: 'image',
            source: {
              type: 'base64',
              mediaType: match[1],
              data: match[2],
            },
          } as ImageContent
        }
      }

      // Regular URL
      return {
        type: 'image',
        source: {
          type: 'url',
          url: url,
        },
      } as ImageContent
    }

    return {
      type: 'text',
      text: JSON.stringify(part),
    } as TextContent
  })
}

/**
 * Parse native Gemini request to IR
 */
function parseGeminiRequest(req: GeminiRequest): LLMRequestIR {
  // Extract system instruction
  let system: string | undefined
  if (req.systemInstruction?.parts) {
    system = req.systemInstruction.parts.map((p) => p.text).join('\n')
  }

  // Parse contents to messages (flatMap because parseGeminiContent returns Message[])
  const messages: Message[] = req.contents.flatMap((content) => parseGeminiContent(content))

  // Parse tools
  const tools: Tool[] | undefined = req.tools?.[0]?.functionDeclarations?.map((fn) => ({
    type: 'function' as const,
    function: {
      name: fn.name,
      description: fn.description,
      parameters: fn.parameters
        ? {
            type: fn.parameters.type,
            properties: fn.parameters.properties,
            required: fn.parameters.required,
          }
        : undefined,
    },
  }))

  // Parse tool config to tool choice
  let toolChoice: ToolChoice | undefined
  if (req.toolConfig?.functionCallingConfig) {
    const mode = req.toolConfig.functionCallingConfig.mode
    if (mode === 'AUTO') toolChoice = 'auto'
    else if (mode === 'NONE') toolChoice = 'none'
    else if (mode === 'ANY') toolChoice = 'required'
  }

  return {
    messages,
    tools,
    toolChoice,
    system,
    generation: req.generationConfig
      ? {
          temperature: req.generationConfig.temperature,
          topP: req.generationConfig.topP,
          topK: req.generationConfig.topK,
          maxTokens: req.generationConfig.maxOutputTokens,
          stopSequences: req.generationConfig.stopSequences,
          responseFormat: req.generationConfig.responseMimeType === 'application/json'
            ? { type: 'json_object' as const }
            : undefined,
        }
      : undefined,
    raw: req,
  }
}

function parseGeminiContent(content: GeminiContent): Message[] {
  const role = content.role === 'model' ? 'assistant' : 'user'
  const parts: ContentPart[] = []
  const toolCalls: ToolCall[] = []
  const toolResults: Message[] = []

  for (const part of content.parts) {
    if ('text' in part) {
      parts.push({
        type: 'text',
        text: part.text,
      } as TextContent)
    } else if ('inlineData' in part) {
      parts.push({
        type: 'image',
        source: {
          type: 'base64',
          mediaType: part.inlineData.mimeType,
          data: part.inlineData.data,
        },
      } as ImageContent)
    } else if ('fileData' in part) {
      parts.push({
        type: 'image',
        source: {
          type: 'url',
          url: part.fileData.fileUri,
        },
      } as ImageContent)
    } else if ('functionCall' in part) {
      // Gemini function call -> OpenAI-style toolCalls
      toolCalls.push({
        id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'function',
        function: {
          name: part.functionCall.name,
          arguments: JSON.stringify(part.functionCall.args),
        },
      })
    } else if ('functionResponse' in part) {
      // Gemini function response -> tool role message
      toolResults.push({
        role: 'tool',
        content: JSON.stringify(part.functionResponse.response),
        toolCallId: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: part.functionResponse.name,
      })
    }
  }

  const messages: Message[] = []

  // Create main message with content and toolCalls
  if (parts.length > 0 || toolCalls.length > 0) {
    // If all parts are text, simplify to string
    const allText = parts.every((p) => p.type === 'text')
    const messageContent = allText && parts.length === 1
      ? (parts[0] as TextContent).text
      : parts.length > 0
      ? parts
      : ''

    const message: Message = {
      role,
      content: messageContent,
    }

    if (toolCalls.length > 0) {
      message.toolCalls = toolCalls
    }

    messages.push(message)
  }

  // Add tool result messages
  messages.push(...toolResults)

  return messages
}
