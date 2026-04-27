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

// Usage type is now accessed via getBridgeUsage() instead of direct import
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

import {
  getBridgeProxyRepository,
  getProviderRepository,
  getModelMappingRepository
} from '../database/repositories'
import { logRequest } from '../logger'
import { recordRequest as recordMetrics } from '../metrics'

import { getBridge, getBridgeUsage, resolveProxyChain } from './bridge-manager'
import { handleProviderPassthrough } from './provider-passthrough'
import { handleCodeSwitch } from './code-switch-handler'
import { handleCliProxy } from './cli-proxy-handler'
import { CliType } from '../../types/cli'
import { ProxyErrorCode } from './types'
import { 
  extractApiKey, 
  validateApiKey, 
  createErrorResponse,
  getEndpointForAdapter  // 仍然需要用于 Conversion Proxy
} from './utils'

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
  // 0. Code Switch Routes (V2 - New Architecture)
  // ============================================================================
  console.log(`\n[Routes] 📋 Registering CLI Code Switch V2 routes`)

  // Claude Code 路由
  app.post('/api/v1/cc', async (request: FastifyRequest, reply: FastifyReply) => {
    console.log(`[Routes] 🎯 CLI Proxy route matched: Claude Code`)
    return handleCliProxy(request, reply, CliType.ClaudeCode)
  })
  console.log(`[Routes]   ✅ Registered route: POST /api/v1/cc`)

  app.post('/api/v1/cc/messages', async (request: FastifyRequest, reply: FastifyReply) => {
    console.log(`[Routes] 🎯 CLI Proxy route matched: Claude Code (messages)`)
    return handleCliProxy(request, reply, CliType.ClaudeCode)
  })
  console.log(`[Routes]   ✅ Registered route: POST /api/v1/cc/messages`)

  // Codex 路由
  app.post('/api/v1/codex', async (request: FastifyRequest, reply: FastifyReply) => {
    console.log(`[Routes] 🎯 CLI Proxy route matched: Codex`)
    return handleCliProxy(request, reply, CliType.Codex)
  })
  console.log(`[Routes]   ✅ Registered route: POST /api/v1/codex`)

  app.post('/api/v1/codex/chat/completions', async (request: FastifyRequest, reply: FastifyReply) => {
    console.log(`[Routes] 🎯 CLI Proxy route matched: Codex (chat completions)`)
    return handleCliProxy(request, reply, CliType.Codex)
  })
  console.log(`[Routes]   ✅ Registered route: POST /api/v1/codex/chat/completions`)

  // ============================================================================
  // Legacy: Code Switch Routes (V1 - 兼容旧版本)
  // ============================================================================
  console.log(`\n[Routes] 📋 Registering Legacy Code Switch routes (V1 compatibility)`)
  
  app.post('/code/claudecode/v1/messages', async (request: FastifyRequest, reply: FastifyReply) => {
    console.log(`[Routes] 🎯 Legacy Code Switch route matched: claudecode`)
    return handleCodeSwitch(request, reply, 'claudecode')
  })
  console.log(`[Routes]   ✅ Registered route: POST /code/claudecode/v1/messages (legacy)`)
  
  // ============================================================================
  // 1. Provider Passthrough Proxy Routes
  // ============================================================================
  const passthroughProviders = providerRepo.findAllPassthrough()
  
  for (const provider of passthroughProviders) {
    // 使用 Provider 的 chat_path，如果没有则根据 adapter_type 从预设获取
    const chatPath = provider.chat_path || getEndpointForAdapter(provider.adapter_type)
    
    console.log(`\n[Routes] 📋 Registering passthrough provider: ${provider.name}`)
    console.log(`[Routes]   - ID: ${provider.id}`)
    console.log(`[Routes]   - proxy_path: ${provider.proxy_path}`)
    console.log(`[Routes]   - provider.chat_path: ${provider.chat_path}`)
    console.log(`[Routes]   - adapter_type: ${provider.adapter_type}`)
    console.log(`[Routes]   - resolved chatPath: ${chatPath}`)
    
    let routePath: string
    
    // Google 格式：/v1beta/models/{model}:action -> 使用通配符匹配整个 "model:action" 部分
    if (chatPath.includes('{model}:')) {
      // 提取 {model}: 之前的部分，使用 * 匹配后续内容
      const beforeModel = chatPath.substring(0, chatPath.indexOf('{model}:'))
      routePath = `/providers/${provider.proxy_path}${beforeModel}*`
      console.log(`[Routes]   - Route type: Google wildcard`)
      console.log(`[Routes]   - beforeModel: ${beforeModel}`)
    } else if (chatPath.includes('{model}')) {
      // 普通格式：/{model} -> 使用 :model 路由参数
      routePath = `/providers/${provider.proxy_path}${chatPath.replace('{model}', ':model')}`
      console.log(`[Routes]   - Route type: Standard with :model param`)
    } else {
      // 无占位符：直接使用
      routePath = `/providers/${provider.proxy_path}${chatPath}`
      console.log(`[Routes]   - Route type: Fixed path`)
    }
    
    console.log(`[Routes]   ✅ Registered route: POST ${routePath}\n`)
    
    // Chat/Messages endpoint
    app.post(routePath, async (request: FastifyRequest, reply: FastifyReply) => {
      console.log(`[Routes] 🎯 Route matched for provider: ${provider.name}`)
      console.log(`[Routes]   - Request URL: ${request.url}`)
      console.log(`[Routes]   - Request path: ${request.routeOptions.url}`)
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
  
  // Register routes for each proxy
  for (const proxy of proxies) {
    const endpoint = getEndpointForAdapter(proxy.inbound_adapter)
    const routePath = `/proxies/${proxy.proxy_path}${endpoint}`
    const errorFormat = proxy.inbound_adapter === 'anthropic' ? 'anthropic' : 'openai'
    
    // Chat/Messages endpoint
    app.post(routePath, async (request: FastifyRequest, reply: FastifyReply) => {
      const requestId = randomUUID()
      const startTime = Date.now()
      
      // Detect request source (local vs tunnel)
      // Cloudflare adds specific headers when proxying through tunnel
      const isTunnelRequest = !!(
        request.headers['cf-ray'] || 
        request.headers['cf-connecting-ip'] ||
        request.headers['cf-visitor']
      )
      const requestSource: 'local' | 'tunnel' = isTunnelRequest ? 'tunnel' : 'local'
      
      try {
        const body = request.body as ChatCompletionRequest

        // Detect internal requests (from Chat IPC - localhost + no auth header)
        const apiKey = extractApiKey(request)
        const isInternalRequest = requestSource === 'local' && !apiKey

        // Variables for bridge and provider
        let bridge, provider

        // Validate API key (skip for internal requests)
        if (!isInternalRequest) {
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

          // Get bridge with appropriate API key handling
          try {
            const passThruKey = keyValidation.usePassThrough ? apiKey : undefined
            const result = getBridge(proxy.id, passThruKey ?? undefined)
            bridge = result.bridge
            provider = result.provider
          } catch (error) {
            console.error(`[Routes] Failed to get bridge:`, error)
            throw error
          }
        } else {
          // Internal request from Chat - use provider's configured key
          try {
            const result = getBridge(proxy.id, undefined)
            bridge = result.bridge
            provider = result.provider
          } catch (error) {
            console.error(`[Routes] Failed to get bridge:`, error)
            throw error
          }
        }
        
        // Resolve model mapping
        const mappingRepo = getModelMappingRepository()
        const sourceModel = body.model || ''
        const targetModel = mappingRepo.resolveTargetModel(proxy.id, sourceModel) ?? sourceModel
        
        // Update request with mapped model
        const mappedRequest = {
          ...body,
          model: targetModel
        }
        
        // Handle streaming vs non-streaming
        if (body.stream) {
          // Streaming response
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
          const usage = getBridgeUsage(bridge)
          const inputTokens = usage?.promptTokens
          const outputTokens = usage?.completionTokens
          
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
            error: streamError,
            source: requestSource
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
        try {
          const response = await bridge.chat(mappedRequest)
          const latencyMs = Date.now() - startTime
          
          // ⭐ 从 Bridge 钩子中获取 Token（已经是 IR 统一格式！）
          const usage = getBridgeUsage(bridge)
          const inputTokens = usage?.promptTokens
          const outputTokens = usage?.completionTokens
          
          // Log successful request
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
            responseBody: JSON.stringify(response),
            source: requestSource
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
            error: errorMessage,
            source: requestSource
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
}
