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
 * Google Gemini adapter implementation
 * Uses native Gemini API format (not OpenAI-compatible)
 */
export const googleAdapter: LLMAdapter = {
  name: 'google',
  version: '1.0.0',
  capabilities: {
    streaming: true,
    tools: true,
    vision: true,
    multimodal: true, // Supports images, audio, video, PDFs
    systemPrompt: true, // Via systemInstruction
    toolChoice: true, // Via functionCallingConfig
    reasoning: false,
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
        baseUrl: 'https://generativelanguage.googleapis.com',
        chatPath: '/v1beta/models/{model}:streamGenerateContent',  // Use streaming endpoint
        modelsPath: '/v1beta/models',
      },
    }
  },
}

// Export as geminiAdapter for backward compatibility
export const geminiAdapter = googleAdapter
