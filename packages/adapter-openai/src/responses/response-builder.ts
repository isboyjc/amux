import type { LLMResponseIR, ContentPart } from '@amux.ai/llm-bridge'

import type { ResponsesResponse, ResponsesOutputItem, ResponsesOutputContent } from '../types'

/**
 * Convert content to appropriate format for Responses API
 */
function contentToOutput(content: string | ContentPart[]): ResponsesOutputContent[] {
  if (typeof content === 'string') {
    return content ? [{ type: 'output_text', text: content }] : []
  }

  if (!content || content.length === 0) {
    return []
  }

  // Concatenate text parts
  const text = content
    .filter((part) => part.type === 'text')
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('')

  return text ? [{ type: 'output_text', text }] : []
}

/**
 * Build Responses API response from IR
 */
export function buildResponsesResponse(ir: LLMResponseIR): ResponsesResponse {
  const output: ResponsesOutputItem[] = []

  // Build message output from first choice
  const choice = ir.choices[0]
  if (choice) {
    // Add message content
    const messageContent = contentToOutput(choice.message.content)
    if (messageContent.length > 0) {
      output.push({
        type: 'message',
        id: `msg_${ir.id}`,
        role: 'assistant',
        content: messageContent,
        status: 'completed',
      })
    }

    // Add function calls
    if (choice.message.toolCalls) {
      for (const toolCall of choice.message.toolCalls) {
        output.push({
          type: 'function_call',
          id: `fc_${toolCall.id}`,
          call_id: toolCall.id,
          name: toolCall.function.name,
          arguments: toolCall.function.arguments,
          status: 'completed',
        })
      }
    }

    // Add reasoning if present (should be first in output array)
    if (choice.message.reasoningContent) {
      // Insert reasoning at the beginning of output array
      output.unshift({
        type: 'reasoning',
        id: `rs_${ir.id}`,
        content: [{ type: 'reasoning_text', text: choice.message.reasoningContent }],
      })
    }
  }

  return {
    id: ir.id,
    object: 'response',
    created_at: ir.created ?? Math.floor(Date.now() / 1000),
    model: ir.model,
    status: 'completed',
    output,
    usage: ir.usage
      ? {
          input_tokens: ir.usage.promptTokens,
          output_tokens: ir.usage.completionTokens,
          total_tokens: ir.usage.totalTokens,
          output_tokens_details: ir.usage.details?.reasoningTokens
            ? {
                reasoning_tokens: ir.usage.details.reasoningTokens,
              }
            : undefined,
        }
      : undefined,
  }
}
