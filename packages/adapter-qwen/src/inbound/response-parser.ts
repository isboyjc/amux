import type { LLMResponseIR, Choice, FinishReason, Role } from '@llm-bridge/core'

import type { QwenResponse } from '../types'

/**
 * Map Qwen finish reason to IR finish reason
 */
function mapFinishReason(reason: string): FinishReason {
  const reasonMap: Record<string, FinishReason> = {
    stop: 'stop',
    length: 'length',
    tool_calls: 'tool_calls',
    content_filter: 'content_filter',
  }
  return reasonMap[reason] ?? 'stop'
}

/**
 * Parse Qwen response to IR
 */
export function parseResponse(response: unknown): LLMResponseIR {
  const res = response as QwenResponse

  const choices: Choice[] = res.choices.map((choice) => ({
    index: choice.index,
    message: {
      role: choice.message.role as Role,
      content: choice.message.content ?? '',
      toolCalls: choice.message.tool_calls,
      // Qwen-specific: reasoning content
      reasoningContent: choice.message.reasoning_content,
    },
    finishReason: mapFinishReason(choice.finish_reason),
  }))

  return {
    id: res.id,
    model: res.model,
    choices,
    created: res.created,
    systemFingerprint: res.system_fingerprint,
    usage: res.usage
      ? {
          promptTokens: res.usage.prompt_tokens,
          completionTokens: res.usage.completion_tokens,
          totalTokens: res.usage.total_tokens,
        }
      : undefined,
    raw: response,
  }
}
