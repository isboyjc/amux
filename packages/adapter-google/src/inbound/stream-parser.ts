import type { LLMStreamEvent, FinishReason } from '@amux.ai/llm-bridge'

import type { GeminiStreamChunk } from '../types'

// OpenAI-compatible stream chunk type
interface OpenAIStreamChunk {
  id?: string
  model?: string
  choices?: Array<{
    index: number
    delta: {
      role?: string
      content?: string
      tool_calls?: Array<{
        index: number
        id?: string
        function?: {
          name?: string
          arguments?: string
        }
      }>
    }
    finish_reason?: string | null
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

/**
 * Map Gemini finish reason to IR finish reason
 */
function mapFinishReason(reason?: string): FinishReason {
  if (!reason) return 'stop'

  const reasonMap: Record<string, FinishReason> = {
    STOP: 'stop',
    MAX_TOKENS: 'length',
    SAFETY: 'content_filter',
    RECITATION: 'content_filter',
    OTHER: 'stop',
    // OpenAI-compatible reasons
    stop: 'stop',
    length: 'length',
    tool_calls: 'tool_calls',
    content_filter: 'content_filter',
  }
  return reasonMap[reason] ?? 'stop'
}

/**
 * Check if chunk is in OpenAI format
 */
function isOpenAIFormat(chunk: unknown): chunk is OpenAIStreamChunk {
  const c = chunk as Record<string, unknown>
  return Array.isArray(c.choices) && c.choices.length > 0 && 'delta' in (c.choices[0] as Record<string, unknown>)
}

/**
 * Parse Gemini stream chunk to IR stream event
 * Supports both native Gemini format and OpenAI-compatible format
 */
export function parseStream(
  chunk: unknown
): LLMStreamEvent | LLMStreamEvent[] | null {
  // Check if chunk is in OpenAI format
  if (isOpenAIFormat(chunk)) {
    return parseOpenAIStream(chunk)
  }

  // Parse native Gemini format
  return parseGeminiStream(chunk as GeminiStreamChunk)
}

/**
 * Parse OpenAI-compatible stream chunk
 */
function parseOpenAIStream(data: OpenAIStreamChunk): LLMStreamEvent | null {
  if (!data.choices || data.choices.length === 0) {
    // Check for usage-only chunk
    if (data.usage) {
      return {
        type: 'end',
        id: data.id,
        model: data.model,
        usage: {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        },
        raw: data,
      }
    }
    return null
  }

  const choice = data.choices[0]
  if (!choice) return null

  const delta = choice.delta

  // Start event (first chunk with role or empty delta at index 0)
  if (choice.index === 0 && !delta.content && !delta.tool_calls && !choice.finish_reason) {
    return {
      type: 'start',
      id: data.id,
      model: data.model,
      raw: data,
    }
  }

  // Content delta
  if (delta.content) {
    return {
      type: 'content',
      id: data.id,
      model: data.model,
      content: {
        type: 'content',
        delta: delta.content,
        index: choice.index,
      },
      raw: data,
    }
  }

  // Tool call delta
  if (delta.tool_calls && delta.tool_calls.length > 0) {
    const toolCall = delta.tool_calls[0]
    if (toolCall) {
      return {
        type: 'tool_call',
        id: data.id,
        model: data.model,
        toolCall: {
          type: 'tool_call',
          id: toolCall.id,
          name: toolCall.function?.name,
          arguments: toolCall.function?.arguments,
          index: toolCall.index,
        },
        raw: data,
      }
    }
  }

  // End event
  if (choice.finish_reason) {
    return {
      type: 'end',
      id: data.id,
      model: data.model,
      finishReason: mapFinishReason(choice.finish_reason),
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      raw: data,
    }
  }

  return null
}

/**
 * Parse native Gemini stream chunk
 */
function parseGeminiStream(data: GeminiStreamChunk): LLMStreamEvent | LLMStreamEvent[] | null {
  if (!data.candidates || data.candidates.length === 0) {
    // Check for usage-only chunk
    if (data.usageMetadata) {
      return {
        type: 'end',
        model: data.modelVersion,
        usage: {
          promptTokens: data.usageMetadata.promptTokenCount,
          completionTokens: data.usageMetadata.candidatesTokenCount,
          totalTokens: data.usageMetadata.totalTokenCount,
        },
        raw: data,
      }
    }
    return null
  }

  const candidate = data.candidates[0]
  if (!candidate) return null

  const events: LLMStreamEvent[] = []

  // Process parts
  if (candidate.content?.parts) {
    for (const part of candidate.content.parts) {
      if ('text' in part) {
        events.push({
          type: 'content',
          model: data.modelVersion,
          content: {
            type: 'content',
            delta: part.text,
            index: candidate.index ?? 0,
          },
          raw: data,
        })
      } else if ('functionCall' in part) {
        events.push({
          type: 'tool_call',
          model: data.modelVersion,
          toolCall: {
            type: 'tool_call',
            id: `call_${Date.now()}_${part.functionCall.name}`,
            name: part.functionCall.name,
            arguments: JSON.stringify(part.functionCall.args),
            index: candidate.index ?? 0,
          },
          raw: data,
        })
      }
    }
  }

  // End event
  if (candidate.finishReason) {
    events.push({
      type: 'end',
      model: data.modelVersion,
      finishReason: mapFinishReason(candidate.finishReason),
      usage: data.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount,
            completionTokens: data.usageMetadata.candidatesTokenCount,
            totalTokens: data.usageMetadata.totalTokenCount,
          }
        : undefined,
      raw: data,
    })
  }

  if (events.length === 0) {
    return null
  }

  const firstEvent = events[0]
  return events.length === 1 && firstEvent ? firstEvent : events
}
