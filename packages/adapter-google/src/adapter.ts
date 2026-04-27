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

  parseModelList(response: unknown): ModelInfo[] {
    if (!response || typeof response !== 'object') return []
    const obj = response as Record<string, unknown>
    const models = Array.isArray(obj.models) ? obj.models : []

    return models
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item) => {
        // Google format: { name: "models/gemini-2.0-flash", displayName: "Gemini 2.0 Flash", ... }
        const fullName = String(item.name || '')
        const id = fullName.startsWith('models/') ? fullName.slice(7) : fullName
        if (!id) return null

        const info: ModelInfo = {
          id,
          name: String(item.displayName || item.display_name || id),
        }

        // inputTokenLimit represents context length
        if (typeof item.inputTokenLimit === 'number') {
          info.contextLength = item.inputTokenLimit
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
        baseUrl: 'https://generativelanguage.googleapis.com',
        chatPath: '/v1beta/models/{model}:streamGenerateContent',  // Use streaming endpoint
        modelsPath: '/v1beta/models',
      },
    }
  },
}

// Export as geminiAdapter for backward compatibility
export const geminiAdapter = googleAdapter
