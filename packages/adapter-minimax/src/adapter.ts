import type {
  LLMAdapter,
  LLMRequestIR,
  LLMResponseIR,
  LLMStreamEvent,
  LLMErrorIR,
  AdapterInfo,
} from '@amux.ai/llm-bridge'

import { parseError } from './inbound/error-parser'
import { parseRequest } from './inbound/request-parser'
import { parseResponse } from './inbound/response-parser'
import { parseStream } from './inbound/stream-parser'
import { buildRequest } from './outbound/request-builder'
import { buildResponse } from './outbound/response-builder'
import { createStreamBuilder } from './outbound/stream-builder'

/**
 * MiniMax adapter implementation
 * Handles MiniMax-specific features like Interleaved Thinking and reasoning_details
 */
export const minimaxAdapter: LLMAdapter = {
  name: 'minimax',
  version: '1.0.0',
  capabilities: {
    streaming: true,
    tools: true,
    vision: false, // MiniMax M2.1 currently doesn't support vision in text models
    multimodal: false,
    systemPrompt: true,
    toolChoice: true,
    reasoning: true, // MiniMax M2.1 supports Interleaved Thinking
    webSearch: false,
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
        baseUrl: 'https://api.minimaxi.com/v1',
        chatPath: '/chat/completions',
        // MiniMax does not provide a models list endpoint
      },
    }
  },
}
