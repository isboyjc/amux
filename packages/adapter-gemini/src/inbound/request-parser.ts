import type {
  LLMRequestIR,
  Message,
  Tool,
  ToolChoice,
  ContentPart,
  TextContent,
  ImageContent,
  ToolUseContent,
  ToolResultContent,
} from '@llm-bridge/core'

import type { GeminiRequest, GeminiContent, GeminiPart, GeminiTool } from '../types'

/**
 * Parse Gemini request to IR
 */
export function parseRequest(request: unknown): LLMRequestIR {
  const req = request as GeminiRequest

  // Extract system instruction
  let system: string | undefined
  if (req.systemInstruction?.parts) {
    system = req.systemInstruction.parts.map((p) => p.text).join('\n')
  }

  // Parse contents to messages
  const messages: Message[] = req.contents.map((content) => parseContent(content))

  // Parse tools
  const tools: Tool[] | undefined = req.tools?.[0]?.functionDeclarations?.map((fn) => ({
    type: 'function' as const,
    function: {
      name: fn.name,
      description: fn.description,
      parameters: fn.parameters
        ? {
            type: fn.parameters.type,
            properties: fn.parameters.properties,
            required: fn.parameters.required,
          }
        : undefined,
    },
  }))

  // Parse tool config to tool choice
  let toolChoice: ToolChoice | undefined
  if (req.toolConfig?.functionCallingConfig) {
    const mode = req.toolConfig.functionCallingConfig.mode
    if (mode === 'AUTO') toolChoice = 'auto'
    else if (mode === 'NONE') toolChoice = 'none'
    else if (mode === 'ANY') toolChoice = 'required'
  }

  return {
    messages,
    tools,
    toolChoice,
    system,
    generation: req.generationConfig
      ? {
          temperature: req.generationConfig.temperature,
          topP: req.generationConfig.topP,
          topK: req.generationConfig.topK,
          maxTokens: req.generationConfig.maxOutputTokens,
          stopSequences: req.generationConfig.stopSequences,
          responseFormat: req.generationConfig.responseMimeType === 'application/json'
            ? { type: 'json_object' as const }
            : undefined,
        }
      : undefined,
    raw: request,
  }
}

function parseContent(content: GeminiContent): Message {
  const role = content.role === 'model' ? 'assistant' : 'user'
  const parts: ContentPart[] = []
  let toolCalls: Message['toolCalls'] | undefined

  for (const part of content.parts) {
    if ('text' in part) {
      parts.push({
        type: 'text',
        text: part.text,
      } as TextContent)
    } else if ('inlineData' in part) {
      parts.push({
        type: 'image',
        source: {
          type: 'base64',
          mediaType: part.inlineData.mimeType,
          data: part.inlineData.data,
        },
      } as ImageContent)
    } else if ('fileData' in part) {
      parts.push({
        type: 'image',
        source: {
          type: 'url',
          url: part.fileData.fileUri,
        },
      } as ImageContent)
    } else if ('functionCall' in part) {
      // Gemini function call -> tool_use content
      parts.push({
        type: 'tool_use',
        id: `call_${Date.now()}`,
        name: part.functionCall.name,
        input: part.functionCall.args,
      } as ToolUseContent)
    } else if ('functionResponse' in part) {
      // Gemini function response -> tool_result content
      parts.push({
        type: 'tool_result',
        toolUseId: `call_${Date.now()}`,
        content: JSON.stringify(part.functionResponse.response),
      } as ToolResultContent)
    }
  }

  // If all parts are text, simplify to string
  const allText = parts.every((p) => p.type === 'text')
  const messageContent = allText && parts.length === 1
    ? (parts[0] as TextContent).text
    : parts

  return {
    role,
    content: messageContent,
    toolCalls,
  }
}
