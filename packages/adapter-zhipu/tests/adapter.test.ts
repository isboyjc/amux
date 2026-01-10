import { describe, it, expect } from 'vitest'
import { zhipuAdapter } from '../src/adapter'

describe('Zhipu Adapter', () => {
  describe('Inbound - parseRequest', () => {
    it('should parse basic Zhipu request to IR', () => {
      const request = {
        model: 'glm-4.7',
        messages: [
          { role: 'user', content: 'Hello!' },
        ],
        temperature: 0.7,
        max_tokens: 100,
      }

      const ir = zhipuAdapter.inbound.parseRequest(request)

      expect(ir.model).toBe('glm-4.7')
      expect(ir.messages).toHaveLength(1)
      expect(ir.messages[0]?.role).toBe('user')
      expect(ir.messages[0]?.content).toBe('Hello!')
      expect(ir.generation?.temperature).toBe(0.7)
      expect(ir.generation?.maxTokens).toBe(100)
    })

    it('should parse request with tools', () => {
      const request = {
        model: 'glm-4.7',
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

      const ir = zhipuAdapter.inbound.parseRequest(request)

      expect(ir.tools).toHaveLength(1)
      expect(ir.tools?.[0]?.function.name).toBe('get_weather')
      expect(ir.toolChoice).toBe('auto')
    })

    it('should parse request with system message', () => {
      const request = {
        model: 'glm-4.7',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello!' },
        ],
      }

      const ir = zhipuAdapter.inbound.parseRequest(request)

      expect(ir.system).toBe('You are a helpful assistant.')
      expect(ir.messages).toHaveLength(1)
      expect(ir.messages[0]?.role).toBe('user')
    })
  })

  describe('Outbound - buildRequest', () => {
    it('should build Zhipu request from IR', () => {
      const ir = {
        messages: [
          { role: 'user' as const, content: 'Hello!' },
        ],
        model: 'glm-4.7',
        generation: {
          temperature: 0.7,
          maxTokens: 100,
        },
      }

      const request = zhipuAdapter.outbound.buildRequest(ir)

      expect(request).toMatchObject({
        model: 'glm-4.7',
        messages: [{ role: 'user', content: 'Hello!' }],
        temperature: 0.7,
        max_tokens: 100,
      })
    })

    it('should build request with tools from IR', () => {
      const ir = {
        messages: [
          { role: 'user' as const, content: 'What is the weather?' },
        ],
        model: 'glm-4.7',
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

      const request = zhipuAdapter.outbound.buildRequest(ir)

      expect(request.tools).toHaveLength(1)
      expect(request.tools?.[0]?.function.name).toBe('get_weather')
      expect(request.tool_choice).toBe('auto')
    })

    it('should build request with system message from IR', () => {
      const ir = {
        messages: [
          { role: 'user' as const, content: 'Hello!' },
        ],
        model: 'glm-4.7',
        system: 'You are a helpful assistant.',
      }

      const request = zhipuAdapter.outbound.buildRequest(ir)

      expect(request.messages).toHaveLength(2)
      expect(request.messages[0]).toMatchObject({
        role: 'system',
        content: 'You are a helpful assistant.',
      })
      expect(request.messages[1]).toMatchObject({
        role: 'user',
        content: 'Hello!',
      })
    })
  })

  describe('Inbound - parseResponse', () => {
    it('should parse Zhipu response to IR', () => {
      const response = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'glm-4.7',
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

      const ir = zhipuAdapter.inbound.parseResponse?.(response)

      expect(ir?.id).toBe('chatcmpl-123')
      expect(ir?.model).toBe('glm-4.7')
      expect(ir?.choices).toHaveLength(1)
      expect(ir?.choices[0]?.message.content).toBe('Hello! How can I help you?')
      expect(ir?.choices[0]?.finishReason).toBe('stop')
      expect(ir?.usage?.promptTokens).toBe(10)
      expect(ir?.usage?.completionTokens).toBe(20)
    })
  })

  describe('Outbound - buildResponse', () => {
    it('should build Zhipu response from IR', () => {
      const ir = {
        id: 'chatcmpl-123',
        model: 'glm-4.7',
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

      const response = zhipuAdapter.outbound.buildResponse?.(ir)

      expect(response?.id).toBe('chatcmpl-123')
      expect(response?.model).toBe('glm-4.7')
      expect(response?.choices[0]?.message.content).toBe('Hello!')
      expect(response?.usage?.prompt_tokens).toBe(10)
    })
  })

  describe('Adapter Info', () => {
    it('should return correct adapter info', () => {
      const info = zhipuAdapter.getInfo()

      expect(info.name).toBe('zhipu')
      expect(info.version).toBe('1.0.0')
      expect(info.capabilities.streaming).toBe(true)
      expect(info.capabilities.tools).toBe(true)
      expect(info.capabilities.vision).toBe(true)
      expect(info.capabilities.multimodal).toBe(true)
      expect(info.capabilities.systemPrompt).toBe(true)
      expect(info.capabilities.toolChoice).toBe(true)
      expect(info.endpoint?.baseUrl).toBe('https://open.bigmodel.cn/api/paas')
      expect(info.endpoint?.chatPath).toBe('/v4/chat/completions')
    })
  })

  describe('Stream Parsing', () => {
    it('should parse stream start event', () => {
      const chunk = {
        id: 'chatcmpl-123',
        model: 'glm-4.7',
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: null,
          },
        ],
      }

      const event = zhipuAdapter.inbound.parseStream(chunk)

      expect(event).toMatchObject({
        type: 'start',
        id: 'chatcmpl-123',
        model: 'glm-4.7',
      })
    })

    it('should parse stream content delta', () => {
      const chunk = {
        id: 'chatcmpl-123',
        model: 'glm-4.7',
        choices: [
          {
            index: 0,
            delta: { content: 'Hello' },
            finish_reason: null,
          },
        ],
      }

      const event = zhipuAdapter.inbound.parseStream(chunk)

      expect(event).toMatchObject({
        type: 'content',
        content: {
          type: 'content',
          delta: 'Hello',
          index: 0,
        },
      })
    })

    it('should parse stream end event', () => {
      const chunk = {
        id: 'chatcmpl-123',
        model: 'glm-4.7',
        choices: [
          {
            index: 1, // Use index 1 to avoid start event detection
            delta: {},
            finish_reason: 'stop',
          },
        ],
      }

      const event = zhipuAdapter.inbound.parseStream(chunk)

      expect(event).toMatchObject({
        type: 'end',
        finishReason: 'stop',
      })
    })

    it('should parse stream tool call delta', () => {
      const chunk = {
        id: 'chatcmpl-123',
        model: 'glm-4.7',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'get_weather',
                    arguments: '{"location":"Beijing"}',
                  },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      }

      const event = zhipuAdapter.inbound.parseStream(chunk)

      expect(event).toMatchObject({
        type: 'tool_call',
        toolCall: {
          type: 'tool_call',
          id: 'call_123',
          name: 'get_weather',
          arguments: '{"location":"Beijing"}',
          index: 0,
        },
      })
    })
  })

  describe('Error Parsing', () => {
    it('should parse Zhipu error', () => {
      const error = {
        error: {
          message: 'Invalid API key',
          type: 'authentication_error',
          code: 'invalid_api_key',
        },
      }

      const ir = zhipuAdapter.inbound.parseError?.(error)

      expect(ir?.type).toBe('authentication')
      expect(ir?.message).toBe('Invalid API key')
      expect(ir?.code).toBe('invalid_api_key')
    })

    it('should handle unknown error format', () => {
      const error = 'Something went wrong'

      const ir = zhipuAdapter.inbound.parseError?.(error)

      expect(ir?.type).toBe('unknown')
      expect(ir?.message).toBe('Something went wrong')
    })
  })
})
