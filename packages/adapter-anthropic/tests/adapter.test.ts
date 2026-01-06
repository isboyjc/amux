import { describe, it, expect } from 'vitest'
import { anthropicAdapter } from '../src/adapter'

describe('Anthropic Adapter', () => {
  describe('Inbound - parseRequest', () => {
    it('should parse basic Anthropic request to IR', () => {
      const request = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          { role: 'user', content: 'Hello!' },
        ],
        max_tokens: 100,
        temperature: 0.7,
      }

      const ir = anthropicAdapter.inbound.parseRequest(request)

      expect(ir.model).toBe('claude-3-5-sonnet-20241022')
      expect(ir.messages).toHaveLength(1)
      expect(ir.messages[0]?.role).toBe('user')
      expect(ir.messages[0]?.content).toBe('Hello!')
      expect(ir.generation?.temperature).toBe(0.7)
      expect(ir.generation?.maxTokens).toBe(100)
    })

    it('should parse request with system prompt', () => {
      const request = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'Hello!' }],
        system: 'You are a helpful assistant',
        max_tokens: 100,
      }

      const ir = anthropicAdapter.inbound.parseRequest(request)

      expect(ir.messages).toHaveLength(2)
      expect(ir.messages[0]?.role).toBe('system')
      expect(ir.messages[0]?.content).toBe('You are a helpful assistant')
      expect(ir.messages[1]?.role).toBe('user')
    })

    it('should parse request with tools', () => {
      const request = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'What is the weather?' }],
        tools: [
          {
            name: 'get_weather',
            description: 'Get weather',
            input_schema: {
              type: 'object',
              properties: {
                location: { type: 'string' },
              },
            },
          },
        ],
        max_tokens: 100,
      }

      const ir = anthropicAdapter.inbound.parseRequest(request)

      expect(ir.tools).toHaveLength(1)
      expect(ir.tools?.[0]?.function.name).toBe('get_weather')
    })
  })

  describe('Outbound - buildRequest', () => {
    it('should build Anthropic request from IR', () => {
      const ir = {
        messages: [
          { role: 'user' as const, content: 'Hello!' },
        ],
        model: 'claude-3-5-sonnet-20241022',
        generation: {
          temperature: 0.7,
          maxTokens: 100,
        },
      }

      const request = anthropicAdapter.outbound.buildRequest(ir)

      expect(request).toMatchObject({
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'Hello!' }],
        temperature: 0.7,
        max_tokens: 100,
      })
    })

    it('should extract system message', () => {
      const ir = {
        messages: [
          { role: 'system' as const, content: 'You are helpful' },
          { role: 'user' as const, content: 'Hello!' },
        ],
        model: 'claude-3-5-sonnet-20241022',
        generation: {
          maxTokens: 100,
        },
      }

      const request = anthropicAdapter.outbound.buildRequest(ir)

      expect(request).toHaveProperty('system', 'You are helpful')
      expect(request.messages).toHaveLength(1)
      expect(request.messages[0]?.role).toBe('user')
    })
  })

  describe('Adapter Info', () => {
    it('should return correct adapter info', () => {
      const info = anthropicAdapter.getInfo()

      expect(info.name).toBe('anthropic')
      expect(info.version).toBe('1.0.0')
      expect(info.capabilities.streaming).toBe(true)
      expect(info.capabilities.tools).toBe(true)
      expect(info.capabilities.vision).toBe(true)
    })
  })
})
