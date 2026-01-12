/**
 * Proxy server routes
 * 
 * Routes are dynamically registered based on proxy configurations.
 * Route format: /proxies/{proxy_path}{endpoint}
 * 
 * Each proxy's inbound adapter determines the endpoint:
 *   - openai, deepseek, moonshot, qwen, zhipu, google → /v1/chat/completions
 *   - anthropic → /v1/messages
 *   - openai-responses → /v1/responses
 * 
 * Example: /proxies/anthropic-moonshot/v1/messages
 */

import { randomUUID } from 'crypto'

import type { Usage } from '@amux/llm-bridge'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

import {
  getBridgeProxyRepository,
  getProviderRepository,
  getModelMappingRepository
} from '../database/repositories'
import { logRequest } from '../logger'
import { recordRequest as recordMetrics } from '../metrics'

import { getBridge, resolveProxyChain } from './bridge-manager'
import { ProxyErrorCode } from './types'
import { 
  extractApiKey, 
  validateApiKey, 
  createErrorResponse, 
  getEndpointForAdapter 
} from './utils'
import { handleProviderPassthrough } from './provider-passthrough'

// Request body type
interface ChatCompletionRequest {
  model: string
  messages?: unknown[]
  stream?: boolean
  [key: string]: unknown
}

/**
 * Register proxy routes
 */
