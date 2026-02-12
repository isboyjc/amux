/**
 * Code Switch Handler
 * 
 * Handles proxy requests for Claude Code and Codex CLI tools.
 * This handler provides dynamic provider switching without requiring CLI restart.
 * 
 * Architecture:
 * - CLI always points to fixed proxy URL (http://127.0.0.1:9527/code/{cliType})
 * - Handler reads current provider config from cache/database
 * - Uses Anthropic inbound adapter + dynamic outbound adapter based on config
 * - Model mapping is applied to translate Claude model names to provider models
 */

import { randomUUID } from 'crypto'

import { Bridge } from '@amux.ai/llm-bridge'
import type { FastifyRequest, FastifyReply } from 'fastify'

import { decryptApiKey } from '../crypto'
import { getProviderRepository } from '../database/repositories'
import { logRequest } from '../logger'
import { recordRequest as recordMetrics } from '../metrics'
import { getCodeSwitchCache } from '../code-switch'

import { getAdapter, setBridgeUsage, getBridgeUsage } from './bridge-manager'
import { ProxyErrorCode } from './types'
import { createErrorResponse } from './utils'

// Type definitions
interface ChatRequestBody {
  model?: string
  stream?: boolean
  [key: string]: unknown
}

/**
 * Handle Code Switch proxy request
 * 
 * Flow:
 * 1. Get Code Switch config from cache
 * 2. Validate config and provider
 * 3. Apply model mapping if configured
 * 4. Create bridge with Anthropic inbound + provider outbound
 * 5. Handle streaming/non-streaming
 * 6. Log and record metrics
 */
