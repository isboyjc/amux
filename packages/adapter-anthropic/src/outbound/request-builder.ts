import type { LLMRequestIR, Message, ContentPart } from '@llm-bridge/core'

import type { AnthropicRequest, AnthropicMessage, AnthropicContent } from '../types'

/**
 * Build Anthropic request from IR
 */
export function buildRequest(ir: LLMRequestIR): AnthropicRequest {
  // Extract system message
  let system: string | undefined
  const messages: Message[] = []

  for (const msg of ir.messages) {
    if (msg.role === 'system') {
      system = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
    } else {
      messages.push(msg)
    }
  }

  return {
    model: ir.model ?? 'claude-3-5-sonnet-20241022',
    messages: messages.map((msg) => buildMessage(msg)),
    system,
    tools: ir.tools?.map((tool) => ({
      name: tool.function.name,
      description: tool.function.description,
      input_schema: tool.function.parameters ?? { type: 'object', properties: {} },
    })),
    tool_choice: ir.toolChoice
      ? typeof ir.toolChoice === 'string'
        ? ir.toolChoice === 'required'
          ? { type: 'any' }
          : { type: ir.toolChoice }
        : { type: 'tool', name: ir.toolChoice.function.name }
      : undefined,
    max_tokens: ir.generation?.maxTokens ?? 4096,
    temperature: ir.generation?.temperature,
    top_p: ir.generation?.topP,
    top_k: ir.generation?.topK,
    stop_sequences: ir.generation?.stopSequences,
    stream: ir.stream,
    metadata: ir.metadata?.userId
      ? {
          user_id: ir.metadata.userId as string,
        }
      : undefined,
  }
}

function buildMessage(msg: Message): AnthropicMessage {
  if (typeof msg.content === 'string') {
    return {
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }
  }

  // Build content parts
  const content: AnthropicContent[] = msg.content.map((part) => buildContentPart(part))

  return {
    role: msg.role === 'user' ? 'user' : 'assistant',
    content,
  }
}

function buildContentPart(part: ContentPart): AnthropicContent {
  switch (part.type) {
    case 'text':
      return {
        type: 'text',
        text: part.text,
      }
    case 'image':
      return {
        type: 'image',
        source:
          part.source.type === 'base64'
            ? {
                type: 'base64',
                media_type: part.source.mediaType,
                data: part.source.data,
              }
            : {
                type: 'url',
                url: part.source.url,
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
        tool_use_id: part.toolUseId,
        content: part.content,
        is_error: part.isError,
      }
    default:
      return {
        type: 'text',
        text: JSON.stringify(part),
      }
  }
}
