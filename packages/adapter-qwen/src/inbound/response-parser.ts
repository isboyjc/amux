import type { LLMResponseIR, Choice, Role } from '@amux/llm-bridge'
import { mapFinishReason, parseOpenAIUsage } from '@amux/llm-bridge'

import type { QwenResponse } from '../types'

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
    usage: parseOpenAIUsage(res.usage),
    raw: response,
  }
}
