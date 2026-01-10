import type { LLMRequestIR, ContentPart, ImageContent } from '@amux/llm-bridge'

import type { GeminiRequest, GeminiContent, GeminiPart } from '../types'

/**
 * Build Gemini request from IR
 */
export function buildRequest(ir: LLMRequestIR): GeminiRequest {
  const request: GeminiRequest = {
    contents: [],
  }

  // Add system instruction if present
  if (ir.system) {
    request.systemInstruction = {
      parts: [{ text: ir.system }],
    }
  }

  // Convert messages to contents
  for (const msg of ir.messages) {
    // Skip system messages (handled above)
    if (msg.role === 'system') continue

    // Handle tool messages specially (tool results)
    if (msg.role === 'tool') {
      // Tool results need to be added as function responses
      const resultContent = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      request.contents.push({
        role: 'user',
        parts: [{
          functionResponse: {
            name: msg.name ?? 'unknown',
            response: { result: resultContent },
          },
        }],
      })
      continue
    }

    const content = buildContent(msg)
    if (content) {
      request.contents.push(content)
    }
  }

  // Add tools if present
  if (ir.tools && ir.tools.length > 0) {
    request.tools = [
      {
        functionDeclarations: ir.tools.map((tool) => ({
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters
            ? {
                type: tool.function.parameters.type ?? 'object',
                properties: tool.function.parameters.properties,
                required: tool.function.parameters.required,
              }
            : undefined,
        })),
      },
    ]
  }

  // Add tool config if tool choice is specified
  if (ir.toolChoice) {
    let mode: 'AUTO' | 'ANY' | 'NONE' = 'AUTO'
    if (ir.toolChoice === 'none') mode = 'NONE'
    else if (ir.toolChoice === 'required') mode = 'ANY'
    else if (ir.toolChoice === 'auto') mode = 'AUTO'
    else if (typeof ir.toolChoice === 'object') {
      mode = 'ANY'
      request.toolConfig = {
        functionCallingConfig: {
          mode,
          allowedFunctionNames: [ir.toolChoice.function.name],
        },
      }
    }

    if (!request.toolConfig) {
      request.toolConfig = {
        functionCallingConfig: { mode },
      }
    }
  }

  // Add generation config
  if (ir.generation) {
    request.generationConfig = {}

    if (ir.generation.temperature !== undefined) {
      request.generationConfig.temperature = ir.generation.temperature
    }
    if (ir.generation.topP !== undefined) {
      request.generationConfig.topP = ir.generation.topP
    }
    if (ir.generation.topK !== undefined) {
      request.generationConfig.topK = ir.generation.topK
    }
    if (ir.generation.maxTokens !== undefined) {
      request.generationConfig.maxOutputTokens = ir.generation.maxTokens
    }
    if (ir.generation.stopSequences && ir.generation.stopSequences.length > 0) {
      request.generationConfig.stopSequences = ir.generation.stopSequences
    }
    if (ir.generation.responseFormat?.type === 'json_object') {
      request.generationConfig.responseMimeType = 'application/json'
    }
  }

  return request
}

function buildContent(msg: { role: string; content: string | ContentPart[]; toolCalls?: unknown[] }): GeminiContent | null {
  const role = msg.role === 'assistant' ? 'model' : 'user'
  const parts: GeminiPart[] = []

  if (typeof msg.content === 'string') {
    if (msg.content) {
      parts.push({ text: msg.content })
    }
  } else if (Array.isArray(msg.content)) {
    for (const part of msg.content) {
      if (part.type === 'text') {
        parts.push({ text: part.text })
      } else if (part.type === 'image') {
        const imgPart = part as ImageContent
        if (imgPart.source.type === 'base64') {
          parts.push({
            inlineData: {
              mimeType: imgPart.source.mediaType,
              data: imgPart.source.data,
            },
          })
        } else {
          parts.push({
            fileData: {
              mimeType: 'image/*',
              fileUri: imgPart.source.url,
            },
          })
        }
      }
    }
  }

  // Add tool calls as function calls (OpenAI-style toolCalls)
  if (msg.toolCalls && Array.isArray(msg.toolCalls)) {
    for (const toolCall of msg.toolCalls as Array<{ function: { name: string; arguments: string } }>) {
      parts.push({
        functionCall: {
          name: toolCall.function.name,
          args: JSON.parse(toolCall.function.arguments),
        },
      })
    }
  }

  if (parts.length === 0) {
    return null
  }

  return { role, parts }
}
