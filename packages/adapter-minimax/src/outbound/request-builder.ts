import type { LLMRequestIR, ContentPart, ImageContent } from '@amux.ai/llm-bridge'

import type {
  MinimaxRequest,
  MinimaxMessage,
  MinimaxContentPart,
} from '../types'

/**
 * Build MiniMax request from IR
 */
export function buildRequest(ir: LLMRequestIR): MinimaxRequest {
  const messages: MinimaxMessage[] = []

  // Add system message if present (from ir.system field)
  if (ir.system) {
    messages.push({
      role: 'system',
      content: ir.system,
    })
  }

  // Add conversation messages
  for (const msg of ir.messages) {
    const message: MinimaxMessage = {
      role: msg.role,
      content: buildContent(msg.content),
      name: msg.name,
      tool_calls: msg.toolCalls,
      tool_call_id: msg.toolCallId,
    }

    // MiniMax-specific: Convert reasoningContent to reasoning_details
    if (msg.reasoningContent !== undefined) {
      message.reasoning_details = [
        {
          type: 'thinking',
          text: msg.reasoningContent,
        },
      ]
    }

    messages.push(message)
  }

  const request: MinimaxRequest = {
    model: ir.model ?? 'MiniMax-M2.1',
    messages,
    stream: ir.stream,
  }

  // Add tools if present
  if (ir.tools && ir.tools.length > 0) {
    request.tools = ir.tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
        strict: tool.function.strict,
      },
    }))
  }

  // Add tool choice if present
  if (ir.toolChoice) {
    request.tool_choice = ir.toolChoice
  }

  // Add generation parameters
  if (ir.generation) {
    if (ir.generation.temperature !== undefined) {
      // MiniMax temperature range: (0.0, 1.0]
      request.temperature = Math.min(Math.max(ir.generation.temperature, 0.01), 1.0)
    }
    if (ir.generation.topP !== undefined) {
      request.top_p = ir.generation.topP
    }
    if (ir.generation.maxTokens !== undefined) {
      request.max_tokens = ir.generation.maxTokens
    }
    if (ir.generation.stopSequences && ir.generation.stopSequences.length > 0) {
      request.stop = ir.generation.stopSequences
    }
    if (ir.generation.responseFormat) {
      // MiniMax only supports text and json_object
      if (ir.generation.responseFormat.type === 'json_object') {
        request.response_format = { type: 'json_object' }
      }
    }
  }

  // Add stream options for usage in streaming
  if (ir.stream) {
    request.stream_options = { include_usage: true }
  }

  // MiniMax-specific: Enable reasoning split (default: true)
  // This separates thinking content (<think> tags) into reasoning_details field
  let reasoningSplit = true // Default to true for better UX
  if (ir.extensions?.minimax) {
    const minimaxExt = ir.extensions.minimax as { reasoning_split?: boolean }
    if (minimaxExt.reasoning_split !== undefined) {
      reasoningSplit = minimaxExt.reasoning_split
    }
  }
  request.reasoning_split = reasoningSplit

  return request
}

function buildContent(
  content: string | ContentPart[]
): string | MinimaxContentPart[] | null {
  if (typeof content === 'string') {
    return content || null
  }

  if (!content || content.length === 0) {
    return null
  }

  // Check if all parts are text - if so, concatenate them
  const allText = content.every((part) => part.type === 'text')
  if (allText) {
    return content
      .map((part) => (part.type === 'text' ? part.text : ''))
      .join('')
  }

  // Build multimodal content
  return content.map((part): MinimaxContentPart => {
    if (part.type === 'text') {
      return { type: 'text', text: part.text }
    }

    if (part.type === 'image') {
      const imgPart = part as ImageContent
      if (imgPart.source.type === 'url') {
        return {
          type: 'image_url',
          image_url: { url: imgPart.source.url },
        }
      }
      return {
        type: 'image_url',
        image_url: {
          url: `data:${imgPart.source.mediaType};base64,${imgPart.source.data}`,
        },
      }
    }

    return { type: 'text', text: JSON.stringify(part) }
  })
}
