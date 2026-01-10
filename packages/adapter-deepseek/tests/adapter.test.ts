import { describe, it, expect } from 'vitest'
import { deepseekAdapter } from '../src/adapter'

describe('DeepSeek Adapter', () => {
  describe('Inbound - parseRequest', () => {
    it('should parse basic DeepSeek request to IR', () => {
      const request = {
        model: 'deepseek-chat',
        messages: [
          { role: 'user', content: 'Hello!' },
        ],
        temperature: 0.7,
        max_tokens: 100,
      }

      const ir = deepseekAdapter.inbound.parseRequest(request)

      expect(ir.model).toBe('deepseek-chat')
      expect(ir.messages).toHaveLength(1)
      expect(ir.messages[0]?.role).toBe('user')
      expect(ir.messages[0]?.content).toBe('Hello!')
      expect(ir.generation?.temperature).toBe(0.7)
      expect(ir.generation?.maxTokens).toBe(100)
    })

    it('should parse request with system message to IR.system', () => {
      const request = {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello!' },
        ],
      }

      const ir = deepseekAdapter.inbound.parseRequest(request)

      expect(ir.system).toBe('You are a helpful assistant.')
      expect(ir.messages).toHaveLength(1)
      expect(ir.messages[0]?.role).toBe('user')
    })

    it('should parse request with tools', () => {
      const request = {
        model: 'deepseek-chat',
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

      const ir = deepseekAdapter.inbound.parseRequest(request)

      expect(ir.tools).toHaveLength(1)
      expect(ir.tools?.[0]?.function.name).toBe('get_weather')
      expect(ir.toolChoice).toBe('auto')
    })

    it('should parse request with thinking mode', () => {
      const request = {
        model: 'deepseek-reasoner',
        messages: [{ role: 'user', content: 'Solve this problem' }],
        thinking: { type: 'enabled' },
      }

      const ir = deepseekAdapter.inbound.parseRequest(request)

      expect(ir.generation?.thinking?.enabled).toBe(true)
    })

    it('should parse message with reasoning_content', () => {
      const request = {
        model: 'deepseek-reasoner',
        messages: [
          {
            role: 'assistant',
            content: 'The answer is 42.',
            reasoning_content: 'Let me think step by step...',
          },
        ],
      }

      const ir = deepseekAdapter.inbound.parseRequest(request)

      expect(ir.messages[0]?.reasoningContent).toBe('Let me think step by step...')
    })
  })

  describe('Outbound - buildRequest', () => {
    it('should build DeepSeek request from IR', () => {
      const ir = {
        messages: [
          { role: 'user' as const, content: 'Hello!' },
        ],
        model: 'deepseek-chat',
        generation: {
          temperature: 0.7,
          maxTokens: 100,
        },
      }

      const request = deepseekAdapter.outbound.buildRequest(ir) as Record<string, unknown>

      expect(request).toMatchObject({
        model: 'deepseek-chat',
        temperature: 0.7,
        max_tokens: 100,
      })
    })

    it('should build request with system message from IR.system', () => {
      const ir = {
        messages: [
          { role: 'user' as const, content: 'Hello!' },
        ],
        model: 'deepseek-chat',
        system: 'You are a helpful assistant.',
      }

      const request = deepseekAdapter.outbound.buildRequest(ir) as { messages: Array<{ role: string; content: string }> }

      expect(request.messages).toHaveLength(2)
      expect(request.messages[0]?.role).toBe('system')
      expect(request.messages[0]?.content).toBe('You are a helpful assistant.')
    })

    it('should build request with thinking mode', () => {
      const ir = {
        messages: [{ role: 'user' as const, content: 'Solve this' }],
        model: 'deepseek-reasoner',
        generation: {
          thinking: { enabled: true },
        },
      }

      const request = deepseekAdapter.outbound.buildRequest(ir) as { thinking: { type: string } }

      expect(request.thinking?.type).toBe('enabled')
    })

    it('should build request with tools from IR', () => {
      const ir = {
        messages: [
          { role: 'user' as const, content: 'What is the weather?' },
        ],
        model: 'deepseek-chat',
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

      const request = deepseekAdapter.outbound.buildRequest(ir) as { tools: Array<{ function: { name: string } }>; tool_choice: string }

      expect(request.tools).toHaveLength(1)
      expect(request.tools?.[0]?.function.name).toBe('get_weather')
      expect(request.tool_choice).toBe('auto')
    })

    it('should add stream_options when streaming', () => {
      const ir = {
        messages: [{ role: 'user' as const, content: 'Hello!' }],
        model: 'deepseek-chat',
        stream: true,
      }

      const request = deepseekAdapter.outbound.buildRequest(ir) as { stream: boolean; stream_options: { include_usage: boolean } }

      expect(request.stream).toBe(true)
      expect(request.stream_options?.include_usage).toBe(true)
    })
  })

  describe('Inbound - parseResponse', () => {
    it('should parse DeepSeek response to IR', () => {
      const response = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello!',
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

      const ir = deepseekAdapter.inbound.parseResponse!(response)

      expect(ir.id).toBe('chatcmpl-123')
      expect(ir.model).toBe('deepseek-chat')
      expect(ir.choices[0]?.message.content).toBe('Hello!')
      expect(ir.usage?.promptTokens).toBe(10)
    })

    it('should parse response with reasoning_content', () => {
      const response = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'deepseek-reasoner',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'The answer is 42.',
              reasoning_content: 'Let me think step by step...',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
          completion_tokens_details: {
            reasoning_tokens: 15,
          },
        },
      }

      const ir = deepseekAdapter.inbound.parseResponse!(response)

      expect(ir.choices[0]?.message.reasoningContent).toBe('Let me think step by step...')
      expect(ir.usage?.details?.reasoningTokens).toBe(15)
    })

    it('should parse response with cache tokens', () => {
      const response = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hello!' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 20,
          total_tokens: 120,
          prompt_cache_hit_tokens: 80,
          prompt_cache_miss_tokens: 20,
        },
      }

      const ir = deepseekAdapter.inbound.parseResponse!(response)

      expect(ir.usage?.details?.cachedTokens).toBe(80)
    })
  })

  describe('Stream Parsing', () => {
    it('should parse stream start event', () => {
      const chunk = {
        id: 'chatcmpl-123',
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            delta: { role: 'assistant' },
            finish_reason: null,
          },
        ],
      }

      const event = deepseekAdapter.inbound.parseStream!(chunk)

      expect(event).toMatchObject({
        type: 'start',
        id: 'chatcmpl-123',
        model: 'deepseek-chat',
      })
    })

    it('should parse stream content delta', () => {
      const chunk = {
        id: 'chatcmpl-123',
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            delta: { content: 'Hello' },
            finish_reason: null,
          },
        ],
      }

      const event = deepseekAdapter.inbound.parseStream!(chunk)

      expect(event).toMatchObject({
        type: 'content',
        content: {
          type: 'content',
          delta: 'Hello',
          index: 0,
        },
      })
    })

    it('should parse stream reasoning_content delta', () => {
      const chunk = {
        id: 'chatcmpl-123',
        model: 'deepseek-reasoner',
        choices: [
          {
            index: 0,
            delta: { reasoning_content: 'Let me think...' },
            finish_reason: null,
          },
        ],
      }

      const events = deepseekAdapter.inbound.parseStream!(chunk)

      expect(events).toMatchObject({
        type: 'reasoning',
        reasoning: {
          type: 'reasoning',
          delta: 'Let me think...',
        },
      })
    })

    it('should parse stream end event', () => {
      const chunk = {
        id: 'chatcmpl-123',
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: 'stop',
          },
        ],
      }

      const event = deepseekAdapter.inbound.parseStream!(chunk)

      expect(event).toMatchObject({
        type: 'end',
        finishReason: 'stop',
      })
    })
  })

  describe('Error Parsing', () => {
    it('should parse DeepSeek error', () => {
      const error = {
        error: {
          message: 'Invalid API key',
          type: 'authentication_error',
          code: 'invalid_api_key',
        },
      }

      const ir = deepseekAdapter.inbound.parseError!(error)

      expect(ir.type).toBe('authentication')
      expect(ir.message).toBe('Invalid API key')
    })
  })

  describe('Adapter Info', () => {
    it('should return correct adapter info', () => {
      const info = deepseekAdapter.getInfo()

      expect(info.name).toBe('deepseek')
      expect(info.version).toBe('1.0.0')
      expect(info.capabilities.streaming).toBe(true)
      expect(info.capabilities.tools).toBe(true)
      expect(info.capabilities.vision).toBe(false)
      expect(info.capabilities.reasoning).toBe(true)
      expect(info.endpoint?.baseUrl).toBe('https://api.deepseek.com')
      expect(info.endpoint?.chatPath).toBe('/v1/chat/completions')
    })
  })
})