export function registerRoutes(app: FastifyInstance): void {
  const proxyRepo = getBridgeProxyRepository()
  const providerRepo = getProviderRepository()
  
  // ============================================================================
  // 1. Provider Passthrough Proxy Routes
  // ============================================================================
  const passthroughProviders = providerRepo.findAllPassthrough()
  
  console.log(`[Routes] Registering ${passthroughProviders.length} passthrough providers`)
  
  for (const provider of passthroughProviders) {
    const endpoint = getEndpointForAdapter(provider.adapter_type)
    const routePath = `/providers/${provider.proxy_path}${endpoint}`
    
    console.log(`[Routes] Registering passthrough: ${routePath} (${provider.adapter_type})`)
    
    // Chat/Messages endpoint
    app.post(routePath, async (request: FastifyRequest, reply: FastifyReply) => {
      return handleProviderPassthrough(request, reply, provider)
    })
    
    // Models endpoint
    app.get(`/providers/${provider.proxy_path}/v1/models`, async (_request, reply) => {
      try {
        const models = JSON.parse(provider.models || '[]') as string[]
        
        const response = {
          object: 'list',
          data: models.map(model => ({
            id: model,
            object: 'model',
            created: Math.floor(Date.now() / 1000),
            owned_by: provider.name
          }))
        }
        
        return reply.send(response)
      } catch (error) {
        const err = createErrorResponse(
          ProxyErrorCode.INTERNAL_ERROR,
          error instanceof Error ? error.message : 'Internal server error',
          500
        )
        return reply.status(err.statusCode).send(err.body)
      }
    })
  }
  
  // ============================================================================
  // 2. Conversion Proxy Routes (existing)
  // ============================================================================
  const proxies = proxyRepo.findAllEnabled()
  
  console.log(`[Routes] Registering routes for ${proxies.length} enabled proxies`)
  
  // Register routes for each proxy
  for (const proxy of proxies) {
    const endpoint = getEndpointForAdapter(proxy.inbound_adapter)
    const routePath = `/proxies/${proxy.proxy_path}${endpoint}`
    const errorFormat = proxy.inbound_adapter === 'anthropic' ? 'anthropic' : 'openai'
    
    console.log(`[Routes] Registering: ${routePath} (${proxy.inbound_adapter} -> ${proxy.outbound_type})`)
    
    // Chat/Messages endpoint
    app.post(routePath, async (request: FastifyRequest, reply: FastifyReply) => {
      const requestId = randomUUID()
      const startTime = Date.now()
      
      console.log(`[Routes] Request received: ${routePath}`)
      
      try {
        const body = request.body as ChatCompletionRequest
        
        console.log(`[Routes] proxyPath: ${proxy.proxy_path}, model: ${body?.model}`)
        
        // Validate API key
        const apiKey = extractApiKey(request)
        console.log(`[Routes] API key: ${apiKey ? '***' + apiKey.slice(-4) : 'missing'}`)
        
        // Validate API key based on authentication mode
        const keyValidation = validateApiKey(apiKey)
        console.log(`[Routes] Key validation: valid=${keyValidation.valid}, usePlatformKey=${keyValidation.usePlatformKey}, usePassThrough=${keyValidation.usePassThrough}`)
        
        if (!keyValidation.valid) {
          console.log(`[Routes] Key validation failed: ${keyValidation.error}`)
          const error = createErrorResponse(
            keyValidation.error?.includes('required') ? ProxyErrorCode.MISSING_API_KEY : ProxyErrorCode.INVALID_API_KEY,
            keyValidation.error || 'Invalid API key',
            401,
            errorFormat
          )
          return reply.status(error.statusCode).send(error.body)
        }
        
        // Get bridge with appropriate API key handling:
        // - Auth disabled or Platform key: use provider's configured key (passThruKey = undefined)
        // - Pass-through mode: use the request key directly (passThruKey = apiKey)
        console.log(`[Routes] Getting bridge for proxy: ${proxy.id}`)
        let bridge, provider
        try {
          const passThruKey = keyValidation.usePassThrough ? apiKey : undefined
          const result = getBridge(proxy.id, passThruKey ?? undefined)
          bridge = result.bridge
          provider = result.provider
          
          const mode = keyValidation.usePassThrough 
            ? 'pass-through' 
            : (keyValidation.usePlatformKey ? 'platform-key' : 'no-auth')
          console.log(`[Routes] Bridge created, provider: ${provider.name}, mode: ${mode}`)
        } catch (error) {
          console.error(`[Routes] Failed to get bridge:`, error)
          throw error
        }
        
        // Resolve model mapping
        const mappingRepo = getModelMappingRepository()
        const sourceModel = body.model || ''
        const targetModel = mappingRepo.resolveTargetModel(proxy.id, sourceModel) ?? sourceModel
        
        console.log(`[Routes] Model: ${sourceModel} -> ${targetModel}`)
        
        // Update request with mapped model
        const mappedRequest = {
          ...body,
          model: targetModel
        }
        
        // Handle streaming vs non-streaming
        console.log(`[Routes] Stream mode: ${body.stream ? 'streaming' : 'non-streaming'}`)
        
        if (body.stream) {
          // Streaming response
          console.log(`[Routes] Starting stream request`)
          reply.raw.setHeader('Content-Type', 'text/event-stream')
          reply.raw.setHeader('Cache-Control', 'no-cache')
          reply.raw.setHeader('Connection', 'keep-alive')
          reply.raw.setHeader('X-Request-ID', requestId)
          
          let streamSuccess = true
          let streamError: string | undefined
          const streamChunks: unknown[] = []  // Collect chunks for response body
          
          try {
            const stream = await bridge.chatStream(mappedRequest)
            
            for await (const sse of stream) {
              // Collect chunk for response body
              streamChunks.push(sse)
              
              // Format SSE based on inbound adapter format
              if (proxy.inbound_adapter === 'anthropic' || proxy.inbound_adapter === 'openai-responses') {
                // Anthropic and OpenAI Responses API format: event: xxx\ndata: {...}\n\n
                const sseData = sse as { event?: string; data?: unknown; type?: string }
                const eventType = sseData.event || sseData.type || 'message'
                reply.raw.write(`event: ${eventType}\ndata: ${JSON.stringify(sseData.data || sseData)}\n\n`)
              } else {
                // OpenAI Chat Completions format: data: {...}\n\n
                reply.raw.write(`data: ${JSON.stringify(sse)}\n\n`)
              }
            }
            
            // Add protocol-level end marker for OpenAI Chat Completions format only
            if (proxy.inbound_adapter !== 'anthropic' && proxy.inbound_adapter !== 'openai-responses') {
              reply.raw.write('data: [DONE]\n\n')
            }
            
            reply.raw.end()
          } catch (error) {
            streamSuccess = false
            streamError = error instanceof Error ? error.message : 'Stream error'
            console.error(`[Routes] Stream error:`, error)
            
            if (proxy.inbound_adapter === 'anthropic') {
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
          
          // ⭐ 从 Bridge 钩子中获取 Token（已经是 IR 统一格式！）
          const usage = (bridge as any)._lastUsage as Usage | undefined
          const inputTokens = usage?.promptTokens
          const outputTokens = usage?.completionTokens
          
          console.log(`[Routes] Stream completed, tokens: ${usage ? `${inputTokens}/${outputTokens}` : 'N/A'}`)
          
          // Log streaming request
          logRequest({
            proxyId: proxy.id,
            proxyPath: proxy.proxy_path,
            sourceModel,
            targetModel,
            statusCode: streamSuccess ? 200 : 500,
            inputTokens,
            outputTokens,
            latencyMs,
            requestBody: JSON.stringify(body),
            responseBody: streamSuccess && streamChunks.length > 0 
              ? JSON.stringify({ chunks: streamChunks, totalChunks: streamChunks.length })
              : undefined,
            error: streamError
          })
          recordMetrics(
            proxy.id, 
            provider.id, 
            streamSuccess, 
            latencyMs,
            inputTokens,
            outputTokens
          )
          
          return
        }
        
        // Non-streaming response
        console.log(`[Routes] Starting non-streaming request`)
        try {
          console.log(`[Routes] Calling bridge.chat...`)
          const response = await bridge.chat(mappedRequest)
          console.log(`[Routes] bridge.chat completed`)
          const latencyMs = Date.now() - startTime
          
          // ⭐ 从 Bridge 钩子中获取 Token（已经是 IR 统一格式！）
          const usage = (bridge as any)._lastUsage as Usage | undefined
          const inputTokens = usage?.promptTokens
          const outputTokens = usage?.completionTokens
          
          console.log(`[Routes] Tokens: ${usage ? `${inputTokens}/${outputTokens}` : 'N/A'}`)
          
          // Log successful request
          console.log(`[Routes] Logging request, latency: ${latencyMs}ms`)
          logRequest({
            proxyId: proxy.id,
            proxyPath: proxy.proxy_path,
            sourceModel,
            targetModel,
            statusCode: 200,
            inputTokens,
            outputTokens,
            latencyMs,
            requestBody: JSON.stringify(body),
            responseBody: JSON.stringify(response)
          })
          recordMetrics(
            proxy.id, 
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
          
          // Log failed request (no tokens for failed requests)
          logRequest({
            proxyId: proxy.id,
            proxyPath: proxy.proxy_path,
            sourceModel,
            targetModel,
            statusCode: 502,
            inputTokens: undefined,
            outputTokens: undefined,
            latencyMs,
            requestBody: JSON.stringify(body),
            error: errorMessage
          })
          recordMetrics(proxy.id, provider.id, false, latencyMs)
          
          console.error(`[Routes] Chat error:`, error)
          const err = createErrorResponse(
            ProxyErrorCode.ADAPTER_ERROR,
            errorMessage,
            502,
            errorFormat
          )
          return reply.status(err.statusCode).send(err.body)
        }
      } catch (error) {
        console.error(`[Routes] Error:`, error)
        const err = createErrorResponse(
          ProxyErrorCode.INTERNAL_ERROR,
          error instanceof Error ? error.message : 'Internal server error',
          500,
          errorFormat
        )
        return reply.status(err.statusCode).send(err.body)
      }
    })
  }
  
  // Models endpoint for each proxy
  for (const proxy of proxies) {
    app.get(`/proxies/${proxy.proxy_path}/v1/models`, async (_request, reply) => {
      try {
        // Resolve to provider
        const { provider } = resolveProxyChain(proxy.id)
        
        // Get models from provider
        const models = JSON.parse(provider.models || '[]') as string[]
        
        // Format as OpenAI models response
        const response = {
          object: 'list',
          data: models.map(model => ({
            id: model,
            object: 'model',
            created: Math.floor(Date.now() / 1000),
            owned_by: provider.name
          }))
        }
        
        return reply.send(response)
      } catch (error) {
        const err = createErrorResponse(
          ProxyErrorCode.INTERNAL_ERROR,
          error instanceof Error ? error.message : 'Internal server error',
          500
        )
        return reply.status(err.statusCode).send(err.body)
      }
    })
  }
  
  // List all proxies endpoint
  app.get('/v1/proxies', async (_request, reply) => {
    const allProxies = proxyRepo.findAllEnabled()
    
    return reply.send({
      object: 'list',
      data: allProxies.map(p => ({
        id: p.id,
        path: p.proxy_path,
        fullPath: `/proxies/${p.proxy_path}`,
        name: p.name,
        inbound: p.inbound_adapter,
        endpoint: getEndpointForAdapter(p.inbound_adapter),
        enabled: p.enabled === 1
      }))
    })
  })
  
  console.log(`[Routes] All routes registered`)
}
