/**
 * Codex Unified Endpoint Handler
 * 
 * Implements a unified endpoint approach for Codex Code Switch:
 * - Aggregates models from all enabled providers
 * - Model names use format: provider/model (e.g., deepseek/deepseek-chat)
 * - Parses model name to route to correct provider
 * - Uses OpenAI inbound adapter + dynamic provider outbound adapter
 * 
 * Benefits:
 * - Zero configuration: No model mapping needed
 * - Direct selection: Users see all provider models in Codex UI
 * - Dynamic updates: Adding/removing providers auto-updates model list
 * - Clear naming: provider/model format is self-explanatory
 */

import { randomUUID } from 'crypto'

import { Bridge } from '@amux.ai/llm-bridge'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { LRUCache } from 'lru-cache'

import { decryptApiKey } from '../crypto'
import { getProviderRepository, getCodeModelMappingRepository, getCodeSwitchRepository } from '../database/repositories'
import { logRequest } from '../logger'
import { recordRequest as recordMetrics } from '../metrics'

import { getAdapter, setBridgeUsage, getBridgeUsage } from './bridge-manager'

// ============================================================================
// Default Codex Models
// ============================================================================

import { getDefaultModels } from '../presets/code-switch-preset'

/**
 * Codex 内置的 4 个默认模型（从预设加载）
 * 这些模型需要通过映射配置路由到实际的 provider/model
 */
let DEFAULT_CODEX_MODELS: readonly string[] = []

// 初始化默认模型列表
try {
  DEFAULT_CODEX_MODELS = getDefaultModels('codex').map(m => m.id) as readonly string[]
  console.log('[CodexUnified] Loaded default models from preset:', DEFAULT_CODEX_MODELS)
} catch (error) {
  console.error('[CodexUnified] Failed to load default models from preset, using fallback:', error)
  DEFAULT_CODEX_MODELS = ['gpt-5.2-codex', 'gpt-5.2', 'gpt-5.1-codex-max', 'gpt-5.1-codex-mini'] as const
}

/**
 * 判断是否是 Codex 默认模型
 * 
 * @param modelName - 模型名
 * @returns true 如果是默认模型
 */
function isDefaultCodexModel(modelName: string): boolean {
  return DEFAULT_CODEX_MODELS.includes(modelName as any)
}

// ============================================================================
// Type Definitions
// ============================================================================

interface ChatRequestBody {
  model?: string
  stream?: boolean
  [key: string]: unknown
}

interface OpenAIModel {
  id: string
  object: string
  created: number
  owned_by: string
}

// ============================================================================
// Caches
// ============================================================================

// Model list cache (5 minutes TTL)
const modelListCache = new LRUCache<string, OpenAIModel[]>({
  max: 100,
  ttl: 5 * 60 * 1000 // 5 minutes
})

// Model mapping cache (5 minutes TTL)
const modelMappingCache = new LRUCache<string, string>({
  max: 100,
  ttl: 5 * 60 * 1000, // 5 minutes
  allowStale: false
})

// ============================================================================
// Model Mapping Functions
// ============================================================================

/**
 * 查询默认模型的映射配置
 * 
 * @param modelName - 默认模型名（如 gpt-5.2-codex）
 * @param codeSwitchId - Code Switch 配置 ID（可选）
 * @returns 映射的目标模型（provider/model）或 null
 */
async function getModelMapping(
  modelName: string,
  codeSwitchId?: string
): Promise<string | null> {
  const cacheKey = `${codeSwitchId || 'default'}:${modelName}`
  
  // 检查缓存
  if (modelMappingCache.has(cacheKey)) {
    const cached = modelMappingCache.get(cacheKey)
    console.log(`[CodexUnified] Mapping cache hit: ${modelName} → ${cached}`)
    return cached || null
  }
  
  console.log(`[CodexUnified] Querying mapping for: ${modelName}`)
  
  // 查询数据库
  const repo = getCodeModelMappingRepository()
  
  if (codeSwitchId) {
    const mappings = repo.findActiveByCodeSwitchId(codeSwitchId)
    const mapping = mappings.find(m => m.source_model === modelName)
    const targetModel = mapping?.target_model || null
    
    console.log(`[CodexUnified] Mapping result: ${modelName} → ${targetModel || 'null'}`)
    
    // 缓存结果（只缓存非 null 值）
    if (targetModel) {
      modelMappingCache.set(cacheKey, targetModel)
    }
    return targetModel
  }
  
  console.log(`[CodexUnified] No code switch ID, returning null`)
  return null
}

