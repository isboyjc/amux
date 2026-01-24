import type {
  LLMRequestIR,
  Message,
  Tool,
  ToolChoice,
  ContentPart,
  TextContent,
  ImageContent,
} from '@amux.ai/llm-bridge'

import type { QwenRequest, QwenMessage, QwenTool, QwenContentPart } from '../types'

/**
 * Parse Qwen request to IR
 */
export function parseRequest(request: unknown): LLMRequestIR {
  const req = request as QwenRequest

  // Extract system message if present
  let system: string | undefined
  const messages: Message[] = []

  for (const msg of req.messages) {
    if (msg.role === 'system') {
      if (typeof msg.content === 'string') {
        system = system ? `${system}\n${msg.content}` : msg.content
      }
    } else {
      messages.push(parseMessage(msg))
    }
  }

  // Parse tools
  const tools: Tool[] | undefined = req.tools?.map((tool) => parseTool(tool))

  // Parse tool choice
  const toolChoice: ToolChoice | undefined = req.tool_choice
    ? parseToolChoice(req.tool_choice)
    : undefined

  return {
    messages,
    model: req.model,
    tools,
    toolChoice,
    stream: req.stream,
    system,
    generation: {
      temperature: req.temperature,
      topP: req.top_p,
      maxTokens: req.max_tokens,
      stopSequences: req.stop
        ? Array.isArray(req.stop)
          ? req.stop
          : [req.stop]
        : undefined,
      presencePenalty: req.presence_penalty,
      frequencyPenalty: req.frequency_penalty,
      seed: req.seed,
      responseFormat: req.response_format
        ? { type: req.response_format.type }
        : undefined,
      // Qwen-specific: thinking mode
      thinking: req.enable_thinking !== undefined
        ? { enabled: req.enable_thinking }
        : undefined,
      // Qwen-specific: web search
      enableSearch: req.enable_search,
    },
    // Store Qwen-specific extensions
    extensions: req.fps !== undefined
      ? { qwen: { fps: req.fps } }
      : undefined,
    raw: request,
  }
}

function parseMessage(msg: QwenMessage): Message {
  return {
    role: msg.role,
    content: parseContent(msg.content),
    name: msg.name,
    toolCalls: msg.tool_calls,
    toolCallId: msg.tool_call_id,
    // Qwen-specific: reasoning content
    reasoningContent: msg.reasoning_content,
  }
}

function parseContent(
  content: string | QwenContentPart[] | null | undefined
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
        text: part.text,
      } as TextContent
    }

    if (part.type === 'image_url') {
      const url = part.image_url.url

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

      return {
        type: 'image',
        source: {
          type: 'url',
          url: url,
        },
      } as ImageContent
    }

    // For audio, video, etc., store as text for now
    return {
      type: 'text',
      text: JSON.stringify(part),
    } as TextContent
  })
}

function parseTool(tool: QwenTool): Tool {
  return {
    type: 'function',
    function: {
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters,
      strict: tool.function.strict,
    },
  }
}

function parseToolChoice(
  choice: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } }
): ToolChoice {
  if (typeof choice === 'string') {
    return choice as ToolChoice
  }
  return {
    type: 'function',
    function: {
      name: choice.function.name,
    },
  }
}
