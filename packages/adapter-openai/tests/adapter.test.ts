import { describe, it, expect } from 'vitest'
import { openaiAdapter } from '../src/adapter'

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
        model: 'gpt-4-vision-preview',
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
