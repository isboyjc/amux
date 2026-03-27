/**
 * Provider Passthrough Proxy Handler
 * 
 * Handles requests to providers configured as passthrough proxies.
 * Uses llm-bridge with Inbound = Outbound (same adapter) for minimal overhead
 * while maintaining automatic Token statistics, error handling, and streaming.
 */

import { randomUUID } from 'crypto'

import { Bridge } from '@amux.ai/llm-bridge'
import type { FastifyRequest, FastifyReply } from 'fastify'

import { decryptApiKey } from '../crypto'
import type { ProviderRow } from '../database/types'
import { logRequest } from '../logger'
import { recordRequest as recordMetrics } from '../metrics'

import { getAdapter, getBridgeUsage, setBridgeUsage } from './bridge-manager'
import { ProxyErrorCode } from './types'
import { extractApiKey, validateApiKey, createErrorResponse, getEndpointForAdapter } from './utils'

// Type definitions for request/response
interface ChatRequestBody {
  model?: string
  stream?: boolean
  [key: string]: unknown
}

interface RequestParams {
  '*'?: string
  [key: string]: unknown
}

interface ErrorDetails {
  type?: string
  message: string
  code?: string | number
  [key: string]: unknown
}

interface BridgeError {
  status?: number
  data?: unknown
  details?: unknown
  message?: string
  constructor: { name: string }
}

/**
 * Get Provider's authentication token
 * 
 * @param provider - Provider configuration
 * @returns Token string, or null if not available
 */
