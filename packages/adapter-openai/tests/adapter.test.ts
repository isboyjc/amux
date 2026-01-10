import { describe, it, expect } from 'vitest'
import { openaiAdapter, openaiResponsesAdapter } from '../src'

describe('OpenAI Adapter', () => {
  describe('Inbound - parseRequest', () => {
    it('should parse basic OpenAI request to IR', () => {
      const request = {
        model: 'gpt-4',
        messages: [
          { role: 'user', content: 'Hello!' },
        ],
        temperature: 0.7,
        max_tokens: 100,
      }

      const ir = openaiAdapter.inbound.parseRequest(request)

      expect(ir.model).toBe('gpt-4')
      expect(ir.messages).toHaveLength(1)
      expect(ir.messages[0]?.role).toBe('user')
      expect(ir.messages[0]?.content).toBe('Hello!')
      expect(ir.generation?.temperature).toBe(0.7)
      expect(ir.generation?.maxTokens).toBe(100)
    })

    it('should parse request with system message to IR.system', () => {
      const request = {
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello!' },
        ],
      }

      const ir = openaiAdapter.inbound.parseRequest(request)

      expect(ir.system).toBe('You are a helpful assistant.')
      expect(ir.messages).toHaveLength(1)
      expect(ir.messages[0]?.role).toBe('user')
    })

    it('should parse request with tools', () => {
      const request = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'What is the weather?' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get weather',
              parameters: {
                type: 'object',
                properties: {
                  location: { type: 'string' },
                },
              },
            },
          },
        ],
        tool_choice: 'auto',
      }

      const ir = openaiAdapter.inbound.parseRequest(request)

      expect(ir.tools).toHaveLength(1)
      expect(ir.tools?.[0]?.function.name).toBe('get_weather')
      expect(ir.toolChoice).toBe('auto')
    })

    it('should parse request with multimodal content', () => {
      const request = {
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What is in this image?' },
              { type: 'image_url', image_url: { url: 'https://example.com/image.jpg' } },
            ],
          },
        ],
      }

      const ir = openaiAdapter.inbound.parseRequest(request)

      expect(ir.messages).toHaveLength(1)
      expect(Array.isArray(ir.messages[0]?.content)).toBe(true)
      const content = ir.messages[0]?.content as Array<{ type: string }>
      expect(content).toHaveLength(2)
      expect(content[0]?.type).toBe('text')
      expect(content[1]?.type).toBe('image')
    })

    it('should parse request with response_format', () => {
      const request = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Return JSON' }],
        response_format: { type: 'json_object' },
      }

      const ir = openaiAdapter.inbound.parseRequest(request)

      expect(ir.generation?.responseFormat?.type).toBe('json_object')
    })

    it('should parse request with logprobs', () => {
      const request = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello!' }],
        logprobs: true,
        top_logprobs: 5,
      }

      const ir = openaiAdapter.inbound.parseRequest(request)

      expect(ir.generation?.logprobs).toBe(true)
      expect(ir.generation?.topLogprobs).toBe(5)
    })
  })

  describe('Outbound - buildRequest', () => {
    it('should build OpenAI request from IR', () => {
      const ir = {
        messages: [
          { role: 'user' as const, content: 'Hello!' },
        ],
        model: 'gpt-4',
        generation: {
          temperature: 0.7,
          maxTokens: 100,
        },
      }

      const request = openaiAdapter.outbound.buildRequest(ir) as Record<string, unknown>

      expect(request).toMatchObject({
        model: 'gpt-4',
        temperature: 0.7,
        max_tokens: 100,
      })
    })

    it('should build request with system message from IR.system', () => {
      const ir = {
        messages: [
          { role: 'user' as const, content: 'Hello!' },
        ],
        model: 'gpt-4',
        system: 'You are a helpful assistant.',
      }

      const request = openaiAdapter.outbound.buildRequest(ir) as { messages: Array<{ role: string; content: string }> }

      expect(request.messages).toHaveLength(2)
      expect(request.messages[0]?.role).toBe('system')
      expect(request.messages[0]?.content).toBe('You are a helpful assistant.')
    })

    it('should build request with tools from IR', () => {
      const ir = {
        messages: [
          { role: 'user' as const, content: 'What is the weather?' },
        ],
        model: 'gpt-4',
        tools: [
          {
            type: 'function' as const,
            function: {
              name: 'get_weather',
              description: 'Get weather',
              parameters: {
                type: 'object',
                properties: {
                  location: { type: 'string' },
                },
              },
            },
          },
        ],
        toolChoice: 'auto' as const,
      }

      const request = openaiAdapter.outbound.buildRequest(ir) as { tools: Array<{ function: { name: string } }>; tool_choice: string }

      expect(request.tools).toHaveLength(1)
      expect(request.tools?.[0]?.function.name).toBe('get_weather')
      expect(request.tool_choice).toBe('auto')
    })

    it('should add stream_options when streaming', () => {
      const ir = {
        messages: [{ role: 'user' as const, content: 'Hello!' }],
        model: 'gpt-4',
        stream: true,
      }

      const request = openaiAdapter.outbound.buildRequest(ir) as { stream: boolean; stream_options: { include_usage: boolean } }

      expect(request.stream).toBe(true)
      expect(request.stream_options?.include_usage).toBe(true)
    })
  })

  describe('Inbound - parseResponse', () => {
    it('should parse OpenAI response to IR', () => {
      const response = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you?',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      }

      const ir = openaiAdapter.inbound.parseResponse!(response)

      expect(ir.id).toBe('chatcmpl-123')
      expect(ir.model).toBe('gpt-4')
      expect(ir.choices).toHaveLength(1)
      expect(ir.choices[0]?.message.content).toBe('Hello! How can I help you?')
      expect(ir.choices[0]?.finishReason).toBe('stop')
      expect(ir.usage?.promptTokens).toBe(10)
      expect(ir.usage?.completionTokens).toBe(20)
    })

    it('should parse response with tool calls', () => {
      const response = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'get_weather',
                    arguments: '{"location": "Tokyo"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      }

      const ir = openaiAdapter.inbound.parseResponse!(response)

      expect(ir.choices[0]?.message.toolCalls).toHaveLength(1)
      expect(ir.choices[0]?.message.toolCalls?.[0]?.function.name).toBe('get_weather')
      expect(ir.choices[0]?.finishReason).toBe('tool_calls')
    })
  })

  describe('Outbound - buildResponse', () => {
    it('should build OpenAI response from IR', () => {
      const ir = {
        id: 'chatcmpl-123',
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant' as const,
              content: 'Hello!',
            },
            finishReason: 'stop' as const,
          },
        ],
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
      }

      const response = openaiAdapter.outbound.buildResponse!(ir) as {
        id: string
        object: string
        model: string
        choices: Array<{ message: { content: string }; finish_reason: string }>
        usage: { prompt_tokens: number }
      }

      expect(response.id).toBe('chatcmpl-123')
      expect(response.object).toBe('chat.completion')
      expect(response.model).toBe('gpt-4')
      expect(response.choices[0]?.message.content).toBe('Hello!')
      expect(response.choices[0]?.finish_reason).toBe('stop')
      expect(response.usage?.prompt_tokens).toBe(10)
    })
  })

  describe('Stream Parsing', () => {
    it('should parse stream start event', () => {
      const chunk = {
        id: 'chatcmpl-123',
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: { role: 'assistant' },
            finish_reason: null,
          },
        ],
      }

      const event = openaiAdapter.inbound.parseStream!(chunk)

      expect(event).toMatchObject({
        type: 'start',
        id: 'chatcmpl-123',
        model: 'gpt-4',
      })
    })

    it('should parse stream content delta', () => {
      const chunk = {
        id: 'chatcmpl-123',
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: { content: 'Hello' },
            finish_reason: null,
          },
        ],
      }

      const event = openaiAdapter.inbound.parseStream!(chunk)

      expect(event).toMatchObject({
        type: 'content',
        content: {
          type: 'content',
          delta: 'Hello',
          index: 0,
        },
      })
    })

    it('should parse stream tool call delta', () => {
      const chunk = {
        id: 'chatcmpl-123',
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: 'call_123',
                  function: { name: 'get_weather', arguments: '{"loc' },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      }

      const event = openaiAdapter.inbound.parseStream!(chunk)

      expect(event).toMatchObject({
        type: 'tool_call',
        toolCall: {
          type: 'tool_call',
          id: 'call_123',
          name: 'get_weather',
        },
      })
    })

    it('should parse stream end event with usage', () => {
      const chunk = {
        id: 'chatcmpl-123',
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      }

      const event = openaiAdapter.inbound.parseStream!(chunk)

      expect(event).toMatchObject({
        type: 'end',
        finishReason: 'stop',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
        },
      })
    })
  })

  describe('Error Parsing', () => {
    it('should parse OpenAI error', () => {
      const error = {
        error: {
          message: 'Invalid API key',
          type: 'authentication_error',
          code: 'invalid_api_key',
        },
      }

      const ir = openaiAdapter.inbound.parseError!(error)

      expect(ir.type).toBe('authentication')
      expect(ir.message).toBe('Invalid API key')
      expect(ir.code).toBe('invalid_api_key')
    })

    it('should parse rate limit error', () => {
      const error = {
        error: {
          message: 'Rate limit exceeded',
          type: 'rate_limit_error',
        },
      }

      const ir = openaiAdapter.inbound.parseError!(error)

      expect(ir.type).toBe('rate_limit')
    })
  })

  describe('Adapter Info', () => {
    it('should return correct adapter info', () => {
      const info = openaiAdapter.getInfo()

      expect(info.name).toBe('openai')
      expect(info.version).toBe('1.0.0')
      expect(info.capabilities.streaming).toBe(true)
      expect(info.capabilities.tools).toBe(true)
      expect(info.capabilities.vision).toBe(true)
      expect(info.capabilities.jsonMode).toBe(true)
      expect(info.capabilities.logprobs).toBe(true)
      expect(info.endpoint?.baseUrl).toBe('https://api.openai.com')
      expect(info.endpoint?.chatPath).toBe('/v1/chat/completions')
    })
  })
})

