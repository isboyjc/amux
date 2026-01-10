import type { LLMResponseIR, Choice, FinishReason, ContentPart, TextContent, ToolCall } from '@amux/llm-bridge'

import type { GeminiResponse, GeminiPart } from '../types'

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
 * Parse Gemini response to IR
 */
export function parseResponse(response: unknown): LLMResponseIR {
  const res = response as GeminiResponse

  const choices: Choice[] = res.candidates.map((candidate, index) => {
    const { contentParts, toolCalls } = parseParts(candidate.content.parts)

    // If all parts are text, simplify to string
    const allText = contentParts.every((p) => p.type === 'text')
    const content = allText && contentParts.length === 1
      ? (contentParts[0] as TextContent).text
      : contentParts

    return {
      index: candidate.index ?? index,
      message: {
        role: 'assistant' as const,
        content,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      },
      finishReason: mapFinishReason(candidate.finishReason),
    }
  })

  return {
    id: res.responseId ?? `gemini-${Date.now()}`,
    model: res.modelVersion ?? 'gemini',
    choices,
    usage: res.usageMetadata
      ? {
          promptTokens: res.usageMetadata.promptTokenCount,
          completionTokens: res.usageMetadata.candidatesTokenCount,
          totalTokens: res.usageMetadata.totalTokenCount,
          details: res.usageMetadata.cachedContentTokenCount
            ? { cachedTokens: res.usageMetadata.cachedContentTokenCount }
            : undefined,
        }
      : undefined,
    raw: response,
  }
}

/**
 * Parse Gemini parts to IR content parts and tool calls
 */
function parseParts(parts: GeminiPart[]): { contentParts: ContentPart[]; toolCalls: ToolCall[] } {
  const contentParts: ContentPart[] = []
  const toolCalls: ToolCall[] = []

  for (const part of parts) {
    if ('text' in part) {
      contentParts.push({
        type: 'text',
        text: part.text,
      } as TextContent)
    } else if ('functionCall' in part) {
      // Convert to OpenAI-style toolCalls
      toolCalls.push({
        id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'function',
        function: {
          name: part.functionCall.name,
          arguments: JSON.stringify(part.functionCall.args),
        },
      })
    }
  }

  return { contentParts, toolCalls }
}
