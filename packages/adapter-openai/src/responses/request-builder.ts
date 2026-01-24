import type { LLMRequestIR, ContentPart, ImageContent } from '@amux.ai/llm-bridge'

import type {
  ResponsesRequest,
  ResponsesInputItem,
  ResponsesContentPart,
  ResponsesTool,
  ResponsesTextFormat,
} from '../types'

/**
 * Build Responses API request from IR
 */
export function buildResponsesRequest(ir: LLMRequestIR): ResponsesRequest {
  const input: ResponsesInputItem[] = []

  // Add conversation messages
  for (const msg of ir.messages) {
    if (msg.role === 'system') {
      // System messages go to instructions, skip here
      continue
    }

    input.push({
      type: 'message',
      role: msg.role as 'user' | 'assistant',
      content: buildContent(msg.content),
    })
  }

  const request: ResponsesRequest = {
    model: ir.model ?? 'gpt-5',
    input: input.length === 1 && input[0]?.type === 'message' && typeof input[0].content === 'string' && input[0].role === 'user'
      ? input[0].content // Simple string input for single user message
      : input,
    stream: ir.stream,
  }

  // Add instructions from system prompt
  if (ir.system) {
    request.instructions = ir.system
  }

  // Build tools
  const tools: ResponsesTool[] = []

  // Add function tools
  if (ir.tools && ir.tools.length > 0) {
    for (const tool of ir.tools) {
      tools.push({
        type: 'function',
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
        strict: tool.function.strict,
      })
    }
  }

  // Add built-in tools from extensions
  const responsesExt = ir.extensions?.responses as {
    builtInTools?: ResponsesTool[]
    truncation?: 'auto' | 'disabled'
    store?: boolean
    reasoning?: { effort?: 'low' | 'medium' | 'high'; summary?: 'auto' | 'concise' | 'detailed' }
    previousResponseId?: string
    parallelToolCalls?: boolean
    text?: ResponsesTextFormat
  } | undefined

  const builtInTools = responsesExt?.builtInTools
  if (builtInTools) {
    tools.push(...builtInTools)
  }

  if (tools.length > 0) {
    request.tools = tools
  }

  // Add tool choice
  if (ir.toolChoice) {
    if (typeof ir.toolChoice === 'string') {
      request.tool_choice = ir.toolChoice
    } else if (ir.toolChoice.type === 'function' && ir.toolChoice.function) {
      request.tool_choice = {
        type: 'function',
        name: ir.toolChoice.function.name,
      }
    }
  }

  // Add generation parameters
  if (ir.generation) {
    if (ir.generation.temperature !== undefined) {
      request.temperature = ir.generation.temperature
    }
    if (ir.generation.topP !== undefined) {
      request.top_p = ir.generation.topP
    }
    if (ir.generation.maxTokens !== undefined) {
      request.max_output_tokens = ir.generation.maxTokens
    }
  }

  // Add user ID
  if (ir.metadata?.userId) {
    request.user = ir.metadata.userId as string
  }

  // Add Responses API specific options from extensions
  if (responsesExt) {
    if (responsesExt.truncation !== undefined) {
      request.truncation = responsesExt.truncation
    }
    if (responsesExt.store !== undefined) {
      request.store = responsesExt.store
    }
    if (responsesExt.reasoning !== undefined) {
      request.reasoning = responsesExt.reasoning
    }
    if (responsesExt.previousResponseId !== undefined) {
      request.previous_response_id = responsesExt.previousResponseId
    }
    if (responsesExt.parallelToolCalls !== undefined) {
      request.parallel_tool_calls = responsesExt.parallelToolCalls
    }
    if (responsesExt.text !== undefined) {
      request.text = responsesExt.text
    }
  }

  // Handle JSON mode from IR generation.responseFormat
  if (ir.generation?.responseFormat) {
    if (ir.generation.responseFormat.type === 'json_object') {
      request.text = {
        format: { type: 'json_object' }
      }
    } else if (ir.generation.responseFormat.type === 'json_schema' && ir.generation.responseFormat.jsonSchema) {
      request.text = {
        format: {
          type: 'json_schema',
          json_schema: {
            name: ir.generation.responseFormat.jsonSchema.name,
            description: ir.generation.responseFormat.jsonSchema.description,
            schema: ir.generation.responseFormat.jsonSchema.schema as Record<string, unknown>,
            strict: ir.generation.responseFormat.jsonSchema.strict,
          }
        }
      }
    }
  }

  return request
}

function buildContent(content: string | ContentPart[]): string | ResponsesContentPart[] {
  if (typeof content === 'string') {
    return content
  }

  if (!content || content.length === 0) {
    return ''
  }

  // Check if all parts are text - if so, concatenate them
  const allText = content.every((part) => part.type === 'text')
  if (allText) {
    return content
      .map((part) => (part.type === 'text' ? part.text : ''))
      .join('')
  }

  // Build multimodal content
  return content.map((part): ResponsesContentPart => {
    if (part.type === 'text') {
      return { type: 'input_text', text: part.text }
    }

    if (part.type === 'image') {
      const imgPart = part as ImageContent
      if (imgPart.source.type === 'url') {
        return {
          type: 'input_image',
          image_url: imgPart.source.url,
        }
      }
      // Base64 image
      return {
        type: 'input_image',
        image_url: `data:${imgPart.source.mediaType};base64,${imgPart.source.data}`,
      }
    }

    // Fallback for other types
    return { type: 'input_text', text: JSON.stringify(part) }
  })
}
