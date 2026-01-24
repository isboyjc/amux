import type { LLMStreamEvent, SSEEvent, StreamEventBuilder } from '@amux.ai/llm-bridge'

/**
 * Google Gemini stream event builder
 * Converts IR stream events to Gemini SSE format
 *
 * Gemini uses a different streaming format than OpenAI:
 * - Each chunk is a complete JSON object (not SSE format)
 * - Contains candidates array with content parts
 */
export function createStreamBuilder(): StreamEventBuilder {
  let responseId = `gemini-${Date.now()}`
  let model = ''

  return {
    process(event: LLMStreamEvent): SSEEvent[] {
      const events: SSEEvent[] = []

      // Update metadata from event
      if (event.id) responseId = event.id
      if (event.model) model = event.model

      // Handle start event
      if (event.type === 'start') {
        // Gemini doesn't have a separate start event
        // First content chunk serves as start
        return events
      }

      // Handle content delta
      if (event.type === 'content' && event.content?.delta) {
        events.push({
          event: 'data',
          data: {
            candidates: [{
              content: {
                role: 'model',
                parts: [{ text: event.content.delta }],
              },
              index: 0,
            }],
            modelVersion: model,
            responseId,
          },
        })
      }

      // Handle tool call (function call in Gemini)
      if (event.type === 'tool_call' && event.toolCall) {
        if (event.toolCall.name) {
          // Parse arguments if they're a string
          let args: Record<string, unknown> = {}
          if (event.toolCall.arguments) {
            try {
              args = JSON.parse(event.toolCall.arguments) as Record<string, unknown>
            } catch {
              args = {}
            }
          }

          events.push({
            event: 'data',
            data: {
              candidates: [{
                content: {
                  role: 'model',
                  parts: [{
                    functionCall: {
                      name: event.toolCall.name,
                      args,
                    },
                  }],
                },
                index: 0,
              }],
              modelVersion: model,
              responseId,
            },
          })
        }
      }

      // Handle end event
      if (event.type === 'end') {
        const finishReason = mapFinishReason(event.finishReason)

        const finalChunk: {
          candidates: Array<{
            content: { role: string; parts: Array<{ text: string }> }
            finishReason: string
            index: number
          }>
          usageMetadata?: {
            promptTokenCount: number
            candidatesTokenCount: number
            totalTokenCount: number
          }
          modelVersion: string
          responseId: string
        } = {
          candidates: [{
            content: {
              role: 'model',
              parts: [{ text: '' }],
            },
            finishReason,
            index: 0,
          }],
          modelVersion: model,
          responseId,
        }

        // Include usage if available
        if (event.usage) {
          finalChunk.usageMetadata = {
            promptTokenCount: event.usage.promptTokens ?? 0,
            candidatesTokenCount: event.usage.completionTokens ?? 0,
            totalTokenCount: event.usage.totalTokens ?? 0,
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
              code: 500,
              message: event.error.message,
              status: 'INTERNAL',
            },
          },
        })
      }

      return events
    },
  }
}

/**
 * Map IR finish reason to Gemini finish reason
 */
function mapFinishReason(reason?: string): string {
  if (!reason) return 'STOP'

  const reasonMap: Record<string, string> = {
    stop: 'STOP',
    length: 'MAX_TOKENS',
    tool_calls: 'STOP',
    content_filter: 'SAFETY',
    end_turn: 'STOP',
    max_tokens: 'MAX_TOKENS',
  }

  return reasonMap[reason] ?? 'STOP'
}