/**
 * 使映射缓存失效（Provider 变化或映射更新时调用）
 * 
 * @param codeSwitchId - Code Switch 配置 ID（可选，不传则清空所有）
 */
export function invalidateModelMappingCache(codeSwitchId?: string): void {
  if (codeSwitchId) {
    for (const model of DEFAULT_CODEX_MODELS) {
      modelMappingCache.delete(`${codeSwitchId}:${model}`)
    }
    console.log(`[CodexUnified] Model mapping cache cleared for: ${codeSwitchId}`)
  } else {
    modelMappingCache.clear()
    console.log('[CodexUnified] All model mapping cache cleared')
  }
}

/**
 * Parse model name in format "provider/model"
 * 
 * @param modelName - Model name (e.g., "deepseek/deepseek-chat")
 * @returns { provider, model } or { provider: 'default', model: originalName }
 * 
 * @example
 * parseModelName('deepseek/deepseek-chat')
 * // => { provider: 'deepseek', model: 'deepseek-chat' }
 * 
 * parseModelName('gpt-4')  // No prefix, use as-is
 * // => { provider: 'default', model: 'gpt-4' }
 */
export function parseModelName(modelName: string): {
  provider: string
  model: string
} {
  const parts = modelName.split('/')
  
  if (parts.length === 2 && parts[0] && parts[1]) {
    return {
      provider: parts[0],
      model: parts[1]
    }
  }
  
  // No prefix or invalid format, use as-is
  return {
    provider: 'default',
    model: modelName
  }
}

/**
 * Find provider by adapter type name
 * 
 * @param providerName - Provider adapter type (e.g., "deepseek", "moonshot")
 * @returns Provider config or null
 */
async function findProviderByName(providerName: string) {
  const providerRepo = getProviderRepository()
  const allProviders = providerRepo.findAll()
  
  // Find by adapter_type
  return allProviders.find(p => p.adapter_type === providerName && p.enabled) || null
}

/**
 * Fetch models from a single provider
 * 
 * @param provider - Provider config
 * @returns Array of OpenAI-format models
 */
