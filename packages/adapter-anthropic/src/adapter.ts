import type {
  LLMAdapter,
  LLMRequestIR,
  LLMResponseIR,
  LLMStreamEvent,
  LLMErrorIR,
  AdapterInfo,
  ModelInfo,
} from '@amux.ai/llm-bridge'

import { parseRequest } from './inbound/request-parser'
import { parseResponse } from './inbound/response-parser'
import { parseStream } from './inbound/stream-parser'
import { parseError } from './inbound/error-parser'
import { buildRequest } from './outbound/request-builder'
import { buildResponse } from './outbound/response-builder'
import { createStreamBuilder } from './outbound/stream-builder'

/**
 * Anthropic adapter implementation
 * Handles Anthropic Claude API format
 */
export const anthropicAdapter: LLMAdapter = {
  name: 'anthropic',
  version: '1.0.0',
  capabilities: {
    streaming: true,
    tools: true,
    vision: true,
    multimodal: true,
    systemPrompt: true,
    toolChoice: true,
    reasoning: true, // Extended thinking
    webSearch: false,
    jsonMode: false, // Anthropic doesn't have native JSON mode
    logprobs: false,
    seed: false,
  },

  inbound: {
    parseRequest: (request: unknown): LLMRequestIR => {
      return parseRequest(request)
    },

    parseResponse: (response: unknown): LLMResponseIR => {
      return parseResponse(response)
    },

    parseStream: (chunk: unknown): LLMStreamEvent | LLMStreamEvent[] | null => {
      return parseStream(chunk)
    },

    parseError: (error: unknown): LLMErrorIR => {
      return parseError(error)
    },
  },

  outbound: {
    buildRequest: (ir: LLMRequestIR): unknown => {
      return buildRequest(ir)
    },

    buildResponse: (ir: LLMResponseIR): unknown => {
      return buildResponse(ir)
    },

    createStreamBuilder,
  },

  parseModelList(response: unknown): ModelInfo[] {
    if (!response || typeof response !== 'object') return []
    const obj = response as Record<string, unknown>
    const data = Array.isArray(obj.data) ? obj.data : []

    return data
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item) => {
        const id = String(item.id || '')
        if (!id) return null
        const info: ModelInfo = {
          id,
          name: String(item.display_name || item.name || id),
        }
        if (typeof item.created_at === 'string') {
          const ts = new Date(item.created_at).getTime()
          if (!isNaN(ts)) info.created = Math.floor(ts / 1000)
        }
        return info
      })
      .filter((m): m is ModelInfo => m !== null)
  },

  getInfo(): AdapterInfo {
    return {
      name: this.name,
      version: this.version,
      capabilities: this.capabilities,
      endpoint: {
        baseUrl: 'https://api.anthropic.com',
        chatPath: '/v1/messages',
        modelsPath: '/v1/models',
      },
    }
  },
}
