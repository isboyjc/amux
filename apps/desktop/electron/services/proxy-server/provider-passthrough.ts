/**
 * Provider Passthrough Proxy Handler
 * 
 * Handles requests to providers configured as passthrough proxies.
 * Uses llm-bridge with Inbound = Outbound (same adapter) for minimal overhead
 * while maintaining automatic Token statistics, error handling, and streaming.
 */

import { randomUUID } from 'crypto'

import { Bridge, type Usage } from '@amux/llm-bridge'
import type { FastifyRequest, FastifyReply } from 'fastify'

import { decryptApiKey } from '../crypto'
import type { ProviderRow } from '../database/types'
import { logRequest } from '../logger'
import { recordRequest as recordMetrics } from '../metrics'

import { getAdapter } from './bridge-manager'
import { ProxyErrorCode } from './types'
import { extractApiKey, validateApiKey, createErrorResponse } from './utils'

/**
 * Handle Provider Passthrough Proxy request
 * 
 * This function:
 * 1. Validates authentication
 * 2. Creates a Bridge with Inbound = Outbound (same adapter)
 * 3. Handles both streaming and non-streaming requests
 * 4. Automatically collects Token statistics from Bridge
 * 5. Records metrics and logs
 */
export async function handleProviderPassthrough(
  request: FastifyRequest,
  reply: FastifyReply,
  provider: ProviderRow
): Promise<void> {
  // Detect request source (local vs tunnel)
  const isTunnelRequest = !!(
    request.headers['cf-ray'] || 
    request.headers['cf-connecting-ip'] ||
    request.headers['cf-visitor']
  )
  const requestSource: 'local' | 'tunnel' = isTunnelRequest ? 'tunnel' : 'local'
  const requestId = randomUUID()
  const startTime = Date.now()
  const errorFormat = provider.adapter_type === 'anthropic' ? 'anthropic' : 'openai'
  
  try {
    const body = request.body as any

    // 1. Detect internal requests (from Chat IPC - localhost + no auth header)
    const apiKey = extractApiKey(request)
    const isInternalRequest = requestSource === 'local' && !apiKey

    // 2. Determine which API key to use
    let targetApiKey: string

    if (isInternalRequest) {
      // Internal request from Chat - always use provider's configured key
      console.log(`[Passthrough] Internal request detected, using provider key`)

      if (!provider.api_key) {
        const error = createErrorResponse(
          ProxyErrorCode.MISSING_API_KEY,
          `Provider "${provider.name}" has no API key configured. Please configure the API key in Provider settings.`,
          500,
          errorFormat
        )
        return reply.status(error.statusCode).send(error.body)
      }

      const decryptedKey = decryptApiKey(provider.api_key)
      if (!decryptedKey) {
        const error = createErrorResponse(
          ProxyErrorCode.INTERNAL_ERROR,
          `Failed to decrypt API key for provider "${provider.name}".`,
          500,
          errorFormat
        )
        return reply.status(error.statusCode).send(error.body)
      }
      targetApiKey = decryptedKey
    } else {
      // External request - validate API key based on auth settings
      const keyValidation = validateApiKey(apiKey)

      if (!keyValidation.valid) {
        const error = createErrorResponse(
          keyValidation.error?.includes('required') ? ProxyErrorCode.MISSING_API_KEY : ProxyErrorCode.INVALID_API_KEY,
          keyValidation.error || 'Invalid API key',
          401,
          errorFormat
        )
        return reply.status(error.statusCode).send(error.body)
      }

      if (keyValidation.usePassThrough) {
        // User provided their own key (pass-through mode)
        targetApiKey = apiKey!
      } else {
        // Use provider's configured key
        if (!provider.api_key) {
          const error = createErrorResponse(
            ProxyErrorCode.MISSING_API_KEY,
            `Provider "${provider.name}" has no API key configured. Please configure the API key in Provider settings.`,
            500,
            errorFormat
          )
          return reply.status(error.statusCode).send(error.body)
        }

        const decryptedKey = decryptApiKey(provider.api_key)
        if (!decryptedKey) {
          const error = createErrorResponse(
            ProxyErrorCode.INTERNAL_ERROR,
            `Failed to decrypt API key for provider "${provider.name}".`,
            500,
            errorFormat
          )
          return reply.status(error.statusCode).send(error.body)
        }
        targetApiKey = decryptedKey
      }
    }
    
    // 3. Get Adapter (Inbound = Outbound)
    const adapter = getAdapter(provider.adapter_type)
    if (!adapter) {
      throw new Error(`Adapter not found: ${provider.adapter_type}`)
    }
    
    // 4. Create Bridge with hooks for token tracking
    const bridge = new Bridge({
      inbound: adapter,
      outbound: adapter,  // Same adapter = no format conversion
      config: {
        apiKey: targetApiKey,
        baseURL: provider.base_url || undefined,
        timeout: 60000,
      },
      // ⭐ Add hooks to capture token usage (unified IR format!)
      hooks: {
        onResponse: async (ir) => {
          // Token统计已经是统一格式，无需区分 Provider！
          if (ir.usage) {
            ;(bridge as any)._lastUsage = ir.usage
          }
        },
        onStreamEvent: async (event) => {
          // 流式响应中的 Token 也是统一格式
          if (event.type === 'end' && event.usage) {
            ;(bridge as any)._lastUsage = event.usage
          }
        }
      }
    })
    
    // 4. Handle request (streaming vs non-streaming)
    if (body.stream) {
      // Streaming response
      reply.raw.setHeader('Content-Type', 'text/event-stream')
      reply.raw.setHeader('Cache-Control', 'no-cache')
      reply.raw.setHeader('Connection', 'keep-alive')
      reply.raw.setHeader('X-Request-ID', requestId)
      
      let streamSuccess = true
      let streamError: string | undefined
      const streamChunks: unknown[] = []
      
      try {
        const stream = await bridge.chatStream(body)
        
        for await (const event of stream) {
          // Bridge returns SSE events in format: { event: "...", data: {...} }
          // Extract the actual data for passthrough
          const sseEvent = event as { event?: string; data?: unknown; type?: string }

          // Collect chunks for logging
          streamChunks.push(sseEvent.data || sseEvent)
          
          // Format SSE based on adapter type
          if (provider.adapter_type === 'anthropic' || provider.adapter_type === 'openai-responses') {
            // Anthropic/OpenAI Responses format: event: xxx\ndata: {...}\n\n
            const eventType = sseEvent.event || sseEvent.type || 'message'
            const eventData = sseEvent.data || sseEvent
            reply.raw.write(`event: ${eventType}\ndata: ${JSON.stringify(eventData)}\n\n`)
          } else {
            // OpenAI Chat Completions format: data: {...}\n\n
            // For OpenAI format, we need to send the actual chunk data, not the wrapper
            const chunkData = sseEvent.data || sseEvent
            reply.raw.write(`data: ${JSON.stringify(chunkData)}\n\n`)
          }
        }
        
        // Add protocol-level end marker for OpenAI Chat Completions format only
        if (provider.adapter_type !== 'anthropic' && provider.adapter_type !== 'openai-responses') {
          reply.raw.write('data: [DONE]\n\n')
        }
        
        reply.raw.end()
      } catch (error) {
        streamSuccess = false
        streamError = error instanceof Error ? error.message : 'Stream error'
        console.error(`[Passthrough] Stream error:`, error)
        
        if (provider.adapter_type === 'anthropic') {
          reply.raw.write(`event: error\ndata: ${JSON.stringify({
            type: 'error',
            error: { type: 'api_error', message: streamError }
          })}\n\n`)
        } else {
          reply.raw.write(`data: ${JSON.stringify({
            error: {
              message: streamError,
              type: 'api_error',
              code: ProxyErrorCode.INTERNAL_ERROR
            }
          })}\n\n`)
        }
        reply.raw.end()
      }
      
      const latencyMs = Date.now() - startTime
      
      // Get Token statistics from Bridge automatically
      const usage = (bridge as any)._lastUsage as Usage | undefined
      const inputTokens = usage?.promptTokens
      const outputTokens = usage?.completionTokens
      
      // Log request
      logRequest({
        proxyPath: provider.proxy_path || `provider-${provider.id}`,
        sourceModel: body.model,
        targetModel: body.model,
        statusCode: streamSuccess ? 200 : 500,
        inputTokens,
        outputTokens,
        latencyMs,
        requestBody: JSON.stringify(body),
        responseBody: streamSuccess && streamChunks.length > 0 
          ? JSON.stringify({ chunks: streamChunks, totalChunks: streamChunks.length })
          : undefined,
        error: streamError,
        source: requestSource
      })
      recordMetrics(
        `provider-${provider.id}`,
        provider.id,
        streamSuccess,
        latencyMs,
        inputTokens,
        outputTokens
      )
      
      return
    }
    
    // Non-streaming response
    try {
      const response = await bridge.chat(body)
      const latencyMs = Date.now() - startTime
      
      // Get Token statistics from Bridge automatically
      const usage = (bridge as any)._lastUsage as Usage | undefined
      const inputTokens = usage?.promptTokens
      const outputTokens = usage?.completionTokens
      
      // Log successful request
      logRequest({
        proxyPath: provider.proxy_path || `provider-${provider.id}`,
        sourceModel: body.model,
        targetModel: body.model,
        statusCode: 200,
        inputTokens,
        outputTokens,
        latencyMs,
        requestBody: JSON.stringify(body),
        responseBody: JSON.stringify(response),
        source: requestSource
      })
      recordMetrics(
        `provider-${provider.id}`,
        provider.id,
        true,
        latencyMs,
        inputTokens,
        outputTokens
      )
      
      reply.header('X-Request-ID', requestId)
      return reply.send(response)
    } catch (error) {
      const latencyMs = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Chat request failed'
      
      // Log failed request
      logRequest({
        proxyPath: provider.proxy_path || `provider-${provider.id}`,
        sourceModel: body.model,
        targetModel: body.model,
        statusCode: 502,
        inputTokens: undefined,
        outputTokens: undefined,
        latencyMs,
        requestBody: JSON.stringify(body),
        error: errorMessage,
        source: requestSource
      })
      recordMetrics(`provider-${provider.id}`, provider.id, false, latencyMs)
      
      console.error(`[Passthrough] Chat error:`, error)
      const err = createErrorResponse(
        ProxyErrorCode.ADAPTER_ERROR,
        errorMessage,
        502,
        errorFormat
      )
      return reply.status(err.statusCode).send(err.body)
    }
  } catch (error) {
    console.error(`[Passthrough] Error:`, error)
    const err = createErrorResponse(
      ProxyErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Internal server error',
      500,
      errorFormat
    )
    return reply.status(err.statusCode).send(err.body)
  }
}
