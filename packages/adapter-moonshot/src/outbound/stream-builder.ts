import type { LLMStreamEvent, SSEEvent, StreamEventBuilder } from '@amux.ai/llm-bridge'

/**
 * OpenAI stream event builder
 * Converts IR stream events to OpenAI SSE format
 *
 * OpenAI uses a simpler SSE format compared to Anthropic:
 * - All events use "data:" prefix (no event type)
 * - Each chunk contains the full delta structure
 * - Stream ends with "data: [DONE]"
 */
export function createStreamBuilder(): StreamEventBuilder {
  let chunkId = `chatcmpl-${Date.now()}`
  let model = ''
  let created = Math.floor(Date.now() / 1000)
  const toolCallsState: Map<number, { id: string; name: string }> = new Map()

  return {
    process(event: LLMStreamEvent): SSEEvent[] {
      const events: SSEEvent[] = []

      // Update metadata from event
      if (event.id) chunkId = event.id
      if (event.model) model = event.model

      // Handle start event
      if (event.type === 'start') {
        // OpenAI doesn't have a separate start event
        // The first content chunk serves as the start
        events.push({
          event: 'data',
          data: {
            id: chunkId,
            object: 'chat.completion.chunk',
            created,
            model,
            choices: [{
              index: 0,
              delta: { role: 'assistant', content: '' },
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
              index: 0,
              delta: { content: event.content.delta },
              finish_reason: null,
            }],
          },
        })
      }

      // Handle reasoning delta (for Moonshot kimi-k2-thinking model)
      if (event.type === 'reasoning' && event.reasoning?.delta) {
        // Moonshot uses reasoning_content field for thinking process
        events.push({
          event: 'data',
          data: {
            id: chunkId,
            object: 'chat.completion.chunk',
            created,
            model,
            choices: [{
              index: 0,
              delta: { reasoning_content: event.reasoning.delta },
              finish_reason: null,
            }],
          },
        })
      }

      // Handle tool call
      if (event.type === 'tool_call' && event.toolCall) {
        const toolIndex = event.toolCall.index ?? 0
        const toolCallDelta: {
          index: number
          id?: string
          type?: string
          function?: { name?: string; arguments?: string }
        } = { index: toolIndex }

        // If this is a new tool call (has name)
        if (event.toolCall.name) {
          toolCallDelta.id = event.toolCall.id || `call_${Date.now()}_${toolIndex}`
          toolCallDelta.type = 'function'
          toolCallDelta.function = { name: event.toolCall.name }
          toolCallsState.set(toolIndex, {
            id: toolCallDelta.id,
            name: event.toolCall.name,
          })
        }

        // If this has arguments
        if (event.toolCall.arguments) {
          toolCallDelta.function = {
            ...toolCallDelta.function,
            arguments: event.toolCall.arguments,
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

        // Emit final chunk with finish_reason
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
              type: 'server_error',
              code: event.error.code,
            },
          },
        })
      }

      return events
    },

    finalize(): SSEEvent[] {
      // OpenAI streams end with [DONE]
      return [{ event: 'data', data: '[DONE]' }]
    },
  }
}

/**
 * Map IR finish reason to OpenAI finish reason
 */
function mapFinishReason(reason?: string): string {
  if (!reason) return 'stop'

  const reasonMap: Record<string, string> = {
    stop: 'stop',
    length: 'length',
    tool_calls: 'tool_calls',
    content_filter: 'content_filter',
    end_turn: 'stop',
    max_tokens: 'length',
  }

  return reasonMap[reason] ?? 'stop'
}