async function getProviderToken(
  provider: ProviderRow
): Promise<string | null> {
  if (!provider.api_key) {
    return null
  }
  
  const decryptedKey = decryptApiKey(provider.api_key)
  if (!decryptedKey) {
    console.error(`[Passthrough] Failed to decrypt API key for provider: ${provider.name}`)
    return null
  }
  
  return decryptedKey
}

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
  
  console.log(`\n[Passthrough] 🚀 Handling request for provider: ${provider.name}`)
  console.log(`[Passthrough]   - Request URL: ${request.url}`)
  console.log(`[Passthrough]   - Request method: ${request.method}`)
  console.log(`[Passthrough]   - Provider adapter: ${provider.adapter_type}`)
  console.log(`[Passthrough]   - Provider base_url: ${provider.base_url}`)
  console.log(`[Passthrough]   - Provider chat_path: ${provider.chat_path}`)
  
  try {
    const body = request.body as ChatRequestBody
    
    console.log(`[Passthrough]   - Request params:`, request.params)
    console.log(`[Passthrough]   - Request body model (before): ${body.model}`)
    
    // 🆕 对于 Google adapter，从 URL 参数中提取模型名并注入到请求体
    // URL 格式：/providers/{path}/v1beta/models/{model}:streamGenerateContent
    if (provider.adapter_type === 'google' && !body.model) {
      const params = request.params as RequestParams
      
      console.log(`[Passthrough]   - Google adapter: extracting model from params`)
      
      // 支持两种路由格式：
      // 1. 通配符：params['*'] = 'gemini-2.5-flash-lite:streamGenerateContent'
      // 2. 路由参数：params.model = 'gemini-2.5-flash-lite'
      let modelName: string | undefined
      
      if (params['*']) {
        // 从通配符中提取模型名（冒号之前的部分）
        const wildcardParam = params['*'] as string
        console.log(`[Passthrough]   - Wildcard param: ${wildcardParam}`)
        const colonIndex = wildcardParam.indexOf(':')
        modelName = colonIndex > 0 ? wildcardParam.substring(0, colonIndex) : wildcardParam
        console.log(`[Passthrough]   - Extracted model from wildcard: ${modelName}`)
      } else if (params.model && typeof params.model === 'string') {
        modelName = params.model
        console.log(`[Passthrough]   - Model from route param: ${modelName}`)
      }
      
      if (modelName) {
        body.model = modelName
        console.log(`[Passthrough]   - Injected model into body: ${modelName}`)
      }
    }
    
    console.log(`[Passthrough]   - Request body model (after): ${body.model}`)

    // 1. Detect internal requests (from Chat IPC - localhost + no auth header)
    const apiKey = extractApiKey(request)
    const isInternalRequest = requestSource === 'local' && !apiKey

    // 2. Determine which API key to use
    let targetApiKey: string

    if (isInternalRequest) {
      // Internal request - use provider's token

      const result = await getProviderToken(provider)
      if (!result) {
        const error = createErrorResponse(
          ProxyErrorCode.MISSING_API_KEY,
          `Provider "${provider.name}" has no API key configured.`,
          500,
          errorFormat
        )
        return reply.status(error.statusCode).send(error.body)
      }

      targetApiKey = result
    } else {
      // External request - validate and use appropriate key
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
        targetApiKey = apiKey || ''
      } else {
        // Use provider's token
        const result = await getProviderToken(provider)
        if (!result) {
          const error = createErrorResponse(
            ProxyErrorCode.MISSING_API_KEY,
            `Provider "${provider.name}" has no API key configured.`,
            500,
            errorFormat
          )
          return reply.status(error.statusCode).send(error.body)
        }

        targetApiKey = result
      }
    }
    
    // 3. Get Adapter (Inbound = Outbound)
    const adapter = getAdapter(provider.adapter_type)
    if (!adapter) {
      throw new Error(`Adapter not found: ${provider.adapter_type}`)
    }
    
    // 4. 处理 chatPath 中的 {model} 占位符
    // 如果 provider.chat_path 为 null，llm-bridge 会使用 adapter 的默认 chatPath
    // 如果默认 chatPath 包含 {model} 占位符，需要手动替换，因为 llm-bridge 可能无法正确处理
    let chatPath = provider.chat_path
    
    if (provider.adapter_type === 'google' && !chatPath && body.model) {
      // 获取 Google adapter 的默认 chatPath
      const defaultChatPath = getEndpointForAdapter('google')
      console.log(`[Passthrough]   - Google adapter default chatPath: ${defaultChatPath}`)
      
      // 手动替换 {model} 占位符
      if (defaultChatPath.includes('{model}')) {
        chatPath = defaultChatPath.replace('{model}', body.model)
        console.log(`[Passthrough]   - Replaced {model} with ${body.model}: ${chatPath}`)
      }
    }
    
    // 5. Create Bridge with standard adapter
    const bridgeConfig = {
      apiKey: targetApiKey,
      baseURL: provider.base_url || undefined,
      chatPath: chatPath || undefined,
      timeout: 60000,
    }
    
    console.log(`[Passthrough]   - Bridge config:`, {
      baseURL: bridgeConfig.baseURL,
      chatPath: bridgeConfig.chatPath,
      model: body.model
    })
    
    const bridge = new Bridge({
      inbound: adapter,
      outbound: adapter,  // Passthrough uses same adapter for inbound/outbound
      config: bridgeConfig,
      // ⭐ Add hooks to capture token usage (unified IR format!)
      hooks: {
        onResponse: async (ir) => {
          // Token统计已经是统一格式，无需区分 Provider！
          if (ir.usage) {
            setBridgeUsage(bridge, ir.usage)
          }
        },
        onStreamEvent: async (event) => {
          // 流式响应中的 Token 也是统一格式
          if (event.type === 'end' && event.usage) {
            setBridgeUsage(bridge, event.usage)
          }
        }
      }
    })
    
    // 4. Handle request (streaming vs non-streaming)
    console.log(`[Passthrough] 📋 Request body.stream: ${body.stream}`)
    console.log(`[Passthrough] 📋 Request body keys: ${Object.keys(body).join(', ')}`)
    console.log(`[Passthrough] 📋 Request URL: ${request.url}`)
    
    // 判断是否为流式请求
    // - OpenAI/Anthropic: 使用 body.stream 字段
    // - Google: 检查 URL 中的 alt=sse 参数 或 请求方法名包含 "stream"
    const isStreamRequest = body.stream || 
      (provider.adapter_type === 'google' && (
        request.url.includes('alt=sse') || 
        request.url.includes('stream') ||
        (chatPath && chatPath.includes('stream'))
      ))
    
    console.log(`[Passthrough] 📋 Is stream request: ${isStreamRequest}`)
    
    if (isStreamRequest) {
      // Streaming response
      console.log(`[Passthrough] 🌊 Using STREAMING mode`)
      
      // 对于 Google adapter，确保 body.stream 设置为 true
      // 这样 llm-bridge 才能正确处理流式响应
      if (provider.adapter_type === 'google' && !body.stream) {
        body.stream = true
        console.log(`[Passthrough] ✅ Set body.stream = true for Google adapter`)
      }
      
      reply.raw.setHeader('Content-Type', 'text/event-stream')
      reply.raw.setHeader('Cache-Control', 'no-cache')
      reply.raw.setHeader('Connection', 'keep-alive')
      reply.raw.setHeader('X-Request-ID', requestId)
      
      let streamSuccess = true
      let streamError: string | undefined
      const streamChunks: unknown[] = []
      
      try {
        console.log(`[Passthrough] 🌊 Starting stream for ${provider.adapter_type}`)
        const stream = await bridge.chatStream(body)
        console.log(`[Passthrough] ✅ Stream created successfully`)
        
        let chunkCount = 0
        for await (const event of stream) {
          chunkCount++
          // Bridge returns SSE events in format: { event: "...", data: {...} }
          // Extract the actual data for passthrough
          const sseEvent = event as { event?: string; data?: unknown; type?: string }
          
          if (chunkCount === 1) {
            console.log(`[Passthrough] 📦 First chunk type: ${sseEvent.type || sseEvent.event}`)
            console.log(`[Passthrough] 📦 First chunk data keys: ${Object.keys(sseEvent.data || sseEvent).join(', ')}`)
          }

          // Collect chunks for logging
          streamChunks.push(sseEvent.data || sseEvent)
          
          // Format SSE based on adapter type
          if (provider.adapter_type === 'anthropic' || provider.adapter_type === 'openai-responses') {
            // Anthropic/OpenAI Responses format: event: xxx\ndata: {...}\n\n
            const eventType = sseEvent.event || sseEvent.type || 'message'
            const eventData = sseEvent.data || sseEvent
            reply.raw.write(`event: ${eventType}\ndata: ${JSON.stringify(eventData)}\n\n`)
          } else if (provider.adapter_type === 'google') {
            // Google 格式：直接转发原始事件
            const chunkData = sseEvent.data || sseEvent
            reply.raw.write(`data: ${JSON.stringify(chunkData)}\n\n`)
          } else {
            // OpenAI Chat Completions format: data: {...}\n\n
            // For OpenAI format, we need to send the actual chunk data, not the wrapper
            const chunkData = sseEvent.data || sseEvent
            reply.raw.write(`data: ${JSON.stringify(chunkData)}\n\n`)
          }
        }
        
        console.log(`[Passthrough] ✅ Stream completed, total chunks: ${chunkCount}`)
        
        // Add protocol-level end marker for OpenAI Chat Completions format only
        if (provider.adapter_type !== 'anthropic' && provider.adapter_type !== 'openai-responses') {
          reply.raw.write('data: [DONE]\n\n')
          console.log(`[Passthrough] 📤 Sent [DONE] marker`)
        }
        
        reply.raw.end()
        console.log(`[Passthrough] ✅ Stream ended successfully`)
      } catch (error) {
        streamSuccess = false
        streamError = error instanceof Error ? error.message : 'Stream error'
        console.error(`[Passthrough] ❌ Stream error:`, error)
        console.error(`[Passthrough] Error type: ${error instanceof Error ? error.constructor.name : 'Unknown'}`)
        console.error(`[Passthrough] Error message: ${streamError}`)
        
        // 🔄 提取原始错误详情
        let errorDetails: ErrorDetails = {
          type: 'api_error',
          message: streamError,
          code: ProxyErrorCode.INTERNAL_ERROR
        }
        
        // 如果是 Bridge 的 APIError，提取原始错误信息
        if (error && typeof error === 'object') {
          const err = error as BridgeError
          // ✅ 直接使用 err.data（完整的错误响应）
          if (err.data && typeof err.data === 'object') {
            errorDetails = { message: streamError, ...err.data as Record<string, unknown> }
          } else if (err.details && typeof err.details === 'object') {
            errorDetails = { message: streamError, ...err.details as Record<string, unknown> }
          }
        }
        
        if (provider.adapter_type === 'anthropic') {
          reply.raw.write(`event: error\ndata: ${JSON.stringify({
            type: 'error',
            error: errorDetails
          })}\n\n`)
        } else {
          reply.raw.write(`data: ${JSON.stringify({
            error: errorDetails
          })}\n\n`)
        }
        reply.raw.end()
      }
      
      const latencyMs = Date.now() - startTime
      
      // Get Token statistics from Bridge automatically
      const usage = getBridgeUsage(bridge)
      const inputTokens = usage?.promptTokens
      const outputTokens = usage?.completionTokens
      
      // Log request
      const finalStatusCode = streamSuccess ? 200 : 500
      console.log(`[Passthrough] 📊 Logging request: success=${streamSuccess}, statusCode=${finalStatusCode}`)
      
      logRequest({
        proxyPath: provider.proxy_path || `provider-${provider.id}`,
        sourceModel: body.model || 'unknown',
        targetModel: body.model || 'unknown',
        statusCode: finalStatusCode,
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
    console.log(`[Passthrough] 📝 Using NON-STREAMING mode`)
    try {
      console.log(`[Passthrough] 🔄 Calling bridge.chat()...`)
      const response = await bridge.chat(body)
      console.log(`[Passthrough] ✅ bridge.chat() completed`)
      const latencyMs = Date.now() - startTime
      
      // Get Token statistics from Bridge automatically
      const usage = getBridgeUsage(bridge)
      const inputTokens = usage?.promptTokens
      const outputTokens = usage?.completionTokens
      
      // Log successful request
      logRequest({
        proxyPath: provider.proxy_path || `provider-${provider.id}`,
        sourceModel: body.model || 'unknown',
        targetModel: body.model || 'unknown',
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
      console.error(`[Passthrough] ❌ bridge.chat() failed:`, error)
      console.error(`[Passthrough] Error type: ${error instanceof Error ? error.constructor.name : 'Unknown'}`)
      console.error(`[Passthrough] Error message: ${error instanceof Error ? error.message : 'Unknown'}`)
      
      const latencyMs = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Chat request failed'
      
      // 🔄 提取原始状态码和错误详情
      let statusCode = 502
      let errorBody: ErrorDetails = {
        message: errorMessage,
        type: 'api_error',
        code: ProxyErrorCode.ADAPTER_ERROR
      }
      
      // 如果是 Bridge 的 APIError，提取原始错误信息
      if (error && typeof error === 'object') {
        const err = error as BridgeError
        
        // Bridge 的 APIError 结构：{ status, data, provider, details }
        if (err.status) {
          statusCode = err.status
        }
        
        // 提取错误详情（优先使用完整的 data）
        if (err.data && typeof err.data === 'object') {
          // ✅ 直接使用 err.data，它可能是完整的错误响应
          errorBody = { message: errorMessage, ...err.data as Record<string, unknown> }
        } else if (err.details && typeof err.details === 'object') {
          errorBody = { message: errorMessage, ...err.details as Record<string, unknown> }
        }
      }
      
      // Log failed request
      logRequest({
        proxyPath: provider.proxy_path || `provider-${provider.id}`,
        sourceModel: body.model || 'unknown',
        targetModel: body.model || 'unknown',
        statusCode,
        inputTokens: undefined,
        outputTokens: undefined,
        latencyMs,
        requestBody: JSON.stringify(body),
        error: errorMessage,
        source: requestSource
      })
      recordMetrics(`provider-${provider.id}`, provider.id, false, latencyMs)
      
      return reply.status(statusCode).send({ error: errorBody })
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
