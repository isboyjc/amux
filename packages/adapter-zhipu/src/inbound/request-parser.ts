import type {
  LLMRequestIR,
  Message,
  Tool,
  ToolChoice,
} from '@amux.ai/llm-bridge'

import type { ZhipuRequest, ZhipuMessage, ZhipuTool } from '../types'

/**
 * Parse Zhipu request to IR
 */
export function parseRequest(request: unknown): LLMRequestIR {
  const req = request as ZhipuRequest

  // Extract system message if present
  let system: string | undefined
  const messages: Message[] = []

  for (const msg of req.messages) {
    if (msg.role === 'system') {
      if (typeof msg.content === 'string') {
        system = system ? `${system}\n${msg.content}` : msg.content
      }
    } else {
      messages.push(parseMessage(msg))
    }
  }

  // Parse tools
  const tools: Tool[] | undefined = req.tools?.map((tool) => parseTool(tool))

  // Parse tool choice
  const toolChoice: ToolChoice | undefined = req.tool_choice
    ? parseToolChoice(req.tool_choice)
    : undefined

  return {
    messages,
    model: req.model,
    tools,
    toolChoice,
    stream: req.stream,
    system,
    generation: {
      temperature: req.temperature,
      topP: req.top_p,
      maxTokens: req.max_tokens,
      stopSequences: req.stop
        ? Array.isArray(req.stop)
          ? req.stop
          : [req.stop]
        : undefined,
      presencePenalty: req.presence_penalty,
      frequencyPenalty: req.frequency_penalty,
      n: req.n,
      responseFormat: req.response_format
        ? { type: req.response_format.type }
        : undefined,
    },
    raw: request,
  }
}

function parseMessage(msg: ZhipuMessage): Message {
  return {
    role: msg.role,
    content: msg.content ?? '',
    name: msg.name,
    toolCalls: msg.tool_calls,
    toolCallId: msg.tool_call_id,
  }
}

function parseTool(tool: ZhipuTool): Tool {
  return {
    type: 'function',
    function: {
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters,
    },
  }
}

function parseToolChoice(
  choice: 'auto' | 'none' | { type: 'function'; function: { name: string } }
): ToolChoice {
  if (typeof choice === 'string') {
    return choice as ToolChoice
  }
  return {
    type: 'function',
    function: {
      name: choice.function.name,
    },
  }
}
