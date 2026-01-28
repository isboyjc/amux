import type { LLMResponseIR, ContentPart, ToolCall } from '@amux.ai/llm-bridge'

import type { MinimaxResponse, MinimaxReasoningDetail } from '../types'

/**
 * Build MiniMax response from IR
 */
export function buildResponse(ir: LLMResponseIR): MinimaxResponse {
  return {
    id: ir.id ?? `minimax-${Date.now()}`,
    object: 'chat.completion',
    created: ir.created ?? Math.floor(Date.now() / 1000),
    model: ir.model ?? 'MiniMax-M2.1',
    system_fingerprint: ir.systemFingerprint,
    choices: ir.choices.map((choice) => {
      const reasoningDetails: MinimaxReasoningDetail[] | undefined =
        choice.message.reasoningContent
          ? [
              {
                type: 'thinking',
                text: choice.message.reasoningContent,
              },
            ]
          : undefined

      return {
        index: choice.index,
        message: {
          role: choice.message.role,
          content: buildContent(choice.message.content),
          tool_calls: choice.message.toolCalls as ToolCall[] | undefined,
          reasoning_details: reasoningDetails,
        },
        finish_reason: mapFinishReason(choice.finishReason ?? 'stop'),
        logprobs: choice.logprobs,
      }
    }),
    usage: ir.usage
      ? {
          prompt_tokens: ir.usage.promptTokens,
          completion_tokens: ir.usage.completionTokens,
          total_tokens: ir.usage.totalTokens,
          completion_tokens_details: ir.usage.details?.reasoningTokens
            ? {
                reasoning_tokens: ir.usage.details.reasoningTokens,
              }
            : undefined,
        }
      : undefined,
  }
}

function buildContent(content: string | ContentPart[]): string | null {
  if (typeof content === 'string') {
    return content || null
  }

  if (!content || content.length === 0) {
    return null
  }

  // For MiniMax, we only return text content
  // Multimodal content in responses is not supported
  return content
    .map((part) => {
      if (part.type === 'text') return part.text
      return JSON.stringify(part)
    })
    .join('')
}

function mapFinishReason(reason: string): string {
  const reasonMap: Record<string, string> = {
    stop: 'stop',
    length: 'length',
    tool_calls: 'tool_calls',
    content_filter: 'content_filter',
    error: 'stop',
  }
  return reasonMap[reason] ?? 'stop'
}
