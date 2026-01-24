import type {
  LLMAdapter,
  LLMRequestIR,
  LLMResponseIR,
  LLMStreamEvent,
  LLMErrorIR,
  AdapterInfo,
} from '@amux.ai/llm-bridge'

import { parseRequest } from './inbound/request-parser'
import { parseResponse } from './inbound/response-parser'
import { parseStream } from './inbound/stream-parser'
import { parseError } from './inbound/error-parser'
import { buildRequest } from './outbound/request-builder'
import { buildResponse } from './outbound/response-builder'
import { createStreamBuilder } from './outbound/stream-builder'

/**
 * DeepSeek adapter implementation
 * Handles DeepSeek-specific features like reasoning_content and cache tokens
 */
export const deepseekAdapter: LLMAdapter = {
  name: 'deepseek',
  version: '1.0.0',
  capabilities: {
    streaming: true,
    tools: true,
    vision: false,
    multimodal: false,
    systemPrompt: true,
    toolChoice: true,
    reasoning: true, // DeepSeek-reasoner supports reasoning
    webSearch: false,
    jsonMode: true,
    logprobs: true,
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

  getInfo(): AdapterInfo {
    return {
      name: this.name,
      version: this.version,
      capabilities: this.capabilities,
      endpoint: {
        baseUrl: 'https://api.deepseek.com',
        chatPath: '/v1/chat/completions',
        modelsPath: '/v1/models',
      },
    }
  },
}