export async function handleCodeSwitch(
  request: FastifyRequest,
  reply: FastifyReply,
  cliType: 'claudecode' | 'codex'
): Promise<void> {
  const requestId = randomUUID()
  const startTime = Date.now()
  const requestSource = 'local' // Code Switch is always local
  
  console.log(`\n[CodeSwitch] 📨 Incoming ${cliType} request`)
  console.log(`[CodeSwitch]   - Request ID: ${requestId}`)
  console.log(`[CodeSwitch]   - URL: ${request.url}`)
  console.log(`[CodeSwitch]   - Method: ${request.method}`)

  try {
    // Step 1: Get Code Switch config from cache
    const cache = getCodeSwitchCache()
    const cachedConfig = cache.getConfig(cliType)

    if (!cachedConfig) {
      console.error(`[CodeSwitch] ❌ No active config for ${cliType}`)
      const errorResponse = createErrorResponse(
        ProxyErrorCode.CONFIGURATION_ERROR,
        `Code Switch not configured for ${cliType}`,
        503,
        'anthropic'
      )
      reply.status(errorResponse.statusCode).send(errorResponse.body)
      return
    }

    const { config, modelMappings } = cachedConfig
    console.log(`[CodeSwitch]   - Config ID: ${config.id}`)
    console.log(`[CodeSwitch]   - Provider ID: ${config.provider_id}`)
    console.log(`[CodeSwitch]   - Model mappings: ${modelMappings.size}`)
    console.log('[CS-DIAG][Main][Runtime] active route snapshot', {
      cliType,
      configId: config.id,
      providerId: config.provider_id,
      enabled: config.enabled,
      mappingsCount: modelMappings.size,
      mappingsPreview: Array.from(modelMappings.entries()).slice(0, 3)
    })

    // Step 2: Get provider configuration
    const providerRepo = getProviderRepository()
    const provider = providerRepo.findById(config.provider_id)

    if (!provider) {
      console.error(`[CodeSwitch] ❌ Provider not found: ${config.provider_id}`)
      const errorResponse = createErrorResponse(
        ProxyErrorCode.PROVIDER_NOT_FOUND,
        'Configured provider not found',
        503,
        'anthropic'
      )
      reply.status(errorResponse.statusCode).send(errorResponse.body)
      return
    }

    if (!provider.enabled) {
      console.error(`[CodeSwitch] ❌ Provider disabled: ${provider.name}`)
      const errorResponse = createErrorResponse(
        ProxyErrorCode.PROVIDER_DISABLED,
        'Configured provider is disabled',
        503,
        'anthropic'
      )
      reply.status(errorResponse.statusCode).send(errorResponse.body)
      return
    }

    console.log(`[CodeSwitch]   - Provider: ${provider.name}`)
    console.log(`[CodeSwitch]   - Adapter: ${provider.adapter_type}`)

    // Step 3: Get provider API key
    if (!provider.api_key) {
      console.error(`[CodeSwitch] ❌ Provider API key missing`)
      const errorResponse = createErrorResponse(
        ProxyErrorCode.PROVIDER_ERROR,
        'Provider API key not configured',
        503,
        'anthropic'
      )
      reply.status(errorResponse.statusCode).send(errorResponse.body)
      return
    }

    const apiKey = decryptApiKey(provider.api_key)
    if (!apiKey) {
      console.error(`[CodeSwitch] ❌ Failed to decrypt API key`)
      const errorResponse = createErrorResponse(
        ProxyErrorCode.PROVIDER_ERROR,
        'Failed to decrypt provider API key',
        503,
        'anthropic'
      )
      reply.status(errorResponse.statusCode).send(errorResponse.body)
      return
    }

    // Step 4: Parse request body
    const body = request.body as ChatRequestBody
    const requestModel = body.model || 'claude-sonnet-4-5-20250929'
    const isStreaming = body.stream === true

    console.log(`[CodeSwitch]   - Request model: ${requestModel}`)
    console.log(`[CodeSwitch]   - Streaming: ${isStreaming}`)

    // Step 5: Apply model mapping
    let targetModel = requestModel
    if (modelMappings.has(requestModel)) {
      targetModel = modelMappings.get(requestModel)!
      console.log(`[CodeSwitch]   - Model mapped: ${requestModel} -> ${targetModel}`)
      console.log('[CS-DIAG][Main][Runtime] mapping-hit', {
        cliType,
        requestModel,
        targetModel
      })
    } else {
      console.log(`[CodeSwitch]   - No mapping, using original model: ${requestModel}`)
      console.log('[CS-DIAG][Main][Runtime] mapping-miss', {
        cliType,
        requestModel,
        availableMappings: Array.from(modelMappings.keys()).slice(0, 10)
      })
    }

    // Update request body with mapped model
    const mappedBody = {
      ...body,
      model: targetModel
    }

    // Step 6: Create bridge
    const inboundAdapter = getAdapter('anthropic')
    const outboundAdapter = getAdapter(provider.adapter_type)

    if (!inboundAdapter || !outboundAdapter) {
      console.error(`[CodeSwitch] ❌ Failed to get adapters`)
      const errorResponse = createErrorResponse(
        ProxyErrorCode.ADAPTER_ERROR,
        'Failed to initialize adapters',
        503,
        'anthropic'
      )
      reply.status(errorResponse.statusCode).send(errorResponse.body)
      return
    }

    // Build bridge config
    const bridgeConfig = {
      apiKey,
      baseURL: provider.base_url || undefined,
      chatPath: provider.chat_path || undefined,
      timeout: 60000
    }

    const bridge = new Bridge({
      inbound: inboundAdapter,
      outbound: outboundAdapter,
      config: bridgeConfig,
      // Hooks to capture token usage
      hooks: {
        onResponse: async (ir) => {
          if (ir.usage) {
            setBridgeUsage(bridge, ir.usage)
          }
        },
        onStreamEvent: async (event) => {
          if (event.type === 'end' && event.usage) {
            setBridgeUsage(bridge, event.usage)
          }
        }
      }
    })

    console.log(`[CodeSwitch]   - Bridge created: anthropic -> ${provider.adapter_type}`)

    // Step 7: Handle request (streaming or non-streaming)
    if (isStreaming) {
      console.log(`[CodeSwitch] 🌊 Starting streaming request`)

      // Set SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        'X-Request-ID': requestId
      })

      let streamError: string | undefined

      try {
        const stream = await bridge.chatStream(mappedBody)

        for await (const event of stream) {
          // event is SSEEvent with {event, data} structure
          const sseEvent = event as { event?: string; data?: unknown; type?: string }
          
          // Anthropic format: event: xxx\ndata: {...}\n\n
          const eventType = sseEvent.event || sseEvent.type || 'message'
          const eventData = sseEvent.data || sseEvent
          reply.raw.write(`event: ${eventType}\ndata: ${JSON.stringify(eventData)}\n\n`)
        }

        reply.raw.end()
        console.log(`[CodeSwitch] ✅ Streaming completed`)

        // Get usage from bridge
        const usage = getBridgeUsage(bridge)
        const duration = Date.now() - startTime

        console.log(`[CodeSwitch]   - Duration: ${duration}ms`)
        console.log(`[CodeSwitch]   - Tokens: ${JSON.stringify(usage)}`)

        // Log request
        logRequest({
          proxyId: undefined,
          proxyPath: `code/${cliType}`,
          sourceModel: requestModel,
          targetModel,
          statusCode: 200,
          inputTokens: usage?.promptTokens || 0,
          outputTokens: usage?.completionTokens || 0,
          latencyMs: duration,
          source: requestSource
        })

        // Record metrics
        recordMetrics(
          `code-${cliType}`,
          provider.id,
          true,
          duration,
          usage?.promptTokens,
          usage?.completionTokens
        )
      } catch (error) {
        streamError = error instanceof Error ? error.message : 'Streaming error'
        console.error(`[CodeSwitch] ❌ Streaming error:`, error)

        if (!reply.raw.headersSent) {
          reply.raw.writeHead(500, { 'Content-Type': 'text/event-stream' })
        }

        const errorResponse = createErrorResponse(
          ProxyErrorCode.BRIDGE_ERROR,
          streamError,
          500,
          'anthropic'
        )

        reply.raw.write(`event: error\ndata: ${JSON.stringify(errorResponse.body)}\n\n`)
        reply.raw.end()

        // Log error
        logRequest({
          proxyId: undefined,
          proxyPath: `code/${cliType}`,
          sourceModel: requestModel,
          targetModel,
          statusCode: 500,
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: Date.now() - startTime,
          error: streamError,
          source: requestSource
        })

        recordMetrics(`code-${cliType}`, provider.id, false, Date.now() - startTime, 0, 0)
      }
    } else {
      // Non-streaming request
      console.log(`[CodeSwitch] 📤 Starting non-streaming request`)

      try {
        const response = await bridge.chat(mappedBody)
        const usage = getBridgeUsage(bridge)
        const duration = Date.now() - startTime

        console.log(`[CodeSwitch] ✅ Request completed`)
        console.log(`[CodeSwitch]   - Duration: ${duration}ms`)
        console.log(`[CodeSwitch]   - Tokens: ${JSON.stringify(usage)}`)

        reply.status(200).send(response)

        // Log request
        logRequest({
          proxyId: undefined,
          proxyPath: `code/${cliType}`,
          sourceModel: requestModel,
          targetModel,
          statusCode: 200,
          inputTokens: usage?.promptTokens || 0,
          outputTokens: usage?.completionTokens || 0,
          latencyMs: duration,
          source: requestSource
        })

        // Record metrics
        recordMetrics(
          `code-${cliType}`,
          provider.id,
          true,
          duration,
          usage?.promptTokens,
          usage?.completionTokens
        )
      } catch (error) {
        console.error(`[CodeSwitch] ❌ Request error:`, error)

        const bridgeError = error as { status?: number; data?: unknown; message?: string }
        const status = bridgeError.status || 500
        const errorData = bridgeError.data || {
          type: 'error',
          error: {
            type: 'api_error',
            message: bridgeError.message || 'Unknown error'
          }
        }

        reply.status(status).send(errorData)

        // Log error
        logRequest({
          proxyId: undefined,
          proxyPath: `code/${cliType}`,
          sourceModel: requestModel,
          targetModel,
          statusCode: status,
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: Date.now() - startTime,
          error: bridgeError.message || 'Request error',
          source: requestSource
        })

        recordMetrics(`code-${cliType}`, provider.id, false, Date.now() - startTime, 0, 0)
      }
    }
  } catch (error) {
    console.error(`[CodeSwitch] ❌ Fatal error:`, error)

    const errorResponse = createErrorResponse(
      ProxyErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Internal server error',
      500,
      'anthropic'
    )
    reply.status(errorResponse.statusCode).send(errorResponse.body)

    // Log error
    logRequest({
      proxyId: undefined,
      proxyPath: `code/${cliType}`,
      sourceModel: 'unknown',
      targetModel: 'unknown',
      statusCode: 500,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Fatal error',
      source: requestSource
    })

    recordMetrics(`code-${cliType}`, 'unknown', false, Date.now() - startTime, 0, 0)
  }
}
