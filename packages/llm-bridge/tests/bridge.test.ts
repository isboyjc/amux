import { describe, expect, it, vi } from 'vitest'

import type { LLMAdapter } from '../src/adapter/base'
import { createBridge } from '../src/bridge/factory'

describe('Bridge', () => {
  const mockInboundAdapter: LLMAdapter = {
    name: 'mock-inbound',
    version: '1.0.0',
    capabilities: {
      streaming: true,
      tools: true,
      vision: false,
      multimodal: false,
      systemPrompt: true,
      toolChoice: true,
      reasoning: false,
      webSearch: false,
      jsonMode: true,
      logprobs: true,
      seed: true,
    },
    inbound: {
      parseRequest: vi.fn((req) => ({
        messages: [{ role: 'user', content: 'test' }],
        raw: req,
      })),
      parseResponse: vi.fn((res) => ({
        id: 'test-id',
        model: 'test-model',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'response' },
            finishReason: 'stop',
          },
        ],
        raw: res,
      })),
    },
    outbound: {
      buildRequest: vi.fn((ir) => ({ messages: ir.messages })),
      buildResponse: vi.fn((ir) => ({ response: ir })),
    },
    getInfo() {
      return {
        name: this.name,
        version: this.version,
        capabilities: this.capabilities,
        endpoint: {
          baseUrl: 'https://api.mock.com',
          chatPath: '/v1/chat/completions',
        },
      }
    },
  }

  const mockOutboundAdapter: LLMAdapter = {
    ...mockInboundAdapter,
    name: 'mock-outbound',
  }

  describe('createBridge', () => {
    it('should create a bridge instance', () => {
      const bridge = createBridge({
        inbound: mockInboundAdapter,
        outbound: mockOutboundAdapter,
        config: {
          apiKey: 'test-key',
        },
      })

      expect(bridge).toBeDefined()
      expect(bridge.chat).toBeDefined()
      expect(bridge.chatStream).toBeDefined()
      expect(bridge.checkCompatibility).toBeDefined()
    })

    it('should return adapter info', () => {
      const bridge = createBridge({
        inbound: mockInboundAdapter,
        outbound: mockOutboundAdapter,
        config: {
          apiKey: 'test-key',
        },
      })

      const adapters = bridge.getAdapters()

      expect(adapters.inbound.name).toBe('mock-inbound')
      expect(adapters.outbound.name).toBe('mock-outbound')
    })

    it('should check compatibility', () => {
      const bridge = createBridge({
        inbound: mockInboundAdapter,
        outbound: mockOutboundAdapter,
        config: {
          apiKey: 'test-key',
        },
      })

      const compat = bridge.checkCompatibility()

      expect(compat.compatible).toBe(true)
      expect(compat.issues).toBeUndefined()
    })

    it('should detect incompatibility', () => {
      const incompatibleAdapter: LLMAdapter = {
        ...mockOutboundAdapter,
        capabilities: {
          ...mockOutboundAdapter.capabilities,
          tools: false,
        },
      }

      const bridge = createBridge({
        inbound: mockInboundAdapter,
        outbound: incompatibleAdapter,
        config: {
          apiKey: 'test-key',
        },
      })

      const compat = bridge.checkCompatibility()

      expect(compat.compatible).toBe(false)
      expect(compat.issues).toBeDefined()
      expect(compat.issues?.[0]).toContain('tools')
    })
  })

  describe('Hooks', () => {
    it('should call onResponse hook when response is received', async () => {
      const onResponseMock = vi.fn()
      
      const bridge = createBridge({
        inbound: mockInboundAdapter,
        outbound: mockOutboundAdapter,
        config: {
          apiKey: 'test-key',
        },
        hooks: {
          onResponse: onResponseMock,
        },
      })

      // Mock HTTP response
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockHttpClient = (bridge as any).httpClient
      mockHttpClient.request = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { test: 'response' },
      })

      await bridge.chat({ test: 'request' })

      expect(onResponseMock).toHaveBeenCalledTimes(1)
      expect(onResponseMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-id',
          model: 'test-model',
          choices: expect.any(Array),
        })
      )
    })

    it('should call onRequest hook before sending request', async () => {
      const onRequestMock = vi.fn()
      
      const bridge = createBridge({
        inbound: mockInboundAdapter,
        outbound: mockOutboundAdapter,
        config: {
          apiKey: 'test-key',
        },
        hooks: {
          onRequest: onRequestMock,
        },
      })

      // Mock HTTP response
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockHttpClient = (bridge as any).httpClient
      mockHttpClient.request = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { test: 'response' },
      })

      await bridge.chat({ test: 'request' })

      expect(onRequestMock).toHaveBeenCalledTimes(1)
      expect(onRequestMock).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.any(Array),
        })
      )
    })

    it('should call onError hook when error occurs', async () => {
      const onErrorMock = vi.fn()
      
      const bridge = createBridge({
        inbound: mockInboundAdapter,
        outbound: mockOutboundAdapter,
        config: {
          apiKey: 'test-key',
        },
        hooks: {
          onError: onErrorMock,
        },
      })

      // Mock HTTP error
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockHttpClient = (bridge as any).httpClient
      mockHttpClient.request = vi.fn().mockRejectedValue(new Error('Test error'))

      await expect(bridge.chat({ test: 'request' })).rejects.toThrow('Test error')

      expect(onErrorMock).toHaveBeenCalledTimes(1)
      expect(onErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test error',
          type: 'unknown',
        })
      )
    })

    it('should extract token usage in onResponse hook', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let extractedUsage: any = null
      
      const mockAdapterWithUsage: LLMAdapter = {
        ...mockInboundAdapter,
        inbound: {
          ...mockInboundAdapter.inbound,
          parseResponse: vi.fn(() => ({
            id: 'test-id',
            model: 'test-model',
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: 'response' },
                finishReason: 'stop',
              },
            ],
            usage: {
              promptTokens: 10,
              completionTokens: 20,
              totalTokens: 30,
            },
          })),
        },
      }
      
      const bridge = createBridge({
        inbound: mockAdapterWithUsage,
        outbound: mockAdapterWithUsage,
        config: {
          apiKey: 'test-key',
        },
        hooks: {
          onResponse: async (ir) => {
            extractedUsage = ir.usage
          },
        },
      })

      // Mock HTTP response
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockHttpClient = (bridge as any).httpClient
      mockHttpClient.request = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { test: 'response' },
      })

      await bridge.chat({ test: 'request' })

      expect(extractedUsage).toEqual({
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      })
    })
  })
})
