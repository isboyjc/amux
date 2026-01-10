import type {
  LLMRequestIR,
  Message,
  Tool,
  ToolChoice,
  ContentPart,
  TextContent,
  ImageContent,
  ResponseFormat,
  GenerationConfig,
} from '@amux/llm-bridge'

import type {
  ResponsesRequest,
  ResponsesInputItem,
  ResponsesContentPart,
  ResponsesTool,
} from '../types'

/**
 * Parse Responses API request to IR
 */
export function parseResponsesRequest(request: unknown): LLMRequestIR {
  const req = request as ResponsesRequest

  // Extract system message from instructions
  let system = req.instructions

  // Parse input to messages
  const { messages, developerSystem } = parseInput(req.input)

  // Combine instructions and developer system messages
  if (developerSystem) {
    system = system ? `${system}\n${developerSystem}` : developerSystem
  }

  // Parse tools
  const tools: Tool[] | undefined = req.tools
    ?.filter((tool): tool is ResponsesTool & { type: 'function' } => tool.type === 'function')
    .map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        strict: tool.strict,
      },
    }))

  // Parse tool choice
  const toolChoice: ToolChoice | undefined = req.tool_choice
    ? parseToolChoice(req.tool_choice)
    : undefined

  // Parse response format from text.format
  let responseFormat: ResponseFormat | undefined
  if (req.text?.format) {
    if (req.text.format.type === 'json_object') {
      responseFormat = { type: 'json_object' }
    } else if (req.text.format.type === 'json_schema' && req.text.format.json_schema) {
      responseFormat = {
        type: 'json_schema',
        jsonSchema: {
          name: req.text.format.json_schema.name,
          description: req.text.format.json_schema.description,
          schema: req.text.format.json_schema.schema,
          strict: req.text.format.json_schema.strict,
        }
      }
    }
  }

  // Build generation config with responseFormat
  const generation: GenerationConfig = {
    temperature: req.temperature,
    topP: req.top_p,
    maxTokens: req.max_output_tokens,
    responseFormat,
  }

  return {
    messages,
    model: req.model,
    tools: tools && tools.length > 0 ? tools : undefined,
    toolChoice,
    stream: req.stream,
    system,
    generation,
    metadata: {
      userId: req.user,
      ...(req.metadata || {}),
    },
    extensions: {
      responses: {
        truncation: req.truncation,
        store: req.store,
        reasoning: req.reasoning,
        previousResponseId: req.previous_response_id,
        parallelToolCalls: req.parallel_tool_calls,
        text: req.text,
        // Track built-in tools for outbound
        builtInTools: req.tools?.filter((t) => t.type !== 'function'),
      },
    },
    raw: request,
  }
}

function parseInput(input: string | ResponsesInputItem[]): { messages: Message[]; developerSystem?: string } {
  if (typeof input === 'string') {
    return {
      messages: [
        {
          role: 'user',
          content: input,
        },
      ],
    }
  }

  const messages: Message[] = []
  let developerSystem: string | undefined

  for (const item of input) {
    // Handle item_reference type
    if (item.type === 'item_reference') {
      continue
    }

    // Get role and content (works for both explicit type:'message' and shorthand format)
    const role = item.role
    const content = item.content

    // Handle system/developer messages - extract as system prompt
    if (role === 'system' || role === 'developer') {
      if (typeof content === 'string') {
        developerSystem = developerSystem ? `${developerSystem}\n${content}` : content
      } else {
        // Extract text from content parts
        const text = content
          .filter((p) => p.type === 'input_text')
          .map((p) => (p as { type: 'input_text'; text: string }).text)
          .join('')
        developerSystem = developerSystem ? `${developerSystem}\n${text}` : text
      }
      continue
    }

    // Handle user/assistant messages
    messages.push({
      role: role as 'user' | 'assistant',
      content: parseContent(content),
    })
  }

  return { messages, developerSystem }
}

function parseContent(content: string | ResponsesContentPart[]): string | ContentPart[] {
  if (typeof content === 'string') {
    return content
  }

  return content.map((part): ContentPart => {
    if (part.type === 'input_text') {
      return {
        type: 'text',
        text: part.text,
      } as TextContent
    }

    if (part.type === 'input_image') {
      // Check if it's a base64 data URL
      if (part.image_url.startsWith('data:')) {
        const match = part.image_url.match(/^data:([^;]+);base64,(.+)$/)
        if (match) {
          return {
            type: 'image',
            source: {
              type: 'base64',
              mediaType: match[1],
              data: match[2],
            },
          } as ImageContent
        }
      }

      return {
        type: 'image',
        source: {
          type: 'url',
          url: part.image_url,
        },
      } as ImageContent
    }

    // input_file - convert to text representation
    if (part.type === 'input_file') {
      return {
        type: 'text',
        text: `[File: ${part.file_id}]`,
      } as TextContent
    }

    // Fallback
    return {
      type: 'text',
      text: JSON.stringify(part),
    } as TextContent
  })
}

function parseToolChoice(
  choice: 'auto' | 'none' | 'required' | { type: 'function'; name: string }
): ToolChoice {
  if (typeof choice === 'string') {
    return choice as ToolChoice
  }
  return {
    type: 'function',
    function: {
      name: choice.name,
    },
  }
}
