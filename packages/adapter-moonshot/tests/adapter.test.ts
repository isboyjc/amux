import { describe, it, expect } from 'vitest'
import { moonshotAdapter } from '../src/adapter'

describe('Moonshot Adapter', () => {
  describe('Inbound - parseRequest', () => {
    it('should parse basic Moonshot request to IR', () => {
      const request = {
        model: 'moonshot-v1-8k',
        messages: [
          { role: 'user', content: 'Hello!' },
        ],
        temperature: 0.7,
        max_tokens: 100,
      }

      const ir = moonshotAdapter.inbound.parseRequest(request)

      expect(ir.model).toBe('moonshot-v1-8k')
      expect(ir.messages).toHaveLength(1)
      expect(ir.messages[0]?.role).toBe('user')
      expect(ir.messages[0]?.content).toBe('Hello!')
      expect(ir.generation?.temperature).toBe(0.7)
      expect(ir.generation?.maxTokens).toBe(100)
    })

    it('should parse request with tools', () => {
      const request = {
        model: 'moonshot-v1-8k',
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

      const ir = moonshotAdapter.inbound.parseRequest(request)

      expect(ir.tools).toHaveLength(1)
      expect(ir.tools?.[0]?.function.name).toBe('get_weather')
      expect(ir.toolChoice).toBe('auto')
    })

    it('should parse request with system message', () => {
      const request = {
        model: 'moonshot-v1-8k',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello!' },
        ],
      }

      const ir = moonshotAdapter.inbound.parseRequest(request)

      expect(ir.system).toBe('You are a helpful assistant.')
      expect(ir.messages).toHaveLength(1)
      expect(ir.messages[0]?.role).toBe('user')
    })
  })

  describe('Outbound - buildRequest', () => {
    it('should build Moonshot request from IR', () => {
      const ir = {
        messages: [
          { role: 'user' as const, content: 'Hello!' },
        ],
        model: 'moonshot-v1-8k',
        generation: {
          temperature: 0.7,
          maxTokens: 100,
        },
      }

      const request = moonshotAdapter.outbound.buildRequest(ir)

      expect(request).toMatchObject({
        model: 'moonshot-v1-8k',
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
        model: 'moonshot-v1-8k',
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

      const request = moonshotAdapter.outbound.buildRequest(ir)

      expect(request.tools).toHaveLength(1)
      expect(request.tools?.[0]?.function.name).toBe('get_weather')
      expect(request.tool_choice).toBe('auto')
    })
  })

  describe('Adapter Info', () => {
    it('should return correct adapter info', () => {
      const info = moonshotAdapter.getInfo()

      expect(info.name).toBe('moonshot')
      expect(info.version).toBe('1.0.0')
      expect(info.capabilities.streaming).toBe(true)
      expect(info.capabilities.tools).toBe(true)
      expect(info.capabilities.vision).toBe(false)
      expect(info.capabilities.multimodal).toBe(false)
      expect(info.capabilities.systemPrompt).toBe(true)
      expect(info.capabilities.toolChoice).toBe(true)
    })
  })

  describe('Stream Parsing', () => {
    it('should parse stream start event', () => {
      const chunk = {
        id: 'chatcmpl-123',
        model: 'moonshot-v1-8k',
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: null,
          },
        ],
      }

      const event = moonshotAdapter.inbound.parseStream(chunk)

      expect(event).toMatchObject({
        type: 'start',
        id: 'chatcmpl-123',
        model: 'moonshot-v1-8k',
      })
    })

    it('should parse stream content delta', () => {
      const chunk = {
        id: 'chatcmpl-123',
        model: 'moonshot-v1-8k',
        choices: [
          {
            index: 0,
            delta: { content: 'Hello' },
            finish_reason: null,
          },
        ],
      }

      const event = moonshotAdapter.inbound.parseStream(chunk)

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
        model: 'moonshot-v1-8k',
        choices: [
          {
            index: 1, // Use index 1 to avoid start event detection
            delta: {},
            finish_reason: 'stop',
          },
        ],
      }

      const event = moonshotAdapter.inbound.parseStream(chunk)

      expect(event).toMatchObject({
        type: 'end',
        finishReason: 'stop',
      })
    })
  })
})
