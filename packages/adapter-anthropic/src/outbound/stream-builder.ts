import type { LLMStreamEvent, SSEEvent, StreamEventBuilder } from '@amux/llm-bridge'

/**
 * Anthropic stream event builder
 * Converts IR stream events to Anthropic SSE format
 */
export function createStreamBuilder(): StreamEventBuilder {
  let hasStarted = false
  let messageId = `msg_${Date.now()}`
  let model = ''
  let contentIndex = 0
  let currentBlockType: 'text' | 'tool_use' | 'thinking' | null = null
  let outputTokens = 0

  return {
    process(event: LLMStreamEvent): SSEEvent[] {
      const events: SSEEvent[] = []

      // Helper to emit message_start if not started
      const ensureStarted = () => {
        if (!hasStarted) {
          hasStarted = true
          if (event.id) messageId = event.id
          if (event.model) model = event.model

          events.push({
            event: 'message_start',
            data: {
              type: 'message_start',
              message: {
                id: messageId,
                type: 'message',
                role: 'assistant',
                content: [],
                model,
                stop_reason: null,
                stop_sequence: null,
                usage: { input_tokens: 0, output_tokens: 0 },
              },
            },
          })
        }
      }

      // Handle start event
      if (event.type === 'start') {
        ensureStarted()
      }

      // Handle reasoning delta (DeepSeek reasoning / Anthropic extended thinking)
      if (event.type === 'reasoning' && event.reasoning?.delta) {
        ensureStarted()

        // If we need to start a thinking block
        if (currentBlockType !== 'thinking') {
          // Close previous block if exists
          if (currentBlockType !== null) {
            events.push({
              event: 'content_block_stop',
              data: { type: 'content_block_stop', index: contentIndex },
            })
            contentIndex++
          }

          // Start thinking block
          events.push({
            event: 'content_block_start',
            data: {
              type: 'content_block_start',
              index: contentIndex,
              content_block: { type: 'thinking', thinking: '' },
            },
          })
          currentBlockType = 'thinking'
        }

        events.push({
          event: 'content_block_delta',
          data: {
            type: 'content_block_delta',
            index: contentIndex,
            delta: { type: 'thinking_delta', thinking: event.reasoning.delta },
          },
        })
      }

      // Handle content delta
      if (event.type === 'content' && event.content?.delta) {
        ensureStarted()

        // If we need to start a text block (or switch from thinking/tool_use)
        if (currentBlockType !== 'text') {
          // Close previous block if exists
          if (currentBlockType !== null) {
            events.push({
              event: 'content_block_stop',
              data: { type: 'content_block_stop', index: contentIndex },
            })
            contentIndex++
          }

          // Start text block
          events.push({
            event: 'content_block_start',
            data: {
              type: 'content_block_start',
              index: contentIndex,
              content_block: { type: 'text', text: '' },
            },
          })
          currentBlockType = 'text'
        }

        events.push({
          event: 'content_block_delta',
          data: {
            type: 'content_block_delta',
            index: contentIndex,
            delta: { type: 'text_delta', text: event.content.delta },
          },
        })
      }

      // Handle tool call
      if (event.type === 'tool_call' && event.toolCall) {
        ensureStarted()

        // If starting a new tool call (has name)
        if (event.toolCall.name) {
          // Close previous block if exists
          if (currentBlockType !== null) {
            events.push({
              event: 'content_block_stop',
              data: { type: 'content_block_stop', index: contentIndex },
            })
            contentIndex++
          }

          // Start tool_use block
          events.push({
            event: 'content_block_start',
            data: {
              type: 'content_block_start',
              index: contentIndex,
              content_block: {
                type: 'tool_use',
                id: event.toolCall.id || `toolu_${Date.now()}`,
                name: event.toolCall.name,
                input: {},
              },
            },
          })
          currentBlockType = 'tool_use'
        }

        // Tool call arguments delta
        if (event.toolCall.arguments) {
          events.push({
            event: 'content_block_delta',
            data: {
              type: 'content_block_delta',
              index: contentIndex,
              delta: { type: 'input_json_delta', partial_json: event.toolCall.arguments },
            },
          })
        }
      }

      // Handle end event
      if (event.type === 'end') {
        // Update usage
        if (event.usage) {
          if (event.usage.completionTokens) outputTokens = event.usage.completionTokens
        }

        // Close current content block
        if (currentBlockType !== null) {
          events.push({
            event: 'content_block_stop',
            data: { type: 'content_block_stop', index: contentIndex },
          })
        }

        // Map finish reason to Anthropic stop reason
        const stopReason = mapFinishReason(event.finishReason)

        // Emit message_delta with stop reason
        events.push({
          event: 'message_delta',
          data: {
            type: 'message_delta',
            delta: { stop_reason: stopReason, stop_sequence: null },
            usage: { output_tokens: outputTokens },
          },
        })

        // Emit message_stop
        events.push({
          event: 'message_stop',
          data: { type: 'message_stop' },
        })
      }

      // Handle error event
      if (event.type === 'error' && event.error) {
        events.push({
          event: 'error',
          data: {
            type: 'error',
            error: {
              type: 'api_error',
              message: event.error.message,
            },
          },
        })
      }

      return events
    },
  }
}

/**
 * Map IR finish reason to Anthropic stop reason
 */
function mapFinishReason(reason?: string): string {
  if (!reason) return 'end_turn'

  const reasonMap: Record<string, string> = {
    stop: 'end_turn',
    length: 'max_tokens',
    tool_calls: 'tool_use',
    content_filter: 'end_turn',
  }

  return reasonMap[reason] ?? 'end_turn'
}
