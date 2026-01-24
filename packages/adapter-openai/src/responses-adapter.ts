import type {
  LLMAdapter,
  LLMRequestIR,
  LLMResponseIR,
  LLMStreamEvent,
  LLMErrorIR,
  AdapterInfo,
} from '@amux.ai/llm-bridge'

import { parseError } from './inbound/error-parser'
import {
  parseResponsesRequest,
  parseResponsesResponse,
  parseResponsesStream,
  buildResponsesRequest,
  buildResponsesResponse,
  createResponsesStreamBuilder,
} from './responses'

/**
 * OpenAI Responses API adapter implementation
 * This adapter uses the new /v1/responses endpoint
 *
 * The Responses API is OpenAI's newer API that supports:
 * - Built-in tools (web search, code interpreter, file search)
 * - Agents and multi-turn conversations with state
 * - Enhanced streaming capabilities
 * - Reasoning models with thinking process
 * - Stateful context management via previous_response_id
 *
 * Key differences from Chat Completions API:
 * - Uses `input` instead of `messages`
 * - Uses `instructions` instead of system message
 * - Uses `max_output_tokens` instead of `max_tokens`
 * - Different response structure with `output` array
 * - Different streaming event format
 * - Uses `text.format` for JSON mode instead of `response_format`
 * - Supports `previous_response_id` for multi-turn state management
 */
export const openaiResponsesAdapter: LLMAdapter = {
  name: 'openai-responses',
  version: '1.0.0',
  capabilities: {
    streaming: true,
    tools: true,
    vision: true,
    multimodal: true,
    systemPrompt: true,
    toolChoice: true,
    reasoning: true, // Responses API supports reasoning models (o3, o4-mini)
    webSearch: true, // Built-in web search tool
    jsonMode: true, // Supported via text.format
    logprobs: false, // Not supported in Responses API
    seed: false, // Not supported in Responses API
  },

  inbound: {
    parseRequest: (request: unknown): LLMRequestIR => {
      return parseResponsesRequest(request)
    },

    parseResponse: (response: unknown): LLMResponseIR => {
      return parseResponsesResponse(response)
    },

    parseStream: (chunk: unknown): LLMStreamEvent | LLMStreamEvent[] | null => {
      return parseResponsesStream(chunk)
    },

    parseError: (error: unknown): LLMErrorIR => {
      return parseError(error)
    },
  },

  outbound: {
    buildRequest: (ir: LLMRequestIR): unknown => {
      return buildResponsesRequest(ir)
    },

    buildResponse: (ir: LLMResponseIR): unknown => {
      return buildResponsesResponse(ir)
    },

    createStreamBuilder: createResponsesStreamBuilder,
  },

  getInfo(): AdapterInfo {
    return {
      name: this.name,
      version: this.version,
      capabilities: this.capabilities,
      endpoint: {
        baseUrl: 'https://api.openai.com',
        chatPath: '/v1/responses',
        modelsPath: '/v1/models',
      },
    }
  },
}
