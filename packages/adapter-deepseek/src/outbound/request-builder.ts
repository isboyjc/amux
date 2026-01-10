import type { LLMRequestIR, ContentPart, ImageContent } from '@amux/llm-bridge'

import type { DeepSeekRequest, DeepSeekMessage, DeepSeekContentPart } from '../types'

/**
 * Build DeepSeek request from IR
 */
export function buildRequest(ir: LLMRequestIR): DeepSeekRequest {
  const messages: DeepSeekMessage[] = []
  const isReasonerModel = ir.model?.includes('reasoner')

  // Add system message if present (from ir.system field)
  // Note: DeepSeek Reasoner does NOT support system messages
  if (ir.system && !isReasonerModel) {
    messages.push({
      role: 'system',
      content: ir.system,
    })
  }

  // Add conversation messages
  for (const msg of ir.messages) {
    // DeepSeek Reasoner: Skip system messages entirely
    // The API will return error if system messages are included
    if (isReasonerModel && msg.role === 'system') {
      continue
    }

    const message: DeepSeekMessage = {
      role: msg.role,
      content: buildContent(msg.content),
      name: msg.name,
      tool_calls: msg.toolCalls,
      tool_call_id: msg.toolCallId,
    }

    // DeepSeek Reasoner: Do NOT include reasoning_content in input messages
    // The API will return 400 error if reasoning_content is included
    if (!isReasonerModel && msg.reasoningContent !== undefined) {
      message.reasoning_content = msg.reasoningContent
    }

    messages.push(message)
  }

  const request: DeepSeekRequest = {
    model: ir.model ?? 'deepseek-chat',
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
      // DeepSeek max_tokens limit: 1-8192
      request.max_tokens = Math.min(Math.max(ir.generation.maxTokens, 1), 8192)
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
    if (ir.generation.responseFormat) {
      // DeepSeek only supports text and json_object
      if (ir.generation.responseFormat.type === 'json_object') {
        request.response_format = { type: 'json_object' }
      }
    }
    if (ir.generation.logprobs !== undefined) {
      request.logprobs = ir.generation.logprobs
    }
    if (ir.generation.topLogprobs !== undefined) {
      request.top_logprobs = ir.generation.topLogprobs
    }
    // DeepSeek-specific: thinking mode
    if (ir.generation.thinking) {
      request.thinking = {
        type: ir.generation.thinking.enabled ? 'enabled' : 'disabled',
      }
    }
  }

  // Add stream options for usage in streaming
  if (ir.stream) {
    request.stream_options = { include_usage: true }
  }

  return request
}

function buildContent(
  content: string | ContentPart[]
): string | DeepSeekContentPart[] | null {
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
  return content.map((part): DeepSeekContentPart => {
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
