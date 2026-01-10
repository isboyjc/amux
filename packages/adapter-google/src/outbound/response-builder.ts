import type { LLMResponseIR, ContentPart, TextContent } from '@amux/llm-bridge'

import type { GeminiResponse, GeminiPart } from '../types'

/**
 * Map IR finish reason to Gemini finish reason
 */
function mapFinishReason(reason?: string): 'STOP' | 'MAX_TOKENS' | 'SAFETY' | 'OTHER' {
  if (!reason) return 'STOP'

  const reasonMap: Record<string, 'STOP' | 'MAX_TOKENS' | 'SAFETY' | 'OTHER'> = {
    stop: 'STOP',
    length: 'MAX_TOKENS',
    tool_calls: 'STOP',
    content_filter: 'SAFETY',
    error: 'OTHER',
  }
  return reasonMap[reason] ?? 'STOP'
}

/**
 * Build Gemini response from IR
 */
export function buildResponse(ir: LLMResponseIR): GeminiResponse {
  return {
    candidates: ir.choices.map((choice) => ({
      content: {
        role: 'model' as const,
        parts: buildParts(choice.message.content, choice.message.toolCalls),
      },
      finishReason: mapFinishReason(choice.finishReason),
      index: choice.index,
    })),
    usageMetadata: ir.usage
      ? {
          promptTokenCount: ir.usage.promptTokens,
          candidatesTokenCount: ir.usage.completionTokens,
          totalTokenCount: ir.usage.totalTokens,
          cachedContentTokenCount: ir.usage.details?.cachedTokens,
        }
      : undefined,
    responseId: ir.id,
    modelVersion: ir.model,
  }
}

function buildParts(
  content: string | ContentPart[],
  toolCalls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>
): GeminiPart[] {
  const parts: GeminiPart[] = []

  if (typeof content === 'string') {
    if (content) {
      parts.push({ text: content })
    }
  } else if (Array.isArray(content)) {
    for (const part of content) {
      if (part.type === 'text') {
        parts.push({ text: (part as TextContent).text })
      }
      // Note: tool_use is no longer a ContentPart type, toolCalls are handled separately below
    }
  }

  // Add tool calls as function calls (OpenAI-style toolCalls)
  if (toolCalls) {
    for (const toolCall of toolCalls) {
      parts.push({
        functionCall: {
          name: toolCall.function.name,
          args: JSON.parse(toolCall.function.arguments),
        },
      })
    }
  }

  return parts
}
