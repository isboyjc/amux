import type { LLMResponseIR, Choice, FinishReason, Role, ToolCall } from '@amux.ai/llm-bridge'

import type { ResponsesResponse, ResponsesOutputItem } from '../types'

/**
 * Map Responses API status to IR finish reason
 */
function mapFinishReason(status: string): FinishReason {
  const statusMap: Record<string, FinishReason> = {
    completed: 'stop',
    failed: 'stop',
    incomplete: 'length',
    in_progress: 'stop',
  }
  return statusMap[status] ?? 'stop'
}

/**
 * Parse Responses API response to IR
 */
export function parseResponsesResponse(response: unknown): LLMResponseIR {
  const res = response as ResponsesResponse

  // Extract content and tool calls from output
  const { content, toolCalls, reasoning } = extractOutputContent(res.output, res.output_text)

  const choices: Choice[] = [
    {
      index: 0,
      message: {
        role: 'assistant' as Role,
        content: content,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        reasoningContent: reasoning || undefined,
      },
      finishReason: mapFinishReason(res.status),
    },
  ]

  return {
    id: res.id,
    model: res.model,
    choices,
    created: res.created_at,
    usage: res.usage
      ? {
          promptTokens: res.usage.input_tokens,
          completionTokens: res.usage.output_tokens,
          totalTokens: res.usage.total_tokens,
          details: {
            ...(res.usage.output_tokens_details?.reasoning_tokens
              ? { reasoningTokens: res.usage.output_tokens_details.reasoning_tokens }
              : {}),
            ...(res.usage.input_tokens_details?.cached_tokens
              ? { cachedTokens: res.usage.input_tokens_details.cached_tokens }
              : {}),
          },
        }
      : undefined,
    raw: response,
  }
}

function extractOutputContent(output: ResponsesOutputItem[], outputText?: string): {
  content: string
  toolCalls: ToolCall[]
  reasoning: string | null
} {
  let content = ''
  const toolCalls: ToolCall[] = []
  let reasoning: string | null = null

  // Use output_text shortcut if available and no complex output
  if (outputText && (!output || output.length === 0)) {
    return { content: outputText, toolCalls: [], reasoning: null }
  }

  for (const item of output) {
    if (item.type === 'message') {
      // Extract text content
      for (const part of item.content) {
        if (part.type === 'output_text') {
          content += part.text
        } else if (part.type === 'refusal') {
          content += `[Refusal: ${part.refusal}]`
        }
      }
    } else if (item.type === 'function_call') {
      toolCalls.push({
        id: item.call_id,
        type: 'function',
        function: {
          name: item.name,
          arguments: item.arguments,
        },
      })
    } else if (item.type === 'reasoning') {
      // Extract reasoning content from summary array
      const reasoningItem = item as { type: 'reasoning'; summary?: Array<{ type: string; text: string }>; content?: Array<{ type: string; text: string }> }
      if (reasoningItem.summary && reasoningItem.summary.length > 0) {
        reasoning = reasoningItem.summary
          .filter((s) => s.type === 'summary_text')
          .map((s) => s.text)
          .join('')
      } else if (reasoningItem.content && reasoningItem.content.length > 0) {
        // Fallback to content array for backwards compatibility
        reasoning = reasoningItem.content
          .filter((c) => c.type === 'reasoning_text')
          .map((c) => c.text)
          .join('')
      }
    }
  }

  // Fallback to output_text if no content extracted from output array
  if (!content && outputText) {
    content = outputText
  }

  return { content, toolCalls, reasoning }
}
