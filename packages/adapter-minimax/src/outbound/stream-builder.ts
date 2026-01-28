import type { LLMStreamEvent, SSEEvent, StreamEventBuilder } from '@amux.ai/llm-bridge'

import type { MinimaxReasoningDetail } from '../types'

/**
 * MiniMax stream event builder
 * Converts IR stream events to MiniMax SSE format
 */
export function createStreamBuilder(): StreamEventBuilder {
  let chunkId = `minimax-${Date.now()}`
  let model = ''
  const created = Math.floor(Date.now() / 1000)

  return {
    process(event: LLMStreamEvent): SSEEvent[] {
      const events: SSEEvent[] = []

      // Update metadata from event
      if (event.id) chunkId = event.id
      if (event.model) model = event.model

      // Handle start event
      if (event.type === 'start') {
        events.push({
          event: 'data',
          data: {
            id: chunkId,
            object: 'chat.completion.chunk',
            created,
            model,
            choices: [{
              index: 0,
              delta: { role: 'assistant' },
              finish_reason: null,
            }],
          },
        })
      }

      // Handle content delta
      if (event.type === 'content' && event.content?.delta) {
        events.push({
          event: 'data',
          data: {
            id: chunkId,
            object: 'chat.completion.chunk',
            created,
            model,
            choices: [{
              index: event.content.index ?? 0,
              delta: { content: event.content.delta },
              finish_reason: null,
            }],
          },
        })
      }

      // Handle reasoning delta (MiniMax-specific)
      if (event.type === 'reasoning' && event.reasoning?.delta) {
        const reasoningDetails: MinimaxReasoningDetail[] = [
          {
            type: 'thinking',
            text: event.reasoning.delta,
          },
        ]

        events.push({
          event: 'data',
          data: {
            id: chunkId,
            object: 'chat.completion.chunk',
            created,
            model,
            choices: [{
              index: event.reasoning.index ?? 0,
              delta: { reasoning_details: reasoningDetails },
              finish_reason: null,
            }],
          },
        })
      }

      // Handle tool call
      if (event.type === 'tool_call' && event.toolCall) {
        const toolCallDelta: {
          index: number
          id?: string
          type?: string
          function?: { name?: string; arguments?: string }
        } = { index: event.toolCall.index ?? 0 }

        if (event.toolCall.id || event.toolCall.name) {
          toolCallDelta.id = event.toolCall.id || `call_${Date.now()}`
          toolCallDelta.type = 'function'
          
          if (event.toolCall.name || event.toolCall.arguments) {
            toolCallDelta.function = {
              name: event.toolCall.name,
              arguments: event.toolCall.arguments,
            }
          }
        }

        events.push({
          event: 'data',
          data: {
            id: chunkId,
            object: 'chat.completion.chunk',
            created,
            model,
            choices: [{
              index: 0,
              delta: { tool_calls: [toolCallDelta] },
              finish_reason: null,
            }],
          },
        })
      }

      // Handle end event
      if (event.type === 'end') {
        const finishReason = mapFinishReason(event.finishReason)

        const finalChunk: {
          id: string
          object: string
          created: number
          model: string
          choices: Array<{
            index: number
            delta: Record<string, never>
            finish_reason: string
          }>
          usage?: {
            prompt_tokens: number
            completion_tokens: number
            total_tokens: number
            completion_tokens_details?: {
              reasoning_tokens?: number
            }
          }
        } = {
          id: chunkId,
          object: 'chat.completion.chunk',
          created,
          model,
          choices: [{
            index: 0,
            delta: {},
            finish_reason: finishReason,
          }],
        }

        // Include usage if available
        if (event.usage) {
          finalChunk.usage = {
            prompt_tokens: event.usage.promptTokens ?? 0,
            completion_tokens: event.usage.completionTokens ?? 0,
            total_tokens: event.usage.totalTokens ?? 0,
            completion_tokens_details: event.usage.details?.reasoningTokens
              ? {
                  reasoning_tokens: event.usage.details.reasoningTokens,
                }
              : undefined,
          }
        }

        events.push({ event: 'data', data: finalChunk })
      }

      // Handle error event
      if (event.type === 'error' && event.error) {
        events.push({
          event: 'data',
          data: {
            error: {
              message: event.error.message,
              type: event.error.type,
              code: event.error.code,
            },
          },
        })
      }

      return events
    },

    finalize(): SSEEvent[] {
      // MiniMax streams end with [DONE]
      return [{ event: 'data', data: '[DONE]' }]
    },
  }
}

/**
 * Map IR finish reason to MiniMax finish reason
 */
function mapFinishReason(reason?: string): string {
  if (!reason) return 'stop'

  const reasonMap: Record<string, string> = {
    stop: 'stop',
    length: 'length',
    tool_calls: 'tool_calls',
    content_filter: 'content_filter',
    error: 'stop',
    end_turn: 'stop',
    max_tokens: 'length',
  }

  return reasonMap[reason] ?? 'stop'
}
