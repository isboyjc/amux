import { describe, it, expect } from 'vitest'
import { AdapterRegistry } from '../src/adapter/registry'
import type { LLMAdapter } from '../src/adapter/base'

describe('AdapterRegistry', () => {
  it('should register and retrieve adapters', () => {
    const registry = new AdapterRegistry()

    const mockAdapter: LLMAdapter = {
      name: 'test',
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
        jsonMode: false,
        logprobs: false,
        seed: false,
      },
      inbound: {
        parseRequest: () => ({ messages: [] }),
      },
      outbound: {
        buildRequest: () => ({}),
      },
      getInfo() {
        return {
          name: this.name,
          version: this.version,
          capabilities: this.capabilities,
        }
      },
    }

    registry.register(mockAdapter)

    const retrieved = registry.get('test')
    expect(retrieved).toBeDefined()
    expect(retrieved?.name).toBe('test')
  })

  it('should list all registered adapters', () => {
    const registry = new AdapterRegistry()

    const adapter1: LLMAdapter = {
      name: 'adapter1',
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
        jsonMode: false,
        logprobs: false,
        seed: false,
      },
      inbound: { parseRequest: () => ({ messages: [] }) },
      outbound: { buildRequest: () => ({}) },
      getInfo() {
        return {
          name: this.name,
          version: this.version,
          capabilities: this.capabilities,
        }
      },
    }

    const adapter2: LLMAdapter = {
      ...adapter1,
      name: 'adapter2',
    }

    registry.register(adapter1)
    registry.register(adapter2)

    const list = registry.list()
    expect(list).toHaveLength(2)
    expect(list.map((a) => a.name)).toContain('adapter1')
    expect(list.map((a) => a.name)).toContain('adapter2')
  })

  it('should throw error when registering duplicate adapter', () => {
    const registry = new AdapterRegistry()

    const adapter: LLMAdapter = {
      name: 'duplicate',
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
        jsonMode: false,
        logprobs: false,
        seed: false,
      },
      inbound: { parseRequest: () => ({ messages: [] }) },
      outbound: { buildRequest: () => ({}) },
      getInfo() {
        return {
          name: this.name,
          version: this.version,
          capabilities: this.capabilities,
        }
      },
    }

    registry.register(adapter)

    expect(() => registry.register(adapter)).toThrow(
      'Adapter "duplicate" is already registered'
    )
  })
})
