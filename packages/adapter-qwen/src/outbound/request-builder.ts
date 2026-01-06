import type { LLMRequestIR, ContentPart, ImageContent } from '@llm-bridge/core'

import type { QwenRequest, QwenMessage, QwenContentPart } from '../types'

/**
 * Build Qwen request from IR
 */
export function buildRequest(ir: LLMRequestIR): QwenRequest {
  const messages: QwenMessage[] = []

  // Add system message if present
  if (ir.system) {
    messages.push({
      role: 'system',
      content: ir.system,
    })
  }

  // Add conversation messages
  for (const msg of ir.messages) {
    messages.push({
      role: msg.role,
      content: buildContent(msg.content),
      name: msg.name,
      tool_calls: msg.toolCalls,
      tool_call_id: msg.toolCallId,
      // Qwen-specific: reasoning content
      reasoning_content: msg.reasoningContent,
    })
  }

  const request: QwenRequest = {
    model: ir.model ?? 'qwen-plus',
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
      request.temperature = ir.generation.temperature
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
    if (ir.generation.presencePenalty !== undefined) {
      request.presence_penalty = ir.generation.presencePenalty
    }
    if (ir.generation.frequencyPenalty !== undefined) {
      request.frequency_penalty = ir.generation.frequencyPenalty
    }
    if (ir.generation.seed !== undefined) {
      request.seed = ir.generation.seed
    }
    if (ir.generation.responseFormat) {
      if (ir.generation.responseFormat.type === 'json_object') {
        request.response_format = { type: 'json_object' }
      }
    }
    // Qwen-specific: thinking mode
    if (ir.generation.thinking) {
      request.enable_thinking = ir.generation.thinking.enabled
    }
    // Qwen-specific: web search
    if (ir.generation.enableSearch !== undefined) {
      request.enable_search = ir.generation.enableSearch
    }
  }

  // Qwen-specific: fps for video
  if (ir.extensions?.qwen?.fps !== undefined) {
    request.fps = ir.extensions.qwen.fps as number
  }

  // Add stream options for usage in streaming
  if (ir.stream) {
    request.stream_options = { include_usage: true }
  }

  return request
}

function buildContent(
  content: string | ContentPart[]
): string | QwenContentPart[] | null {
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
  return content.map((part): QwenContentPart => {
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
