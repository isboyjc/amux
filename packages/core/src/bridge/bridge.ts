import type { LLMAdapter } from '../adapter'

import { HTTPClient } from './http-client'
import type {
  BridgeConfig,
  BridgeOptions,
  CompatibilityReport,
  LLMBridge,
} from './types'

/**
 * Bridge implementation
 */
export class Bridge implements LLMBridge {
  private inboundAdapter: LLMAdapter
  private outboundAdapter: LLMAdapter
  private config: BridgeConfig
  private httpClient: HTTPClient

  constructor(options: BridgeOptions) {
    this.inboundAdapter = options.inbound
    this.outboundAdapter = options.outbound
    this.config = options.config

    // Initialize HTTP client with config
    this.httpClient = new HTTPClient({
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        ...this.config.headers,
      },
      timeout: this.config.timeout,
    })
  }

  /**
   * Send a chat request
   */
  async chat(request: unknown): Promise<unknown> {
    // Step 1: Inbound adapter parses request → IR
    const ir = this.inboundAdapter.inbound.parseRequest(request)

    // Step 2: Validate IR (optional)
    if (this.inboundAdapter.validateRequest) {
      const validation = this.inboundAdapter.validateRequest(ir)
      if (!validation.valid) {
        throw new Error(
          `Invalid request: ${validation.errors?.join(', ') ?? 'Unknown error'}`
        )
      }
    }

    // Step 3: Outbound adapter builds provider request from IR
    const providerRequest = this.outboundAdapter.outbound.buildRequest(ir)

    // Step 4: Send HTTP request to provider API
    const baseURL =
      this.config.baseURL ?? this.getDefaultBaseURL(this.outboundAdapter.name)
    const endpoint = this.getEndpoint(this.outboundAdapter.name)

    const response = await this.httpClient.request({
      method: 'POST',
      url: `${baseURL}${endpoint}`,
      body: providerRequest,
    })

    // Step 5: Outbound adapter parses response → IR
    const responseIR = this.outboundAdapter.inbound.parseResponse?.(
      response.data
    )

    if (!responseIR) {
      throw new Error('Outbound adapter does not support response parsing')
    }

    // Step 6: Inbound adapter builds response from IR
    const finalResponse =
      this.inboundAdapter.outbound.buildResponse?.(responseIR)

    if (!finalResponse) {
      // If inbound adapter doesn't support response building, return IR
      return responseIR
    }

    return finalResponse
  }

  /**
   * Send a streaming chat request
   */
  async *chatStream(request: unknown): AsyncIterable<unknown> {
    // Step 1: Inbound adapter parses request → IR
    const ir = this.inboundAdapter.inbound.parseRequest(request)

    // Ensure streaming is enabled
    ir.stream = true

    // Step 2: Outbound adapter builds provider request from IR
    const providerRequest = this.outboundAdapter.outbound.buildRequest(ir)

    // Step 3: Send streaming HTTP request
    const baseURL =
      this.config.baseURL ?? this.getDefaultBaseURL(this.outboundAdapter.name)
    const endpoint = this.getEndpoint(this.outboundAdapter.name)

    const streamHandler = this.outboundAdapter.inbound.parseStream
    if (!streamHandler) {
      throw new Error('Outbound adapter does not support streaming')
    }

    // Step 4: Process stream chunks
    for await (const chunk of this.httpClient.requestStream({
      method: 'POST',
      url: `${baseURL}${endpoint}`,
      body: providerRequest,
    })) {
      // Parse SSE format (data: {...})
      const lines = chunk.split('\n')
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data) as unknown
            const events = streamHandler(parsed)

            if (events) {
              const eventArray = Array.isArray(events) ? events : [events]
              for (const event of eventArray) {
                // Convert IR stream event back to inbound format
                yield event // TODO: Convert back to inbound format
              }
            }
          } catch (error) {
            // Skip invalid JSON
            continue
          }
        }
      }
    }
  }

  /**
   * Check compatibility between adapters
   */
  checkCompatibility(): CompatibilityReport {
    const issues: string[] = []
    const warnings: string[] = []

    const inCap = this.inboundAdapter.capabilities
    const outCap = this.outboundAdapter.capabilities

    // Check critical capabilities
    if (inCap.tools && !outCap.tools) {
      issues.push(
        'Inbound adapter supports tools but outbound adapter does not'
      )
    }

    if (inCap.vision && !outCap.vision) {
      warnings.push(
        'Inbound adapter supports vision but outbound adapter does not'
      )
    }

    if (inCap.streaming && !outCap.streaming) {
      warnings.push(
        'Inbound adapter supports streaming but outbound adapter does not'
      )
    }

    return {
      compatible: issues.length === 0,
      issues: issues.length > 0 ? issues : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  }

  /**
   * Get adapter information
   */
  getAdapters() {
    return {
      inbound: {
        name: this.inboundAdapter.name,
        version: this.inboundAdapter.version,
      },
      outbound: {
        name: this.outboundAdapter.name,
        version: this.outboundAdapter.version,
      },
    }
  }

  /**
   * Get default base URL for a provider
   */
  private getDefaultBaseURL(provider: string): string {
    const urls: Record<string, string> = {
      openai: 'https://api.openai.com',
      anthropic: 'https://api.anthropic.com',
      deepseek: 'https://api.deepseek.com',
      kimi: 'https://api.moonshot.cn',
      qwen: 'https://dashscope.aliyuncs.com/api',
      gemini: 'https://generativelanguage.googleapis.com',
    }

    return urls[provider] ?? ''
  }

  /**
   * Get API endpoint for a provider
   */
  private getEndpoint(provider: string): string {
    const endpoints: Record<string, string> = {
      openai: '/v1/chat/completions',
      anthropic: '/v1/messages',
      deepseek: '/v1/chat/completions',
      kimi: '/v1/chat/completions',
      qwen: '/v1/services/aigc/text-generation/generation',
      gemini: '/v1beta/models/gemini-pro:generateContent',
    }

    return endpoints[provider] ?? '/v1/chat/completions'
  }
}
