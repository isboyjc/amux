import type { LLMAdapter } from '../adapter'
import type { LLMRequestIR } from '../ir/request'
import type { LLMResponseIR } from '../ir/response'
import type { LLMStreamEvent, SSEEvent } from '../ir/stream'
import type { Message, ContentPart } from '../types/message'

import { HTTPClient } from './http-client'
import { SSELineParser } from '../utils/sse-parser'
import type {
  BridgeConfig,
  BridgeHooks,
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

  // Lifecycle hooks
  private hooks?: BridgeHooks

  // Model mapping configuration
  private targetModel?: string
  private modelMapper?: (model: string) => string
  private modelMapping?: { [key: string]: string }

  constructor(options: BridgeOptions) {
    this.inboundAdapter = options.inbound
    this.outboundAdapter = options.outbound
    this.config = options.config
    this.hooks = options.hooks

    // Save model mapping configuration
    this.targetModel = options.targetModel
    this.modelMapper = options.modelMapper
    this.modelMapping = options.modelMapping

    // Build authentication header
    const authHeaderName = this.config.authHeaderName ?? 'Authorization'
    const authHeaderPrefix = this.config.authHeaderPrefix ?? 'Bearer'
    const authHeaderValue = authHeaderPrefix
      ? `${authHeaderPrefix} ${this.config.apiKey}`
      : this.config.apiKey

    // Initialize HTTP client with config
    this.httpClient = new HTTPClient({
      headers: {
        [authHeaderName]: authHeaderValue,
        ...this.config.headers,
      },
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
      provider: this.outboundAdapter.name,
    })
  }

  /**
   * Map model name from inbound to outbound
   * Priority: targetModel > modelMapper > modelMapping > original model
   */
  private mapModel(inboundModel?: string): string | undefined {
    // If no inbound model, return undefined
    if (!inboundModel) return undefined

    // 1. If targetModel is configured, use it directly (highest priority)
    if (this.targetModel) {
      return this.targetModel
    }

    // 2. If modelMapper function is configured, use it (second priority)
    if (this.modelMapper) {
      return this.modelMapper(inboundModel)
    }

    // 3. If modelMapping object is configured, look up the mapping (third priority)
    if (this.modelMapping && this.modelMapping[inboundModel]) {
      return this.modelMapping[inboundModel]
    }

    // 4. No mapping configured, return original model
    return inboundModel
  }

  /**
   * Validate that the IR request features are supported by outbound adapter
   * @private
   */
  private validateCapabilities(ir: LLMRequestIR): void {
    const cap = this.outboundAdapter.capabilities

    // Check tools capability
    if (ir.tools && ir.tools.length > 0 && !cap.tools) {
      throw new Error(
        `Outbound adapter '${this.outboundAdapter.name}' does not support tools`
      )
    }

    // Check vision capability (check for image content in messages)
    if (!cap.vision) {
      const hasVisionContent = ir.messages.some((msg: Message) => {
        if (typeof msg.content === 'string') return false
        return msg.content.some((part: ContentPart) => part.type === 'image')
      })
      if (hasVisionContent) {
        throw new Error(
          `Outbound adapter '${this.outboundAdapter.name}' does not support vision`
        )
      }
    }

    // Check reasoning capability
    if (ir.generation?.thinking && !cap.reasoning) {
      throw new Error(
        `Outbound adapter '${this.outboundAdapter.name}' does not support reasoning/thinking`
      )
    }
  }

  /**
   * Send a chat request
   */
  async chat(request: unknown): Promise<unknown> {
    try {
      // Step 1: Inbound adapter parses request → IR
      const ir = this.inboundAdapter.inbound.parseRequest(request)

      // Step 2: Map model if configured
      if (ir.model) {
        ir.model = this.mapModel(ir.model)
      }

      // Step 3: Trigger onRequest hook
      if (this.hooks?.onRequest) {
        await this.hooks.onRequest(ir)
      }

      // Step 4: Validate IR (optional)
      if (this.inboundAdapter.validateRequest) {
        const validation = this.inboundAdapter.validateRequest(ir)
        if (!validation.valid) {
          throw new Error(
            `Invalid request: ${validation.errors?.join(', ') ?? 'Unknown error'}`
          )
        }
      }

      // Step 4.5: Validate capabilities match
      this.validateCapabilities(ir)

      // Step 5: Outbound adapter builds provider request from IR
      const providerRequest = this.outboundAdapter.outbound.buildRequest(ir)

      // Step 6: Send HTTP request to provider API
      const baseURL = this.config.baseURL ?? this.getDefaultBaseURL()
      const endpoint = this.getEndpoint()

      const response = await this.httpClient.request({
        method: 'POST',
        url: `${baseURL}${endpoint}`,
        body: providerRequest,
      })

      // Step 7: Outbound adapter parses response → IR
      const responseIR = this.outboundAdapter.inbound.parseResponse?.(
        response.data
      )

      if (!responseIR) {
        throw new Error('Outbound adapter does not support response parsing')
      }

      // Step 8: Trigger onResponse hook (before building final response)
      if (this.hooks?.onResponse) {
        await this.hooks.onResponse(responseIR)
      }

      // Step 9: Inbound adapter builds response from IR
      const finalResponse =
        this.inboundAdapter.outbound.buildResponse?.(responseIR)

      if (!finalResponse) {
        // If inbound adapter doesn't support response building, return IR
        return responseIR
      }

      return finalResponse
    } catch (error) {
      // Trigger onError hook (ensure hook errors don't mask the original error)
      if (this.hooks?.onError && error instanceof Error) {
        try {
          const errorIR = this.outboundAdapter.inbound.parseError?.(error) ?? {
            message: error.message,
            code: 'UNKNOWN_ERROR',
            type: 'unknown' as const,
          }
          await this.hooks.onError(errorIR)
        } catch (hookError) {
          // Log hook error but don't let it mask the original error
          console.warn('Error in onError hook:', hookError)
        }
      }
      throw error
    }
  }

  /**
   * Send a chat request (raw IR response)
   * Returns raw IR response for custom processing
   */
  async chatRaw(request: unknown): Promise<LLMResponseIR> {
    // Step 1: Inbound adapter parses request → IR
    const ir = this.inboundAdapter.inbound.parseRequest(request)

    // Step 2: Map model if configured
    if (ir.model) {
      ir.model = this.mapModel(ir.model)
    }

    // Step 3: Validate IR (optional)
    if (this.inboundAdapter.validateRequest) {
      const validation = this.inboundAdapter.validateRequest(ir)
      if (!validation.valid) {
        throw new Error(
          `Invalid request: ${validation.errors?.join(', ') ?? 'Unknown error'}`
        )
      }
    }

    // Step 4: Outbound adapter builds provider request from IR
    const providerRequest = this.outboundAdapter.outbound.buildRequest(ir)

    // Step 5: Send HTTP request to provider API
    const baseURL = this.config.baseURL ?? this.getDefaultBaseURL()
    const endpoint = this.getEndpoint()

    const response = await this.httpClient.request({
      method: 'POST',
      url: `${baseURL}${endpoint}`,
      body: providerRequest,
    })

    // Step 6: Outbound adapter parses response → IR
    const responseIR = this.outboundAdapter.inbound.parseResponse?.(
      response.data
    )

    if (!responseIR) {
      throw new Error('Outbound adapter does not support response parsing')
    }

    return responseIR
  }

  /**
   * Send a streaming chat request
   * Returns SSE events in inbound adapter's format
   */
  async *chatStream(request: unknown): AsyncIterable<SSEEvent> {
    // Get stream builder from inbound adapter
    const streamBuilder = this.inboundAdapter.outbound.createStreamBuilder?.()

    if (!streamBuilder) {
      // Fallback: wrap raw events in simple SSE format
      for await (const event of this.chatStreamRaw(request)) {
        yield { event: 'data', data: event }
      }
      return
    }

    // Process raw events through the stream builder
    for await (const event of this.chatStreamRaw(request)) {
      const sseEvents = streamBuilder.process(event)
      for (const sse of sseEvents) {
        yield sse
      }
    }

    // Emit any final events (filter out protocol-level markers like [DONE])
    if (streamBuilder.finalize) {
      const finalEvents = streamBuilder.finalize()
      for (const sse of finalEvents) {
        // Skip protocol-level markers that are not valid JSON data
        // These should be handled by the user's HTTP layer
        if (sse.data === '[DONE]') {
          continue
        }
        yield sse
      }
    }
  }

  /**
   * Send a streaming chat request (raw IR events)
   * Returns raw IR stream events for custom processing
   */
  async *chatStreamRaw(request: unknown): AsyncIterable<LLMStreamEvent> {
    try {
      // Step 1: Inbound adapter parses request → IR
      const ir = this.inboundAdapter.inbound.parseRequest(request)

      // Step 2: Map model if configured
      if (ir.model) {
        ir.model = this.mapModel(ir.model)
      }

      // Ensure streaming is enabled
      ir.stream = true

      // Step 3: Trigger onRequest hook
      if (this.hooks?.onRequest) {
        await this.hooks.onRequest(ir)
      }

      // Step 3.5: Validate streaming capability
      if (!this.outboundAdapter.capabilities.streaming) {
        throw new Error(
          `Outbound adapter '${this.outboundAdapter.name}' does not support streaming`
        )
      }

      // Step 3.6: Validate capabilities match
      this.validateCapabilities(ir)

      // Step 4: Outbound adapter builds provider request from IR
      const providerRequest = this.outboundAdapter.outbound.buildRequest(ir)

      // Step 5: Send streaming HTTP request
      const baseURL = this.config.baseURL ?? this.getDefaultBaseURL()
      const endpoint = this.getEndpoint()

      const streamHandler = this.outboundAdapter.inbound.parseStream
      if (!streamHandler) {
        throw new Error('Outbound adapter does not support streaming')
      }

      // SSE line parser for efficient line extraction
      const sseParser = new SSELineParser()

      // Step 6: Process stream chunks
      for await (const chunk of this.httpClient.requestStream({
        method: 'POST',
        url: `${baseURL}${endpoint}`,
        body: providerRequest,
      })) {
        // Extract complete lines from chunk
        const lines = sseParser.processChunk(chunk)

        // Process complete lines
        for await (const event of this.processSSELines(lines, streamHandler)) {
          yield event
        }
      }

      // Process any remaining buffered data
      if (sseParser.hasRemaining()) {
        const lines = sseParser.flush()
        for await (const event of this.processSSELines(lines, streamHandler)) {
          yield event
        }
      }
    } catch (error) {
      // Trigger onError hook (ensure hook errors don't mask the original error)
      if (this.hooks?.onError && error instanceof Error) {
        try {
          const errorIR = this.outboundAdapter.inbound.parseError?.(error) ?? {
            message: error.message,
            code: 'UNKNOWN_ERROR',
            type: 'unknown' as const,
          }
          await this.hooks.onError(errorIR)
        } catch (hookError) {
          // Log hook error but don't let it mask the original error
          console.warn('Error in onError hook:', hookError)
        }
      }
      throw error
    }
  }

  /**
   * Process SSE lines and yield stream events
   * @private
   */
  private async *processSSELines(
    lines: string[],
    streamHandler: (chunk: unknown) => LLMStreamEvent | LLMStreamEvent[] | null
  ): AsyncIterable<LLMStreamEvent> {
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
              // Trigger onStreamEvent hook
              if (this.hooks?.onStreamEvent) {
                await this.hooks.onStreamEvent(event)
              }
              yield event
            }
          }
        } catch {
          // Skip invalid JSON
          continue
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

    // Check reasoning capability
    if (inCap.reasoning && !outCap.reasoning) {
      warnings.push(
        'Inbound adapter supports reasoning but outbound adapter does not - reasoning content may be lost'
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
   * Get default base URL from outbound adapter
   */
  private getDefaultBaseURL(): string {
    const endpoint = this.outboundAdapter.getInfo().endpoint
    return endpoint?.baseUrl ?? ''
  }

  /**
   * Get API endpoint from outbound adapter
   */
  private getEndpoint(): string {
    const endpoint = this.outboundAdapter.getInfo().endpoint
    return endpoint?.chatPath ?? '/v1/chat/completions'
  }
}
