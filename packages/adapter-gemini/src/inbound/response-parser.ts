import type { LLMResponseIR, Choice, FinishReason, ContentPart, TextContent, ToolUseContent } from '@llm-bridge/core'

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
    const parts = parseParts(candidate.content.parts)
    const toolCalls = extractToolCalls(candidate.content.parts)

    // If all parts are text, simplify to string
    const allText = parts.every((p) => p.type === 'text')
    const content = allText && parts.length === 1
      ? (parts[0] as TextContent).text
      : parts

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

function parseParts(parts: GeminiPart[]): ContentPart[] {
  const result: ContentPart[] = []

  for (const part of parts) {
    if ('text' in part) {
      result.push({
        type: 'text',
        text: part.text,
      } as TextContent)
    } else if ('functionCall' in part) {
      result.push({
        type: 'tool_use',
        id: `call_${Date.now()}_${part.functionCall.name}`,
        name: part.functionCall.name,
        input: part.functionCall.args,
      } as ToolUseContent)
    }
  }

  return result
}

function extractToolCalls(parts: GeminiPart[]): Array<{
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}> {
  const toolCalls: Array<{
    id: string
    type: 'function'
    function: {
      name: string
      arguments: string
    }
  }> = []

  for (const part of parts) {
    if ('functionCall' in part) {
      toolCalls.push({
        id: `call_${Date.now()}_${part.functionCall.name}`,
        type: 'function',
        function: {
          name: part.functionCall.name,
          arguments: JSON.stringify(part.functionCall.args),
        },
      })
    }
  }

  return toolCalls
}
