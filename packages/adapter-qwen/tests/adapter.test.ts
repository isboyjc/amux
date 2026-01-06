import { describe, it, expect } from 'vitest'
import { qwenAdapter } from '../src/adapter'

describe('Qwen Adapter', () => {
  describe('Inbound - parseRequest', () => {
    it('should parse basic Qwen request to IR', () => {
      const request = {
        model: 'qwen-turbo',
        messages: [
          { role: 'user', content: 'Hello!' },
        ],
        temperature: 0.7,
        max_tokens: 100,
      }

      const ir = qwenAdapter.inbound.parseRequest(request)

      expect(ir.model).toBe('qwen-turbo')
      expect(ir.messages).toHaveLength(1)
      expect(ir.messages[0]?.role).toBe('user')
      expect(ir.messages[0]?.content).toBe('Hello!')
      expect(ir.generation?.temperature).toBe(0.7)
      expect(ir.generation?.maxTokens).toBe(100)
    })

    it('should parse request with tools', () => {
      const request = {
        model: 'qwen-turbo',
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

      const ir = qwenAdapter.inbound.parseRequest(request)

      expect(ir.tools).toHaveLength(1)
      expect(ir.tools?.[0]?.function.name).toBe('get_weather')
      expect(ir.toolChoice).toBe('auto')
    })

    it('should parse request with system message', () => {
      const request = {
        model: 'qwen-turbo',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello!' },
        ],
      }

      const ir = qwenAdapter.inbound.parseRequest(request)

      expect(ir.messages).toHaveLength(2)
      expect(ir.messages[0]?.role).toBe('system')
      expect(ir.messages[0]?.content).toBe('You are a helpful assistant.')
    })

    it('should parse request with vision content', () => {
      const request = {
        model: 'qwen-vl-plus',
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

      const ir = qwenAdapter.inbound.parseRequest(request)

      expect(ir.messages).toHaveLength(1)
      expect(Array.isArray(ir.messages[0]?.content)).toBe(true)
      const content = ir.messages[0]?.content as Array<{ type: string }>
      expect(content).toHaveLength(2)
      expect(content[0]?.type).toBe('text')
      expect(content[1]?.type).toBe('image_url')
    })
  })

  describe('Outbound - buildRequest', () => {
    it('should build Qwen request from IR', () => {
      const ir = {
        messages: [
          { role: 'user' as const, content: 'Hello!' },
        ],
        model: 'qwen-turbo',
        generation: {
          temperature: 0.7,
          maxTokens: 100,
        },
      }

      const request = qwenAdapter.outbound.buildRequest(ir)

      expect(request).toMatchObject({
        model: 'qwen-turbo',
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
        model: 'qwen-turbo',
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

      const request = qwenAdapter.outbound.buildRequest(ir)

      expect(request.tools).toHaveLength(1)
      expect(request.tools?.[0]?.function.name).toBe('get_weather')
      expect(request.tool_choice).toBe('auto')
    })

    it('should build request with vision content from IR', () => {
      const ir = {
        messages: [
          {
            role: 'user' as const,
            content: [
              { type: 'text' as const, text: 'What is in this image?' },
              { type: 'image_url' as const, image_url: { url: 'https://example.com/image.jpg' } },
            ],
          },
        ],
        model: 'qwen-vl-plus',
      }

      const request = qwenAdapter.outbound.buildRequest(ir)

      // OpenAI adapter converts non-string content to JSON string
      expect(typeof request.messages[0]?.content).toBe('string')
      const content = JSON.parse(request.messages[0]?.content as string)
      expect(Array.isArray(content)).toBe(true)
      expect(content).toHaveLength(2)
      expect(content[0]?.type).toBe('text')
      expect(content[1]?.type).toBe('image_url')
    })
  })

  describe('Adapter Info', () => {
    it('should return correct adapter info', () => {
      const info = qwenAdapter.getInfo()

      expect(info.name).toBe('qwen')
      expect(info.version).toBe('1.0.0')
      expect(info.capabilities.streaming).toBe(true)
      expect(info.capabilities.tools).toBe(true)
      expect(info.capabilities.vision).toBe(true)
      expect(info.capabilities.multimodal).toBe(true)
      expect(info.capabilities.systemPrompt).toBe(true)
      expect(info.capabilities.toolChoice).toBe(true)
    })
  })

  describe('Stream Parsing', () => {
    it('should parse stream start event', () => {
      const chunk = {
        id: 'chatcmpl-123',
        model: 'qwen-turbo',
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: null,
          },
        ],
      }

      const event = qwenAdapter.inbound.parseStream(chunk)

      expect(event).toMatchObject({
        type: 'start',
        id: 'chatcmpl-123',
        model: 'qwen-turbo',
      })
    })

    it('should parse stream content delta', () => {
      const chunk = {
        id: 'chatcmpl-123',
        model: 'qwen-turbo',
        choices: [
          {
            index: 0,
            delta: { content: 'Hello' },
            finish_reason: null,
          },
        ],
      }

      const event = qwenAdapter.inbound.parseStream(chunk)

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
        model: 'qwen-turbo',
        choices: [
          {
            index: 1, // Use index 1 to avoid start event detection
            delta: {},
            finish_reason: 'stop',
          },
        ],
      }

      const event = qwenAdapter.inbound.parseStream(chunk)

      expect(event).toMatchObject({
        type: 'end',
        finishReason: 'stop',
      })
    })
  })
})
