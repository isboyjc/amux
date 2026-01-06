import type { LLMStreamEvent, FinishReason, ContentPart, TextContent, ToolUseContent } from '@llm-bridge/core'

import type { GeminiStreamChunk, GeminiPart } from '../types'

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
  }
  return reasonMap[reason] ?? 'stop'
}

/**
 * Parse Gemini stream chunk to IR stream event
 */
export function parseStream(
  chunk: unknown
): LLMStreamEvent | LLMStreamEvent[] | null {
  const data = chunk as GeminiStreamChunk

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
        raw: chunk,
      }
    }
    return null
  }

  const candidate = data.candidates[0]
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
          raw: chunk,
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
          raw: chunk,
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
      raw: chunk,
    })
  }

  if (events.length === 0) {
    return null
  }

  return events.length === 1 ? events[0] : events
}
