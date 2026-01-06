import type {
  LLMAdapter,
  LLMRequestIR,
  LLMResponseIR,
  LLMStreamEvent,
  LLMErrorIR,
  AdapterInfo,
} from '@llm-bridge/core'

import { parseRequest } from './inbound/request-parser'
import { parseResponse } from './inbound/response-parser'
import { parseStream } from './inbound/stream-parser'
import { parseError } from './inbound/error-parser'
import { buildRequest } from './outbound/request-builder'
import { buildResponse } from './outbound/response-builder'

/**
 * Qwen (通义千问) adapter implementation
 * Handles Qwen-specific features like enable_thinking, enable_search, and multimodal
 */
export const qwenAdapter: LLMAdapter = {
  name: 'qwen',
  version: '1.0.0',
  capabilities: {
    streaming: true,
    tools: true,
    vision: true,
    multimodal: true, // Supports images, audio, video
    systemPrompt: true,
    toolChoice: true,
    reasoning: true, // QwQ model supports reasoning
    webSearch: true, // Qwen supports web search
    jsonMode: true,
    logprobs: false,
    seed: true,
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
  },

  getInfo(): AdapterInfo {
    return {
      name: this.name,
      version: this.version,
      capabilities: this.capabilities,
      endpoint: {
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode',
        chatPath: '/v1/chat/completions',
        modelsPath: '/v1/models',
      },
    }
  },
}