describe('OpenAI Responses Adapter', () => {
  describe('Adapter Info', () => {
    it('should return correct adapter info with responses endpoint', () => {
      const info = openaiResponsesAdapter.getInfo()

      expect(info.name).toBe('openai-responses')
      expect(info.version).toBe('1.0.0')
      expect(info.capabilities.streaming).toBe(true)
      expect(info.capabilities.tools).toBe(true)
      expect(info.capabilities.vision).toBe(true)
      expect(info.capabilities.reasoning).toBe(true)
      expect(info.capabilities.webSearch).toBe(true)
      expect(info.capabilities.jsonMode).toBe(true) // Supported via text.format
      expect(info.endpoint?.baseUrl).toBe('https://api.openai.com')
      expect(info.endpoint?.chatPath).toBe('/v1/responses')
    })
  })

  describe('Inbound - parseRequest', () => {
    it('should parse Responses API request with string input', () => {
      const request = {
        model: 'gpt-4o',
        input: 'Hello!',
        instructions: 'You are a helpful assistant.',
        temperature: 0.7,
        max_output_tokens: 100,
      }

      const ir = openaiResponsesAdapter.inbound.parseRequest(request)

      expect(ir.model).toBe('gpt-4o')
      expect(ir.messages).toHaveLength(1)
      expect(ir.messages[0]?.role).toBe('user')
      expect(ir.messages[0]?.content).toBe('Hello!')
      expect(ir.system).toBe('You are a helpful assistant.')
      expect(ir.generation?.temperature).toBe(0.7)
      expect(ir.generation?.maxTokens).toBe(100)
    })

    it('should parse Responses API request with message array input', () => {
      const request = {
        model: 'gpt-4o',
        input: [
          { type: 'message', role: 'user', content: 'Hello!' },
          { type: 'message', role: 'assistant', content: 'Hi there!' },
          { type: 'message', role: 'user', content: 'How are you?' },
        ],
      }

      const ir = openaiResponsesAdapter.inbound.parseRequest(request)

      expect(ir.messages).toHaveLength(3)
      expect(ir.messages[0]?.role).toBe('user')
      expect(ir.messages[0]?.content).toBe('Hello!')
      expect(ir.messages[1]?.role).toBe('assistant')
      expect(ir.messages[2]?.role).toBe('user')
    })

    it('should parse Responses API request with function tools', () => {
      const request = {
        model: 'gpt-4o',
        input: 'What is the weather?',
        tools: [
          {
            type: 'function',
            name: 'get_weather',
            description: 'Get weather',
            parameters: {
              type: 'object',
              properties: {
                location: { type: 'string' },
              },
            },
          },
          {
            type: 'web_search_preview',
            search_context_size: 'medium',
          },
        ],
        tool_choice: 'auto',
      }

      const ir = openaiResponsesAdapter.inbound.parseRequest(request)

      expect(ir.tools).toHaveLength(1) // Only function tools are converted
      expect(ir.tools?.[0]?.function.name).toBe('get_weather')
      expect(ir.toolChoice).toBe('auto')
      // Built-in tools are stored in extensions
      expect(ir.extensions?.responses?.builtInTools).toHaveLength(1)
    })
  })

  describe('Outbound - buildRequest', () => {
    it('should build Responses API request from IR', () => {
      const ir = {
        messages: [
          { role: 'user' as const, content: 'Hello!' },
        ],
        model: 'gpt-4o',
        system: 'You are a helpful assistant.',
        generation: {
          temperature: 0.7,
          maxTokens: 100,
        },
      }

      const request = openaiResponsesAdapter.outbound.buildRequest(ir) as {
        model: string
        input: string
        instructions: string
        temperature: number
        max_output_tokens: number
      }

      expect(request.model).toBe('gpt-4o')
      expect(request.input).toBe('Hello!') // Single user message becomes string
      expect(request.instructions).toBe('You are a helpful assistant.')
      expect(request.temperature).toBe(0.7)
      expect(request.max_output_tokens).toBe(100)
    })

    it('should build Responses API request with multiple messages', () => {
      const ir = {
        messages: [
          { role: 'user' as const, content: 'Hello!' },
          { role: 'assistant' as const, content: 'Hi!' },
          { role: 'user' as const, content: 'How are you?' },
        ],
        model: 'gpt-4o',
      }

      const request = openaiResponsesAdapter.outbound.buildRequest(ir) as {
        model: string
        input: Array<{ type: string; role: string; content: string }>
      }

      expect(request.model).toBe('gpt-4o')
      expect(Array.isArray(request.input)).toBe(true)
      expect(request.input).toHaveLength(3)
      expect(request.input[0]?.type).toBe('message')
      expect(request.input[0]?.role).toBe('user')
    })

    it('should build Responses API request with tools', () => {
      const ir = {
        messages: [
          { role: 'user' as const, content: 'What is the weather?' },
        ],
        model: 'gpt-4o',
        tools: [
          {
            type: 'function' as const,
            function: {
              name: 'get_weather',
              description: 'Get weather',
              parameters: {
                type: 'object',
                properties: {
                  location: { type: 'string' },
                },
              },
            },
          },
        ],
        toolChoice: 'auto' as const,
      }

      const request = openaiResponsesAdapter.outbound.buildRequest(ir) as {
        tools: Array<{ type: string; name: string }>
        tool_choice: string
      }

      expect(request.tools).toHaveLength(1)
      expect(request.tools[0]?.type).toBe('function')
      expect(request.tools[0]?.name).toBe('get_weather')
      expect(request.tool_choice).toBe('auto')
    })
  })

  describe('Inbound - parseResponse', () => {
    it('should parse Responses API response to IR', () => {
      const response = {
        id: 'resp_123',
        object: 'response',
        created_at: 1677652288,
        model: 'gpt-4o',
        status: 'completed',
        output: [
          {
            type: 'message',
            id: 'msg_123',
            role: 'assistant',
            content: [
              { type: 'output_text', text: 'Hello! How can I help you?' },
            ],
            status: 'completed',
          },
        ],
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
        },
      }

      const ir = openaiResponsesAdapter.inbound.parseResponse!(response)

      expect(ir.id).toBe('resp_123')
      expect(ir.model).toBe('gpt-4o')
      expect(ir.choices).toHaveLength(1)
      expect(ir.choices[0]?.message.content).toBe('Hello! How can I help you?')
      expect(ir.choices[0]?.finishReason).toBe('stop')
      expect(ir.usage?.promptTokens).toBe(10)
      expect(ir.usage?.completionTokens).toBe(20)
    })

    it('should parse Responses API response with function call', () => {
      const response = {
        id: 'resp_123',
        object: 'response',
        created_at: 1677652288,
        model: 'gpt-4o',
        status: 'completed',
        output: [
          {
            type: 'function_call',
            id: 'fc_123',
            call_id: 'call_123',
            name: 'get_weather',
            arguments: '{"location": "Tokyo"}',
            status: 'completed',
          },
        ],
      }

      const ir = openaiResponsesAdapter.inbound.parseResponse!(response)

      expect(ir.choices[0]?.message.toolCalls).toHaveLength(1)
      expect(ir.choices[0]?.message.toolCalls?.[0]?.function.name).toBe('get_weather')
      expect(ir.choices[0]?.message.toolCalls?.[0]?.function.arguments).toBe('{"location": "Tokyo"}')
    })

    it('should parse Responses API response with reasoning', () => {
      const response = {
        id: 'resp_123',
        object: 'response',
        created_at: 1677652288,
        model: 'o1-preview',
        status: 'completed',
        output: [
          {
            type: 'reasoning',
            id: 'reasoning_123',
            content: [
              { type: 'reasoning_text', text: 'Let me think about this...' },
            ],
          },
          {
            type: 'message',
            id: 'msg_123',
            role: 'assistant',
            content: [
              { type: 'output_text', text: 'The answer is 42.' },
            ],
            status: 'completed',
          },
        ],
      }

      const ir = openaiResponsesAdapter.inbound.parseResponse!(response)

      expect(ir.choices[0]?.message.content).toBe('The answer is 42.')
      expect(ir.choices[0]?.message.reasoningContent).toBe('Let me think about this...')
    })
  })

  describe('Outbound - buildResponse', () => {
    it('should build Responses API response from IR', () => {
      const ir = {
        id: 'resp_123',
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant' as const,
              content: 'Hello!',
            },
            finishReason: 'stop' as const,
          },
        ],
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
      }

      const response = openaiResponsesAdapter.outbound.buildResponse!(ir) as {
        id: string
        object: string
        model: string
        status: string
        output: Array<{ type: string; content: Array<{ type: string; text: string }> }>
        usage: { input_tokens: number; output_tokens: number }
      }

      expect(response.id).toBe('resp_123')
      expect(response.object).toBe('response')
      expect(response.model).toBe('gpt-4o')
      expect(response.status).toBe('completed')
      expect(response.output[0]?.type).toBe('message')
      expect(response.output[0]?.content[0]?.text).toBe('Hello!')
      expect(response.usage?.input_tokens).toBe(10)
      expect(response.usage?.output_tokens).toBe(20)
    })
  })

  describe('Stream Parsing', () => {
    it('should parse Responses API stream created event', () => {
      const chunk = {
        type: 'response.created',
        response: {
          id: 'resp_123',
          object: 'response',
          created_at: 1677652288,
          model: 'gpt-4o',
          status: 'in_progress',
          output: [],
        },
      }

      const event = openaiResponsesAdapter.inbound.parseStream!(chunk)

      expect(event).toMatchObject({
        type: 'start',
        id: 'resp_123',
        model: 'gpt-4o',
      })
    })

    it('should parse Responses API stream text delta', () => {
      const chunk = {
        type: 'response.output_text.delta',
        output_index: 0,
        content_index: 0,
        delta: 'Hello',
      }

      const event = openaiResponsesAdapter.inbound.parseStream!(chunk)

      expect(event).toMatchObject({
        type: 'content',
        content: {
          type: 'content',
          delta: 'Hello',
          index: 0,
        },
      })
    })

    it('should parse Responses API stream completed event', () => {
      const chunk = {
        type: 'response.completed',
        response: {
          id: 'resp_123',
          object: 'response',
          created_at: 1677652288,
          model: 'gpt-4o',
          status: 'completed',
          output: [],
          usage: {
            input_tokens: 10,
            output_tokens: 20,
            total_tokens: 30,
          },
        },
      }

      const event = openaiResponsesAdapter.inbound.parseStream!(chunk)

      expect(event).toMatchObject({
        type: 'end',
        finishReason: 'stop',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
        },
      })
    })
  })
})
