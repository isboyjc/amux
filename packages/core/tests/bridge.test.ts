import { describe, it, expect, vi } from 'vitest'
import { createBridge } from '../src/bridge/factory'
import type { LLMAdapter } from '../src/adapter/base'

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
})
