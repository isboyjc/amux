import type {
  LLMRequestIR,
  Message,
  Tool,
  ToolChoice,
  ContentPart,
  TextContent,
  ImageContent,
} from '@amux.ai/llm-bridge'

import type { OpenAIRequest, OpenAIMessage, OpenAITool, OpenAIContentPart } from '../types'

/**
 * Parse OpenAI request to IR
 */
export function parseRequest(request: unknown): LLMRequestIR {
  const req = request as OpenAIRequest

  // Extract system message if present
  let system: string | undefined
  const messages: Message[] = []

  for (const msg of req.messages) {
    if (msg.role === 'system') {
      // Collect system messages
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
      maxTokens: req.max_tokens ?? req.max_completion_tokens,
      stopSequences: req.stop
        ? Array.isArray(req.stop)
          ? req.stop
          : [req.stop]
        : undefined,
      presencePenalty: req.presence_penalty,
      frequencyPenalty: req.frequency_penalty,
      n: req.n,
      seed: req.seed,
      responseFormat: req.response_format
        ? {
            type: req.response_format.type,
            jsonSchema: req.response_format.json_schema,
          }
        : undefined,
      logprobs: req.logprobs,
      topLogprobs: req.top_logprobs,
    },
    metadata: {
      userId: req.user,
    },
    raw: request,
  }
}

function parseMessage(msg: OpenAIMessage): Message {
  return {
    role: msg.role,
    content: parseContent(msg.content),
    name: msg.name,
    toolCalls: msg.tool_calls,
    toolCallId: msg.tool_call_id,
  }
}

function parseContent(
  content: string | OpenAIContentPart[] | null | undefined
): string | ContentPart[] {
  if (content === null || content === undefined) {
    return ''
  }

  if (typeof content === 'string') {
    return content
  }

  // Parse multimodal content
  return content.map((part): ContentPart => {
    if (part.type === 'text') {
      return {
        type: 'text',
        text: part.text,
      } as TextContent
    }

    if (part.type === 'image_url') {
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

    // Fallback for unknown types
    return {
      type: 'text',
      text: JSON.stringify(part),
    } as TextContent
  })
}

function parseTool(tool: OpenAITool): Tool {
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
