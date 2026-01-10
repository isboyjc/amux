/**
 * Proxy server routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { randomUUID } from 'crypto'
import {
  getBridgeProxyRepository,
  getApiKeyRepository,
  getModelMappingRepository,
  getProviderRepository
} from '../database/repositories'
import { getBridge, resolveProxyChain } from './bridge-manager'
import { ProxyErrorCode } from './types'

// Request body type
interface ChatCompletionRequest {
  model: string
  messages: unknown[]
  stream?: boolean
  [key: string]: unknown
}

/**
 * Create error response
 */
function createErrorResponse(
  code: ProxyErrorCode,
  message: string,
  statusCode: number = 500
): { statusCode: number; body: unknown } {
  return {
    statusCode,
    body: {
      error: {
        message,
        type: 'api_error',
        code
      }
    }
  }
}

/**
 * Extract API key from Authorization header
 */
function extractApiKey(request: FastifyRequest): string | null {
  const auth = request.headers.authorization
  if (!auth) return null
  
  if (auth.startsWith('Bearer ')) {
    return auth.slice(7)
  }
  
  return auth
}

/**
 * Validate API key
 * Supports both unified keys (sk-xxx) and provider keys
 */
function validateApiKey(apiKey: string): boolean {
  // Check if it's a unified key
  if (apiKey.startsWith('sk-')) {
    const apiKeyRepo = getApiKeyRepository()
    const key = apiKeyRepo.validateKey(apiKey)
    if (key) {
      // Update last used
      apiKeyRepo.updateLastUsed(key.id)
      return true
    }
  }
  
  // For now, accept any API key format
  // In production, you might want stricter validation
  return apiKey.length > 0
}

/**
 * Register proxy routes
 */
export function registerRoutes(app: FastifyInstance): void {
  // Chat completions endpoint
  app.post<{
    Params: { proxyPath: string }
    Body: ChatCompletionRequest
  }>(
    '/:proxyPath/v1/chat/completions',
    async (request, reply) => {
      const requestId = randomUUID()
      const startTime = Date.now()
      
      try {
        const { proxyPath } = request.params
        const body = request.body
        
        // Find proxy by path
        const proxyRepo = getBridgeProxyRepository()
        const proxy = proxyRepo.findByPath(proxyPath)
        
        if (!proxy) {
          const error = createErrorResponse(
            ProxyErrorCode.PROXY_NOT_FOUND,
            `Proxy not found: ${proxyPath}`,
            404
          )
          return reply.status(error.statusCode).send(error.body)
        }
        
        if (!proxy.enabled) {
          const error = createErrorResponse(
            ProxyErrorCode.PROXY_DISABLED,
            `Proxy is disabled: ${proxyPath}`,
            403
          )
          return reply.status(error.statusCode).send(error.body)
        }
        
        // Validate API key
        const apiKey = extractApiKey(request)
        if (!apiKey) {
          const error = createErrorResponse(
            ProxyErrorCode.MISSING_API_KEY,
            'Missing API key in Authorization header',
            401
          )
          return reply.status(error.statusCode).send(error.body)
        }
        
        if (!validateApiKey(apiKey)) {
          const error = createErrorResponse(
            ProxyErrorCode.INVALID_API_KEY,
            'Invalid API key',
            401
          )
          return reply.status(error.statusCode).send(error.body)
        }
        
        // Get bridge
        const { bridge, provider } = getBridge(proxy.id)
        
        // Resolve model mapping
        const mappingRepo = getModelMappingRepository()
        const sourceModel = body.model
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
          
          try {
            const stream = await bridge.chatStream(mappedRequest)
            
            for await (const event of stream) {
              if (event.type === 'done') {
                reply.raw.write('data: [DONE]\n\n')
                break
              }
              
              // Build SSE response format
              const chunk = buildStreamChunk(event, requestId)
              if (chunk) {
                reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`)
              }
            }
            
            reply.raw.end()
          } catch (error) {
            console.error(`[Routes] Stream error:`, error)
            reply.raw.write(`data: ${JSON.stringify({
              error: {
                message: error instanceof Error ? error.message : 'Stream error',
                type: 'api_error',
                code: ProxyErrorCode.INTERNAL_ERROR
              }
            })}\n\n`)
            reply.raw.end()
          }
          
          return
        }
        
        // Non-streaming response
        try {
          const response = await bridge.chat(mappedRequest)
          
          reply.header('X-Request-ID', requestId)
          return reply.send(response)
        } catch (error) {
          console.error(`[Routes] Chat error:`, error)
          const err = createErrorResponse(
            ProxyErrorCode.ADAPTER_ERROR,
            error instanceof Error ? error.message : 'Chat request failed',
            502
          )
          return reply.status(err.statusCode).send(err.body)
        }
      } catch (error) {
        console.error(`[Routes] Error:`, error)
        const err = createErrorResponse(
          ProxyErrorCode.INTERNAL_ERROR,
          error instanceof Error ? error.message : 'Internal server error',
          500
        )
        return reply.status(err.statusCode).send(err.body)
      }
    }
  )
  
  // Models endpoint
  app.get<{
    Params: { proxyPath: string }
  }>(
    '/:proxyPath/v1/models',
    async (request, reply) => {
      try {
        const { proxyPath } = request.params
        
        // Find proxy by path
        const proxyRepo = getBridgeProxyRepository()
        const proxy = proxyRepo.findByPath(proxyPath)
        
        if (!proxy) {
          const error = createErrorResponse(
            ProxyErrorCode.PROXY_NOT_FOUND,
            `Proxy not found: ${proxyPath}`,
            404
          )
          return reply.status(error.statusCode).send(error.body)
        }
        
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
    }
  )
  
  // List all proxies endpoint
  app.get('/v1/proxies', async (request, reply) => {
    const proxyRepo = getBridgeProxyRepository()
    const proxies = proxyRepo.findAllEnabled()
    
    return reply.send({
      object: 'list',
      data: proxies.map(p => ({
        id: p.id,
        path: p.proxy_path,
        name: p.name,
        inbound: p.inbound_adapter,
        enabled: p.enabled === 1
      }))
    })
  })
}

/**
 * Build streaming response chunk
 */
function buildStreamChunk(event: unknown, requestId: string): unknown {
  // This is a simplified version - in production, you'd properly transform
  // the IR stream events to the inbound format
  const e = event as { type: string; content?: string; delta?: unknown }
  
  if (e.type === 'content' || e.type === 'delta') {
    return {
      id: `chatcmpl-${requestId}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: 'unknown', // Would come from context
      choices: [{
        index: 0,
        delta: e.delta ?? { content: e.content ?? '' },
        finish_reason: null
      }]
    }
  }
  
  if (e.type === 'end') {
    return {
      id: `chatcmpl-${requestId}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: 'unknown',
      choices: [{
        index: 0,
        delta: {},
        finish_reason: 'stop'
      }]
    }
  }
  
  return null
}
