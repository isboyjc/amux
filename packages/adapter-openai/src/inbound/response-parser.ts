import type { LLMResponseIR, Choice, FinishReason, Role } from '@llm-bridge/core'

import type { OpenAIResponse } from '../types'

/**
 * Map OpenAI finish reason to IR finish reason
 */
function mapFinishReason(reason: string): FinishReason {
  const reasonMap: Record<string, FinishReason> = {
    stop: 'stop',
    length: 'length',
    tool_calls: 'tool_calls',
    content_filter: 'content_filter',
    function_call: 'tool_calls', // Legacy
  }
  return reasonMap[reason] ?? 'stop'
}

/**
 * Parse OpenAI response to IR
 */
export function parseResponse(response: unknown): LLMResponseIR {
  const res = response as OpenAIResponse

  const choices: Choice[] = res.choices.map((choice) => ({
    index: choice.index,
    message: {
      role: choice.message.role as Role,
      content: choice.message.content ?? '',
      toolCalls: choice.message.tool_calls,
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
          details: res.usage.completion_tokens_details
            ? {
                reasoningTokens: res.usage.completion_tokens_details.reasoning_tokens,
              }
            : undefined,
        }
      : undefined,
    raw: response,
  }
}
