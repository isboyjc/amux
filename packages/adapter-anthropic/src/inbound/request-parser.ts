import type { LLMRequestIR, Message, ContentPart, ToolCall } from '@amux/llm-bridge'

import type { AnthropicRequest, AnthropicMessage, AnthropicContent } from '../types'

/**
 * Parse Anthropic request to IR
 */
export function parseRequest(request: unknown): LLMRequestIR {
  const req = request as AnthropicRequest

  // Parse messages - need to handle tool_use and tool_result specially
  const messages: Message[] = []
  for (const msg of req.messages) {
    const parsed = parseMessage(msg)
    messages.push(...parsed)
  }

  return {
    messages,
    model: req.model,
    // Set system directly in IR instead of adding to messages
    system: req.system,
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

/**
 * Parse Anthropic message to IR messages
 * May return multiple messages if tool_result is present (each tool_result becomes a separate tool message)
 */
function parseMessage(msg: AnthropicMessage): Message[] {
  if (typeof msg.content === 'string') {
    return [{
      role: msg.role,
      content: msg.content,
    }]
  }

  // Separate content into regular content, tool_use, and tool_result
  const contentParts: ContentPart[] = []
  const toolCalls: ToolCall[] = []
  const toolResults: Message[] = []

  for (const part of msg.content) {
    if (part.type === 'tool_use') {
      // Convert tool_use to OpenAI-style toolCalls
      toolCalls.push({
        id: part.id,
        type: 'function',
        function: {
          name: part.name,
          arguments: JSON.stringify(part.input),
        },
      })
    } else if (part.type === 'tool_result') {
      // Convert tool_result to tool role message
      toolResults.push({
        role: 'tool',
        content: typeof part.content === 'string' ? part.content : JSON.stringify(part.content),
        toolCallId: part.tool_use_id,
      })
    } else {
      // Regular content (text, image)
      contentParts.push(parseContentPart(part))
    }
  }

  const messages: Message[] = []

  // Create main message with content and toolCalls
  if (contentParts.length > 0 || toolCalls.length > 0) {
    const message: Message = {
      role: msg.role,
      content: contentParts.length === 1 && contentParts[0]?.type === 'text'
        ? contentParts[0].text
        : contentParts.length > 0
        ? contentParts
        : '',
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
    default:
      return {
        type: 'text',
        text: JSON.stringify(part),
      }
  }
}
