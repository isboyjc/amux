import type { LLMRequestIR, Message, ContentPart } from '@amux.ai/llm-bridge'

import type { AnthropicRequest, AnthropicMessage, AnthropicContent } from '../types'

/**
 * Build Anthropic request from IR
 */
export function buildRequest(ir: LLMRequestIR): AnthropicRequest {
  // Use ir.system first, then extract from messages as fallback
  let system: string | undefined = ir.system
  const messages: Message[] = []

  for (const msg of ir.messages) {
    if (msg.role === 'system') {
      // Fallback: extract system from messages if ir.system is not set
      if (!system) {
        system = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      }
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
  const content: AnthropicContent[] = []

  // Build content from message content
  if (typeof msg.content === 'string') {
    if (msg.content) {
      content.push({ type: 'text', text: msg.content })
    }
  } else if (Array.isArray(msg.content)) {
    for (const part of msg.content) {
      content.push(buildContentPart(part))
    }
  }

  // Handle tool role messages (tool results)
  if (msg.role === 'tool' && msg.toolCallId) {
    const resultContent = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
    return {
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: msg.toolCallId,
        content: resultContent,
      }],
    }
  }

  // Handle toolCalls (OpenAI-style) - convert to Anthropic tool_use content
  if (msg.toolCalls && msg.toolCalls.length > 0) {
    for (const toolCall of msg.toolCalls) {
      content.push({
        type: 'tool_use',
        id: toolCall.id,
        name: toolCall.function.name,
        input: JSON.parse(toolCall.function.arguments),
      })
    }
  }

  // If no content, add empty text to avoid empty content array
  if (content.length === 0) {
    content.push({ type: 'text', text: '' })
  }

  // Simplify to string if only one text content
  const firstContent = content[0]
  const simplifiedContent = content.length === 1 && firstContent?.type === 'text'
    ? firstContent.text
    : content

  return {
    role: msg.role === 'user' ? 'user' : 'assistant',
    content: simplifiedContent,
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
    default:
      return {
        type: 'text',
        text: JSON.stringify(part),
      }
  }
}
