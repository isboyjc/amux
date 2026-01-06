import type { LLMRequestIR, Message, ContentPart } from '@llm-bridge/core'

import type { AnthropicRequest, AnthropicMessage, AnthropicContent } from '../types'

/**
 * Parse Anthropic request to IR
 */
export function parseRequest(request: unknown): LLMRequestIR {
  const req = request as AnthropicRequest

  // Parse messages
  const messages: Message[] = req.messages.map((msg) => parseMessage(msg))

  // Add system message if present
  if (req.system) {
    messages.unshift({
      role: 'system',
      content: req.system,
    })
  }

  return {
    messages,
    model: req.model,
    tools: req.tools?.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    })),
    toolChoice: req.tool_choice
      ? req.tool_choice.type === 'any'
        ? 'required'
        : req.tool_choice.type === 'auto'
        ? 'auto'
        : req.tool_choice.name
        ? { type: 'function', function: { name: req.tool_choice.name } }
        : undefined
      : undefined,
    stream: req.stream,
    generation: {
      maxTokens: req.max_tokens,
      temperature: req.temperature,
      topP: req.top_p,
      topK: req.top_k,
      stopSequences: req.stop_sequences,
    },
    metadata: {
      userId: req.metadata?.user_id,
    },
    raw: request,
  }
}

function parseMessage(msg: AnthropicMessage): Message {
  if (typeof msg.content === 'string') {
    return {
      role: msg.role,
      content: msg.content,
    }
  }

  // Parse content parts
  const contentParts: ContentPart[] = msg.content.map((part) => parseContentPart(part))

  return {
    role: msg.role,
    content: contentParts,
  }
}

function parseContentPart(part: AnthropicContent): ContentPart {
  switch (part.type) {
    case 'text':
      return {
        type: 'text',
        text: part.text,
      }
    case 'image':
      return {
        type: 'image',
        source: part.source.data
          ? {
              type: 'base64',
              mediaType: part.source.media_type ?? 'image/jpeg',
              data: part.source.data,
            }
          : {
              type: 'url',
              url: part.source.url ?? '',
            },
      }
    case 'tool_use':
      return {
        type: 'tool_use',
        id: part.id,
        name: part.name,
        input: part.input,
      }
    case 'tool_result':
      return {
        type: 'tool_result',
        toolUseId: part.tool_use_id,
        content: typeof part.content === 'string' ? part.content : JSON.stringify(part.content),
        isError: part.is_error,
      }
    default:
      return {
        type: 'text',
        text: JSON.stringify(part),
      }
  }
}