async function fetchProviderModels(provider: any): Promise<OpenAIModel[]> {
  try {
    const decryptedKey = decryptApiKey(provider.api_key)
    if (!decryptedKey) {
      throw new Error('Failed to decrypt API key')
    }
    const apiKey = decryptedKey
    
    const baseUrl = provider.base_url?.replace(/\/$/, '') || ''
    const modelsUrl = `${baseUrl}/v1/models`
    
    console.log(`[CodexUnified] Fetching models from ${provider.name}: ${modelsUrl}`)
    
    const response = await fetch(modelsUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json() as { data?: OpenAIModel[] }
    const models = data.data || []
    
    console.log(`[CodexUnified] Fetched ${models.length} models from ${provider.name}`)
    
    // Add provider prefix to model IDs
    return models.map(m => ({
      ...m,
      id: `${provider.adapter_type}/${m.id}`,
      owned_by: provider.name
    }))
  } catch (error) {
    console.error(`[CodexUnified] Failed to fetch models from ${provider.name}:`, error)
    return []
  }
}

/**
 * Get aggregated model list from all enabled providers
 * Used internally for IPC calls (code-switch:get-aggregated-models)
 * NOT exposed as HTTP endpoint
 * 
 * @returns Array of OpenAI-format models with provider prefix
 */
async function _getAggregatedModels(): Promise<OpenAIModel[]> {
  // Check cache
  const cacheKey = 'all-providers'
  const cached = modelListCache.get(cacheKey)
  if (cached) {
    console.log(`[CodexUnified] Returning cached model list (${cached.length} models)`)
    return cached
  }
  
  console.log('[CodexUnified] Fetching model list from all providers')
  
  const providerRepo = getProviderRepository()
  const allProviders = providerRepo.findAll()
  const enabledProviders = allProviders.filter(p => p.enabled)
  
  console.log(`[CodexUnified] Found ${enabledProviders.length} enabled providers`)
  
  // Fetch models from all providers in parallel
  const results = await Promise.allSettled(
    enabledProviders.map(p => fetchProviderModels(p))
  )
  
  // Flatten results (skip failed providers)
  const models = results
    .filter((r): r is PromiseFulfilledResult<OpenAIModel[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)
  
  console.log(`[CodexUnified] Aggregated ${models.length} models from ${results.length} providers`)
  
  // Cache for 5 minutes
  modelListCache.set(cacheKey, models)
  
  return models
}

// ============================================================================
// Chat Completion Handler
// ============================================================================

/**
 * Handle POST /v1/chat/completions request
 * Parses model name and routes to appropriate provider
 */
export async function handleChatCompletion(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const requestId = randomUUID()
  const startTime = Date.now()
  const requestSource = 'local' // Codex is always local
  
  console.log(`\n[CodexUnified] 📨 POST /v1/chat/completions`)
  console.log(`[CodexUnified]   - Request ID: ${requestId}`)
  
  try {
    // Step 1: Parse request body
    const body = request.body as ChatRequestBody
    const originalModel = body.model || 'gpt-5.2-codex'
    const isStreaming = body.stream === true
    
    console.log(`[CodexUnified]   - Original Model: ${originalModel}`)
    console.log(`[CodexUnified]   - Streaming: ${isStreaming}`)
    
    // Step 2: 检查是否是默认 Codex 模型，如果是则查询映射
    let finalModel = originalModel
    
    if (isDefaultCodexModel(originalModel)) {
      console.log(`[CodexUnified]   - Default Codex model detected`)
      
      // 获取 Codex Code Switch 配置 ID
      // 优先从请求头读取，如果没有则从数据库查询
      let codeSwitchId = request.headers['x-code-switch-id'] as string | undefined
      
      if (!codeSwitchId) {
        try {
          const codeSwitchRepo = getCodeSwitchRepository()
          const codexConfig = codeSwitchRepo.findByCLIType('codex')
          if (codexConfig && codexConfig.enabled === 1) {
            codeSwitchId = codexConfig.id
            console.log(`[CodexUnified]   - Found active Codex config: ${codeSwitchId}`)
          } else {
            console.log(`[CodexUnified]   - No active Codex Code Switch config found`)
          }
        } catch (error) {
          console.error('[CodexUnified] Failed to query Codex config:', error)
        }
      }
      
      // 查询映射（可能为空）
      const mappedModel = await getModelMapping(originalModel, codeSwitchId)
      
      if (mappedModel) {
        console.log(`[CodexUnified]   - Mapping found: ${originalModel} → ${mappedModel}`)
        finalModel = mappedModel
      } else {
        // 默认 Codex 模型必须配置映射才能使用
        console.error(`[CodexUnified] ❌ No mapping configured for default model: ${originalModel}`)
        reply.status(400).send({
          error: {
            message: `Default Codex model '${originalModel}' requires mapping configuration. Please configure model mapping in Amux Desktop (Code Switch → Codex → Model Mapping).`,
            type: 'invalid_request_error',
            code: 'MODEL_MAPPING_REQUIRED',
            details: {
              model: originalModel,
              suggestion: 'Configure a mapping for this model or select a provider/model format (e.g., "deepseek/deepseek-chat")'
            }
          }
        })
        return
      }
    }
    
    // Step 3: Parse model name to get provider and model
    const { provider: providerName, model } = parseModelName(finalModel)
    console.log(`[CodexUnified]   - Parsed: provider=${providerName}, model=${model}`)
    
    // Step 4: Find provider by name
    const provider = await findProviderByName(providerName)
    
    if (!provider) {
      console.error(`[CodexUnified] ❌ Provider not found: ${providerName}`)
      reply.status(404).send({
        error: {
          message: `Provider '${providerName}' not found or not enabled`,
          type: 'invalid_request_error',
          code: 'PROVIDER_NOT_FOUND'
        }
      })
      return
    }
    
    console.log(`[CodexUnified]   - Provider: ${provider.name}`)
    console.log(`[CodexUnified]   - Adapter: ${provider.adapter_type}`)
    
    // Step 5: Get provider API key
    const decryptedKey = provider.api_key ? decryptApiKey(provider.api_key) : null
    if (!decryptedKey) {
      console.error(`[CodexUnified] ❌ Failed to decrypt API key`)
      reply.status(500).send({
        error: {
          message: 'Failed to decrypt provider API key',
          type: 'internal_error',
          code: 'DECRYPTION_ERROR'
        }
      })
      return
    }
    const apiKey = decryptedKey // TypeScript now knows it's not null
    
    // Step 6: Replace model name (remove provider prefix)
    const mappedBody = {
      ...body,
      model
    }
    console.log(`[CodexUnified]   - Model replaced: ${finalModel} → ${model}`)
    
    // Step 7: Create bridge with openai-responses adapter
    // Codex uses Responses API format (wire_api = "responses")
    // Both request and response use Responses API format
    const inboundAdapter = getAdapter('openai-responses')
    const outboundAdapter = getAdapter(provider.adapter_type)
    
    if (!inboundAdapter || !outboundAdapter) {
      console.error(`[CodexUnified] ❌ Failed to get adapters`)
      reply.status(500).send({
        error: {
          message: 'Failed to initialize adapters',
          type: 'internal_error',
          code: 'ADAPTER_ERROR'
        }
      })
      return
    }
    
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
    
    console.log(`[CodexUnified]   - Bridge created: openai-responses → ${provider.adapter_type}`)
    console.log(`[CodexUnified]   - Format: Responses API (wire_api = "responses")`)
    
    // Step 8: Handle request (streaming or non-streaming)
    if (isStreaming) {
      console.log(`[CodexUnified] 🌊 Starting streaming request`)
      
      // Set SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        'X-Request-ID': requestId
      })
      
      try {
        const stream = await bridge.chatStream(mappedBody)
        
        let eventCount = 0
        for await (const event of stream) {
          eventCount++
          // OpenAI Responses adapter outputs Responses API SSE format
          const sseEvent = event as { event?: string; data?: unknown }
          
          // Debug: Log first few events
          if (eventCount <= 3 || sseEvent.event === 'response.completed') {
            console.log(`[CodexUnified] 📤 SSE Event #${eventCount}:`, sseEvent.event)
            if (sseEvent.event === 'response.completed') {
              const data = sseEvent.data as any
              console.log(`[CodexUnified]   - output length:`, data?.response?.output?.length)
              if (data?.response?.output?.[0]) {
                console.log(`[CodexUnified]   - output[0] type:`, data.response.output[0].type)
                console.log(`[CodexUnified]   - output[0] content:`, JSON.stringify(data.response.output[0].content).substring(0, 100))
              }
            }
          }
          
          if (sseEvent.event && sseEvent.data) {
            // Format: event: xxx\ndata: {...}\n\n
            const eventData = typeof sseEvent.data === 'string'
              ? sseEvent.data
              : JSON.stringify(sseEvent.data)
            reply.raw.write(`event: ${sseEvent.event}\ndata: ${eventData}\n\n`)
          } else {
            // Fallback: just write the data
            const eventData = typeof sseEvent === 'string'
              ? sseEvent
              : JSON.stringify(sseEvent)
            reply.raw.write(`data: ${eventData}\n\n`)
          }
        }
        
        reply.raw.end()
        
        console.log(`[CodexUnified] ✅ Streaming completed`)
        
        const usage = getBridgeUsage(bridge)
        const duration = Date.now() - startTime
        
        console.log(`[CodexUnified]   - Duration: ${duration}ms`)
        console.log(`[CodexUnified]   - Tokens: ${JSON.stringify(usage)}`)
        
        // Log request
        logRequest({
          proxyId: undefined,
          proxyPath: 'code/codex',
          sourceModel: originalModel,
          targetModel: model,
          statusCode: 200,
          inputTokens: usage?.promptTokens || 0,
          outputTokens: usage?.completionTokens || 0,
          latencyMs: duration,
          source: requestSource
        })
        
        recordMetrics('code-codex-unified', provider.id, true, duration, usage?.promptTokens, usage?.completionTokens)
      } catch (error) {
        const streamError = error instanceof Error ? error.message : 'Streaming error'
        console.error(`[CodexUnified] ❌ Streaming error:`, error)
        
        if (!reply.raw.headersSent) {
          reply.raw.writeHead(500, { 'Content-Type': 'text/event-stream' })
        }
        
        reply.raw.write(`data: ${JSON.stringify({ error: { message: streamError } })}\n\n`)
        reply.raw.end()
        
        logRequest({
          proxyId: undefined,
          proxyPath: 'code/codex',
          sourceModel: originalModel,
          targetModel: model,
          statusCode: 500,
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: Date.now() - startTime,
          error: streamError,
          source: requestSource
        })
        
        recordMetrics('code-codex-unified', provider.id, false, Date.now() - startTime, 0, 0)
      }
    } else {
      // Non-streaming request
      console.log(`[CodexUnified] 📤 Starting non-streaming request`)
      
      try {
        const response = await bridge.chat(mappedBody)
        const usage = getBridgeUsage(bridge)
        const duration = Date.now() - startTime
        
        console.log(`[CodexUnified] ✅ Request completed`)
        console.log(`[CodexUnified]   - Duration: ${duration}ms`)
        console.log(`[CodexUnified]   - Tokens: ${JSON.stringify(usage)}`)
        
        reply.send(response)
        
        logRequest({
          proxyId: undefined,
          proxyPath: 'code/codex',
          sourceModel: originalModel,
          targetModel: model,
          statusCode: 200,
          inputTokens: usage?.promptTokens || 0,
          outputTokens: usage?.completionTokens || 0,
          latencyMs: duration,
          source: requestSource
        })
        
        recordMetrics('code-codex-unified', provider.id, true, duration, usage?.promptTokens, usage?.completionTokens)
      } catch (error) {
        console.error(`[CodexUnified] ❌ Request error:`, error)
        
        const bridgeError = error as { status?: number; data?: unknown; message?: string }
        const status = bridgeError.status || 500
        const errorData = bridgeError.data || {
          error: {
            message: bridgeError.message || 'Unknown error',
            type: 'api_error'
          }
        }
        
        reply.status(status).send(errorData)
        
        logRequest({
          proxyId: undefined,
          proxyPath: 'code/codex',
          sourceModel: originalModel,
          targetModel: model,
          statusCode: status,
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: Date.now() - startTime,
          error: bridgeError.message || 'Request error',
          source: requestSource
        })
        
        recordMetrics('code-codex-unified', provider.id, false, Date.now() - startTime, 0, 0)
      }
    }
  } catch (error) {
    console.error(`[CodexUnified] ❌ Fatal error:`, error)
    
    reply.status(500).send({
      error: {
        message: error instanceof Error ? error.message : 'Internal server error',
        type: 'internal_error'
      }
    })
    
    logRequest({
      proxyId: undefined,
      proxyPath: 'code/codex',
      sourceModel: 'unknown',
      targetModel: 'unknown',
      statusCode: 500,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Fatal error',
      source: requestSource
    })
    
    recordMetrics('code-codex-unified', 'unknown', false, Date.now() - startTime, 0, 0)
  }
}

/**
 * Invalidate model list cache
 * Call this when providers are added/removed/enabled/disabled
 */
/**
 * Invalidate model list cache (called when providers change)
 * Used by IPC handlers to refresh model list
 */
export function invalidateModelListCache(): void {
  modelListCache.clear()
  console.log('[CodexUnified] Model list cache cleared')
}
