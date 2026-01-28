import type { LLMRequestIR, Message, ContentPart, Tool } from '@amux.ai/llm-bridge'

import type { MinimaxRequest } from '../types'

/**
 * Parse MiniMax request to IR
 */
export function parseRequest(request: unknown): LLMRequestIR {
  const req = request as MinimaxRequest

  // Extract system message if present
  let system: string | undefined
  const messages: Message[] = []

  for (const msg of req.messages) {
    if (msg.role === 'system' && typeof msg.content === 'string') {
      // Accumulate system messages
      system = system ? `${system}\n${msg.content}` : msg.content
      continue
    }

    const message: Message = {
      role: msg.role,
      content: parseContent(msg.content),
      name: msg.name,
      toolCalls: msg.tool_calls,
      toolCallId: msg.tool_call_id,
    }

    // MiniMax-specific: Parse reasoning details to reasoningContent
    if (msg.reasoning_details && msg.reasoning_details.length > 0) {
      message.reasoningContent = msg.reasoning_details
        .map((detail) => detail.text)
        .join('\n')
    }

    messages.push(message)
  }

  const ir: LLMRequestIR = {
    model: req.model,
    messages,
    stream: req.stream,
  }

  if (system) {
    ir.system = system
  }

  if (req.tools && req.tools.length > 0) {
    ir.tools = req.tools.map((tool): Tool => ({
      type: 'function',
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
        strict: tool.function.strict,
      },
    }))
  }

  if (req.tool_choice) {
    ir.toolChoice = req.tool_choice
  }

  // Generation parameters
  ir.generation = {}

  if (req.temperature !== undefined) {
    ir.generation.temperature = req.temperature
  }

  if (req.top_p !== undefined) {
    ir.generation.topP = req.top_p
  }

  if (req.max_tokens !== undefined) {
    ir.generation.maxTokens = req.max_tokens
  }

  if (req.stop) {
    ir.generation.stopSequences = Array.isArray(req.stop) ? req.stop : [req.stop]
  }

  if (req.response_format) {
    ir.generation.responseFormat = {
      type: req.response_format.type,
    }
  }

  // MiniMax-specific: Store reasoning_split in extensions
  if (req.reasoning_split !== undefined) {
    ir.extensions = {
      minimax: {
        reasoning_split: req.reasoning_split,
      },
    }
  }

  ir.raw = request

  return ir
}

/**
 * Parse message content
 */
function parseContent(
  content: string | MinimaxContentPart[] | null | undefined
): string | ContentPart[] {
  if (!content) return ''
  if (typeof content === 'string') return content

  return content.map((part): ContentPart => {
    if (part.type === 'text') {
      return { type: 'text', text: part.text }
    }

    if (part.type === 'image_url') {
      const url = part.image_url.url
      // Check if it's a base64 data URL
      if (url.startsWith('data:')) {
        const match = url.match(/^data:(.*?);base64,(.*)$/)
        if (match) {
          return {
            type: 'image',
            source: {
              type: 'base64',
              mediaType: match[1] ?? 'image/png',
              data: match[2] ?? '',
            },
          }
        }
      }
      // Regular URL
      return {
        type: 'image',
        source: {
          type: 'url',
          url,
        },
      }
    }

    // Fallback
    return { type: 'text', text: JSON.stringify(part) }
  })
}

/**
 * Type guard imports
 */
import type { MinimaxContentPart } from '../types'
