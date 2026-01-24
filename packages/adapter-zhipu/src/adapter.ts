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
 * Zhipu AI adapter implementation
 * Zhipu API is OpenAI-compatible with some Zhipu-specific features
 */
export const zhipuAdapter: LLMAdapter = {
  name: 'zhipu',
  version: '1.0.0',
  capabilities: {
    streaming: true,
    tools: true,
    vision: true, // GLM-4V supports vision
    multimodal: true,
    systemPrompt: true,
    toolChoice: true,
    reasoning: false,
    webSearch: true, // Zhipu supports web search
    jsonMode: true,
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

  getInfo(): AdapterInfo {
    return {
      name: this.name,
      version: this.version,
      capabilities: this.capabilities,
      endpoint: {
        baseUrl: 'https://open.bigmodel.cn/api/paas',
        chatPath: '/v4/chat/completions',
        modelsPath: '/v4/models',
      },
    }
  },
}
