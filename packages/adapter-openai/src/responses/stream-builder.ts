import type { LLMStreamEvent, SSEEvent, StreamEventBuilder } from '@amux/llm-bridge'

/**
 * Create a stream builder for Responses API format
 * Converts IR stream events to OpenAI Responses API SSE format
 *
 * OpenAI Responses API streaming events require:
 * - item_id: identifier for the output item
 * - sequence_number: monotonically increasing number for event ordering
 *
 * For reasoning models (o1, o3, etc.), the output structure is:
 * - output[0]: reasoning item (type: "reasoning") with summary array
 * - output[1]: message item (type: "message") with content array
 *
 * Reasoning uses these events:
 * - response.reasoning_summary_part.added
 * - response.reasoning_summary_text.delta (with summary_index)
 * - response.reasoning_summary_text.done
 * - response.reasoning_summary_part.done
 */
export function createResponsesStreamBuilder(): StreamEventBuilder {
  let responseId = ''
  let model = ''
  let currentOutputIndex = -1
  let reasoningItemAdded = false // Track if we've added the reasoning output item
  let reasoningPartAdded = false // Track if we've added the reasoning summary part
  let messageItemAdded = false // Track if we've added the message output item
  let contentPartAdded = false // Track if we've added the text content part
  let accumulatedText = '' // Accumulate text content for final output
  let accumulatedReasoning = '' // Accumulate reasoning content
  let sequenceNumber = 0 // Sequence number for event ordering
  let reasoningItemId = '' // Reasoning item ID
  let messageItemId = '' // Message item ID

  /**
   * Get next sequence number
   */
  function nextSeq(): number {
    return sequenceNumber++
  }

  /**
   * Helper function to add reasoning output item if not already added
   */
  function ensureReasoningItemAdded(events: SSEEvent[]): void {
    if (!reasoningItemAdded) {
      reasoningItemAdded = true
      currentOutputIndex++
      reasoningItemId = `rs_${responseId || Date.now()}`
      events.push({
        event: 'response.output_item.added',
        data: {
          type: 'response.output_item.added',
          output_index: currentOutputIndex,
          item_id: reasoningItemId,
          sequence_number: nextSeq(),
          item: {
            type: 'reasoning',
            id: reasoningItemId,
            summary: [],
            status: 'in_progress',
          },
        },
      })
    }
  }

  /**
   * Helper function to add reasoning summary part if not already added
   */
  function ensureReasoningPartAdded(events: SSEEvent[]): void {
    if (!reasoningPartAdded) {
      reasoningPartAdded = true
      events.push({
        event: 'response.reasoning_summary_part.added',
        data: {
          type: 'response.reasoning_summary_part.added',
          item_id: reasoningItemId,
          output_index: currentOutputIndex,
          summary_index: 0,
          sequence_number: nextSeq(),
          part: {
            type: 'summary_text',
            text: '',
          },
        },
      })
    }
  }

  /**
   * Helper function to add message output item if not already added
   */
  function ensureMessageItemAdded(events: SSEEvent[]): void {
    if (!messageItemAdded) {
      messageItemAdded = true
      currentOutputIndex++
      messageItemId = `msg_${responseId || Date.now()}`
      events.push({
        event: 'response.output_item.added',
        data: {
          type: 'response.output_item.added',
          output_index: currentOutputIndex,
          item_id: messageItemId,
          sequence_number: nextSeq(),
          item: {
            type: 'message',
            id: messageItemId,
            role: 'assistant',
            content: [],
            status: 'in_progress',
          },
        },
      })
    }
  }

  /**
   * Helper function to add text content part if not already added
   */
  function ensureContentPartAdded(events: SSEEvent[]): void {
    if (!contentPartAdded) {
      contentPartAdded = true
      events.push({
        event: 'response.content_part.added',
        data: {
          type: 'response.content_part.added',
          output_index: currentOutputIndex,
          item_id: messageItemId,
          content_index: 0,
          sequence_number: nextSeq(),
          part: {
            type: 'output_text',
            text: '',
          },
        },
      })
    }
  }

  return {
    process(event: LLMStreamEvent): SSEEvent[] {
      const events: SSEEvent[] = []

      // Update metadata from event
      if (event.id) responseId = event.id || `resp_${Date.now()}`
      if (event.model) model = event.model || ''

      // Handle start event
      if (event.type === 'start') {
        events.push({
          event: 'response.created',
          data: {
            type: 'response.created',
            sequence_number: nextSeq(),
            response: {
              id: responseId,
              object: 'response',
              created_at: Math.floor(Date.now() / 1000),
              model,
              status: 'in_progress',
              output: [],
            },
          },
        })
      }

      // Handle reasoning delta (for reasoning models like DeepSeek-reasoner, o1, o3, etc.)
      // Reasoning is a separate output item with type "reasoning"
      if (event.type === 'reasoning' && event.reasoning?.delta) {
        ensureReasoningItemAdded(events)
        ensureReasoningPartAdded(events)
        accumulatedReasoning += event.reasoning.delta

        // Use response.reasoning_summary_text.delta with summary_index
        events.push({
          event: 'response.reasoning_summary_text.delta',
          data: {
            type: 'response.reasoning_summary_text.delta',
            item_id: reasoningItemId,
            output_index: 0, // Reasoning is always at output_index 0
            summary_index: 0,
            sequence_number: nextSeq(),
            delta: event.reasoning.delta,
          },
        })
      }

      // Handle content delta
      if (event.type === 'content' && event.content?.delta) {
        // Add message output item if not already added
        ensureMessageItemAdded(events)
        // Add content part if not already added
        ensureContentPartAdded(events)
        accumulatedText += event.content.delta
        events.push({
          event: 'response.output_text.delta',
          data: {
            type: 'response.output_text.delta',
            output_index: currentOutputIndex,
            item_id: messageItemId,
            content_index: 0,
            sequence_number: nextSeq(),
            delta: event.content.delta,
          },
        })
      }

      // Handle tool call
      if (event.type === 'tool_call' && event.toolCall) {
        // If this is a new tool call (has name), emit item added event
        if (event.toolCall.name) {
          currentOutputIndex++
          const toolItemId = `fc_${event.toolCall.id || currentOutputIndex}`
          events.push({
            event: 'response.output_item.added',
            data: {
              type: 'response.output_item.added',
              output_index: currentOutputIndex,
              item_id: toolItemId,
              sequence_number: nextSeq(),
              item: {
                type: 'function_call',
                id: toolItemId,
                call_id: event.toolCall.id || `call_${currentOutputIndex}`,
                name: event.toolCall.name,
                arguments: '',
                status: 'in_progress',
              },
            },
          })
        }

        // Arguments delta
        if (event.toolCall.arguments) {
          events.push({
            event: 'response.function_call_arguments.delta',
            data: {
              type: 'response.function_call_arguments.delta',
              output_index: currentOutputIndex,
              item_id: messageItemId,
              sequence_number: nextSeq(),
              delta: event.toolCall.arguments,
            },
          })
        }
      }

      // Handle end event
      if (event.type === 'end') {
        // Build the output array
        const output: Array<Record<string, unknown>> = []

        // Add reasoning output item if present
        if (reasoningItemAdded) {
          output.push({
            type: 'reasoning',
            id: reasoningItemId,
            summary: accumulatedReasoning
              ? [{ type: 'summary_text', text: accumulatedReasoning }]
              : [],
            status: 'completed',
          })

          // Emit done events for reasoning
          events.push({
            event: 'response.reasoning_summary_text.done',
            data: {
              type: 'response.reasoning_summary_text.done',
              item_id: reasoningItemId,
              output_index: 0,
              summary_index: 0,
              sequence_number: nextSeq(),
              text: accumulatedReasoning,
            },
          })

          events.push({
            event: 'response.reasoning_summary_part.done',
            data: {
              type: 'response.reasoning_summary_part.done',
              item_id: reasoningItemId,
              output_index: 0,
              summary_index: 0,
              sequence_number: nextSeq(),
              part: {
                type: 'summary_text',
                text: accumulatedReasoning,
              },
            },
          })

          events.push({
            event: 'response.output_item.done',
            data: {
              type: 'response.output_item.done',
              output_index: 0,
              item_id: reasoningItemId,
              sequence_number: nextSeq(),
              item: {
                type: 'reasoning',
                id: reasoningItemId,
                summary: [{ type: 'summary_text', text: accumulatedReasoning }],
                status: 'completed',
              },
            },
          })
        }

        // Add message output item if present
        if (messageItemAdded) {
          const messageOutputIndex = reasoningItemAdded ? 1 : 0
          output.push({
            type: 'message',
            id: messageItemId,
            role: 'assistant',
            content: accumulatedText
              ? [{ type: 'output_text', text: accumulatedText }]
              : [],
            status: 'completed',
          })

          // Emit done events for message content
          if (contentPartAdded) {
            events.push({
              event: 'response.output_text.done',
              data: {
                type: 'response.output_text.done',
                output_index: messageOutputIndex,
                item_id: messageItemId,
                content_index: 0,
                sequence_number: nextSeq(),
                text: accumulatedText,
              },
            })

            events.push({
              event: 'response.content_part.done',
              data: {
                type: 'response.content_part.done',
                output_index: messageOutputIndex,
                item_id: messageItemId,
                content_index: 0,
                sequence_number: nextSeq(),
                part: {
                  type: 'output_text',
                  text: accumulatedText,
                },
              },
            })
          }

          events.push({
            event: 'response.output_item.done',
            data: {
              type: 'response.output_item.done',
              output_index: messageOutputIndex,
              item_id: messageItemId,
              sequence_number: nextSeq(),
              item: {
                type: 'message',
                id: messageItemId,
                role: 'assistant',
                content: accumulatedText
                  ? [{ type: 'output_text', text: accumulatedText }]
                  : [],
                status: 'completed',
              },
            },
          })
        }

        // response.completed - marks the entire response as complete
        events.push({
          event: 'response.completed',
          data: {
            type: 'response.completed',
            sequence_number: nextSeq(),
            response: {
              id: responseId,
              object: 'response',
              created_at: Math.floor(Date.now() / 1000),
              model,
              status: 'completed',
              output,
              output_text: accumulatedText || undefined,
              usage: event.usage
                ? {
                    input_tokens: event.usage.promptTokens,
                    output_tokens: event.usage.completionTokens,
                    total_tokens: event.usage.totalTokens,
                    output_tokens_details: event.usage.details?.reasoningTokens
                      ? {
                          reasoning_tokens: event.usage.details.reasoningTokens,
                        }
                      : undefined,
                  }
                : undefined,
            },
          },
        })
      }

      // Handle error event
      if (event.type === 'error' && event.error) {
        events.push({
          event: 'error',
          data: {
            type: 'error',
            sequence_number: nextSeq(),
            error: {
              type: 'api_error',
              code: event.error.code || 'unknown',
              message: event.error.message,
            },
          },
        })
      }

      return events
    },

    finalize(): SSEEvent[] {
      // Responses API doesn't use [DONE] marker
      return []
    },
  }
}
