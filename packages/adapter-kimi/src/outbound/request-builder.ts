import type { LLMRequestIR, ContentPart } from '@llm-bridge/core'

import type { KimiRequest, KimiMessage } from '../types'

/**
 * Build Kimi request from IR
 */
export function buildRequest(ir: LLMRequestIR): KimiRequest {
  const messages: KimiMessage[] = []

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
    })
  }

  const request: KimiRequest = {
    model: ir.model ?? 'moonshot-v1-8k',
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
      },
    }))
  }

  // Add tool choice if present (Kimi doesn't support 'required')
  if (ir.toolChoice && ir.toolChoice !== 'required') {
    request.tool_choice = ir.toolChoice as KimiRequest['tool_choice']
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
    if (ir.generation.n !== undefined) {
      request.n = ir.generation.n
    }
    if (ir.generation.responseFormat) {
      if (ir.generation.responseFormat.type === 'json_object') {
        request.response_format = { type: 'json_object' }
      }
    }
  }

  // Add stream options for usage in streaming
  if (ir.stream) {
    request.stream_options = { include_usage: true }
  }

  return request
}

function buildContent(content: string | ContentPart[]): string | null {
  if (typeof content === 'string') {
    return content || null
  }

  if (!content || content.length === 0) {
    return null
  }

  // Kimi doesn't support multimodal, concatenate text parts
  return content
    .filter((part) => part.type === 'text')
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('')
}
