import type { LLMResponseIR, Choice, Role } from '@amux.ai/llm-bridge'
import { mapFinishReason } from '@amux.ai/llm-bridge'

import type { MinimaxResponse } from '../types'

/**
 * Parse MiniMax response to IR
 */
export function parseResponse(response: unknown): LLMResponseIR {
  const res = response as MinimaxResponse

  const choices: Choice[] = res.choices.map((choice) => ({
    index: choice.index,
    message: {
      role: choice.message.role as Role,
      content: choice.message.content ?? '',
      toolCalls: choice.message.tool_calls,
      // MiniMax-specific: reasoning details
      reasoningContent: choice.message.reasoning_details
        ? choice.message.reasoning_details.map((detail) => detail.text).join('\n')
        : undefined,
    },
    finishReason: mapFinishReason(choice.finish_reason),
    logprobs: choice.logprobs,
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
          details: {
            reasoningTokens: res.usage.completion_tokens_details?.reasoning_tokens,
          },
        }
      : undefined,
    raw: response,
  }
}
