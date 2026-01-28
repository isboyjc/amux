/**
 * Bridge Manager - Manages Bridge instances with LRU caching
 */

import { anthropicAdapter } from '@amux.ai/adapter-anthropic'
import { deepseekAdapter } from '@amux.ai/adapter-deepseek'
import { googleAdapter } from '@amux.ai/adapter-google'
import { minimaxAdapter } from '@amux.ai/adapter-minimax'
import { moonshotAdapter } from '@amux.ai/adapter-moonshot'
import { openaiAdapter, openaiResponsesAdapter } from '@amux.ai/adapter-openai'
import { qwenAdapter } from '@amux.ai/adapter-qwen'
import { zhipuAdapter } from '@amux.ai/adapter-zhipu'
import { Bridge, type LLMAdapter, type LLMResponseIR, type LLMStreamEvent } from '@amux.ai/llm-bridge'

import { decryptApiKey } from '../crypto'
import { getBridgeProxyRepository, getProviderRepository } from '../database/repositories'
import type { BridgeProxyRow, ProviderRow } from '../database/types'

// Adapter type to instance mapping (adapters are exported as singleton instances)
const ADAPTER_MAP: Record<string, LLMAdapter> = {
  openai: openaiAdapter,
  'openai-responses': openaiResponsesAdapter,
  anthropic: anthropicAdapter,
  deepseek: deepseekAdapter,
  minimax: minimaxAdapter,
  moonshot: moonshotAdapter,
  qwen: qwenAdapter,
  zhipu: zhipuAdapter,
  google: googleAdapter
}

// Bridge cache entry
interface BridgeCacheEntry {
  bridge: Bridge
  lastUsed: number
  proxyId: string
  providerId: string
}

// Maximum cache size
const MAX_CACHE_SIZE = 50

// Bridge cache
const bridgeCache = new Map<string, BridgeCacheEntry>()

// WeakMap to store usage data for bridges (avoids type casting)
const bridgeUsageMap = new WeakMap<Bridge, LLMResponseIR['usage']>()

/**
 * Get the last usage data for a bridge
 */
export function getBridgeUsage(bridge: Bridge): LLMResponseIR['usage'] | undefined {
  return bridgeUsageMap.get(bridge)
}

/**
 * Set usage data for a bridge
 */
export function setBridgeUsage(bridge: Bridge, usage: LLMResponseIR['usage']): void {
  if (usage) {
    bridgeUsageMap.set(bridge, usage)
  }
}

/**
 * Get adapter instance by type
 * Adapters are singleton instances, not classes
 */
export function getAdapter(adapterType: string): LLMAdapter {
  
  const adapter = ADAPTER_MAP[adapterType]
  if (!adapter) {
    console.error(`[BridgeManager] Unknown adapter type: "${adapterType}". Available: ${Object.keys(ADAPTER_MAP).join(', ')}`)
    throw new Error(`Unknown adapter type: ${adapterType}`)
  }
  
  return adapter
}

/**
 * Generate cache key for a bridge
 */
function getCacheKey(proxyId: string, providerId: string): string {
  return `${proxyId}:${providerId}`
}

/**
 * Evict least recently used entries if cache is full
 */
function evictLRU(): void {
  if (bridgeCache.size < MAX_CACHE_SIZE) {
    return
  }

  // Find least recently used entry
  let oldestKey: string | null = null
  let oldestTime = Infinity

  for (const [key, entry] of bridgeCache) {
    if (entry.lastUsed < oldestTime) {
      oldestTime = entry.lastUsed
      oldestKey = key
    }
  }

  if (oldestKey) {
    bridgeCache.delete(oldestKey)
  }
}

/**
 * Resolve proxy chain to get final provider
 * Returns array of proxies in chain order and the final provider
 */
export function resolveProxyChain(proxyId: string): {
  chain: BridgeProxyRow[]
  provider: ProviderRow
} {
  const proxyRepo = getBridgeProxyRepository()
  const providerRepo = getProviderRepository()
  
  const chain: BridgeProxyRow[] = []
  const visited = new Set<string>()
  let currentId: string | null = proxyId

  while (currentId) {
    if (visited.has(currentId)) {
      throw new Error(`Circular dependency detected in proxy chain`)
    }
    
    const proxy = proxyRepo.findById(currentId)
    if (!proxy) {
      throw new Error(`Proxy not found: ${currentId}`)
    }
    
    if (!proxy.enabled) {
      throw new Error(`Proxy is disabled: ${proxy.proxy_path}`)
    }
    
    visited.add(currentId)
    chain.push(proxy)
    
    if (proxy.outbound_type === 'provider') {
      // Found the provider
      const provider = providerRepo.findById(proxy.outbound_id)
      if (!provider) {
        throw new Error(`Provider not found: ${proxy.outbound_id}`)
      }
      if (!provider.enabled) {
        throw new Error(`Provider is disabled: ${provider.name}`)
      }
      
      return { chain, provider }
    }
    
    // Continue to next proxy
    currentId = proxy.outbound_id
  }
  
  throw new Error('Invalid proxy chain: no provider found')
}

/**
 * Get or create a Bridge instance
 * @param proxyId - The proxy ID
 * @param requestApiKey - Optional API key from request (for pass-through mode)
 */
export function getBridge(proxyId: string, requestApiKey?: string): {
  bridge: Bridge
  proxy: BridgeProxyRow
  provider: ProviderRow
} {
  const { chain, provider } = resolveProxyChain(proxyId)
  const proxy = chain[0] // First proxy is the entry point
  
  if (!proxy) {
    throw new Error(`No proxy found in chain for: ${proxyId}`)
  }
  
  // Determine API key to use:
  // - If requestApiKey is provided: use it directly (pass-through mode)
  // - Otherwise: use provider's stored API key (default mode or platform key mode)
  let apiKey: string | undefined
  let isPassThrough = false
  
  if (requestApiKey) {
    // Pass-through mode: use the API key from request directly
    apiKey = requestApiKey
    isPassThrough = true
  } else {
    // Use provider's stored API key
    if (provider.api_key) {
      apiKey = decryptApiKey(provider.api_key)
      if (!apiKey) {
        console.warn(`[BridgeManager] Provider has encrypted API key but decryption failed - using empty key`)
      }
    } else {
      apiKey = undefined
      console.warn(`[BridgeManager] Provider has no API key configured`)
    }
  }
  
  // For pass-through mode, don't cache (API key varies per request)
  if (isPassThrough) {
    // Get adapters
    const inboundAdapter = getAdapter(proxy.inbound_adapter)
    const outboundAdapter = getAdapter(provider.adapter_type)
    
    // Create bridge without caching
    const bridge = new Bridge({
      inbound: inboundAdapter,
      outbound: outboundAdapter,
      config: {
        apiKey: apiKey || '',
        baseURL: provider.base_url ?? undefined
      },
      // ⭐ 使用钩子系统提取 Token（统一的 IR 格式！）
      hooks: {
        onResponse: async (ir: LLMResponseIR) => {
          // Token 已经是统一格式，无需区分 Provider！
          if (ir.usage) {
            // 可以在这里记录到全局变量或直接传递给日志系统
            // 这里先存储起来，让 routes.ts 可以访问
            bridgeUsageMap.set(bridge, ir.usage)
          }
        },
        onStreamEvent: async (event: LLMStreamEvent) => {
          // 流式响应中的 Token 也是统一格式
          if (event.type === 'end' && event.usage) {
            bridgeUsageMap.set(bridge, event.usage)
          }
        }
      }
    })
    
    
    return { bridge, proxy, provider }
  }
  
  // For cached mode (unified key or provider key)
  const cacheKey = getCacheKey(proxyId, provider.id)
  
  // Check cache
  const cached = bridgeCache.get(cacheKey)
  if (cached) {
    cached.lastUsed = Date.now()
    return {
      bridge: cached.bridge,
      proxy,
      provider
    }
  }
  
  // Create new bridge
  evictLRU()
  
  // Get adapters
  const inboundAdapter = getAdapter(proxy.inbound_adapter)
  const outboundAdapter = getAdapter(provider.adapter_type)
  
  // Create bridge
  const bridge = new Bridge({
    inbound: inboundAdapter,
    outbound: outboundAdapter,
    config: {
      apiKey: apiKey || '',
      baseURL: provider.base_url ?? undefined
    },
    // ⭐ 使用钩子系统提取 Token（统一的 IR 格式！）
    hooks: {
      onResponse: async (ir: LLMResponseIR) => {
        // Token 已经是统一格式，无需区分 Provider！
        if (ir.usage) {
          // 存储到 bridge 实例上，供 routes.ts 访问
          bridgeUsageMap.set(bridge, ir.usage)
        }
      },
      onStreamEvent: async (event: LLMStreamEvent) => {
        // 流式响应中的 Token 也是统一格式
        if (event.type === 'end' && event.usage) {
          bridgeUsageMap.set(bridge, event.usage)
        }
      }
    }
  })
  
  // Cache the bridge
  bridgeCache.set(cacheKey, {
    bridge,
    lastUsed: Date.now(),
    proxyId,
    providerId: provider.id
  })
  
  
  return { bridge, proxy, provider }
}

/**
 * Invalidate cache for a specific proxy or all
 */
export function invalidateCache(proxyId?: string): void {
  if (proxyId) {
    // Invalidate specific proxy
    for (const [key, entry] of bridgeCache) {
      if (entry.proxyId === proxyId) {
        bridgeCache.delete(key)
      }
    }
  } else {
    // Invalidate all
    bridgeCache.clear()
  }
}

/**
 * Invalidate cache for a specific provider
 */
export function invalidateProviderCache(providerId: string): void {
  for (const [key, entry] of bridgeCache) {
    if (entry.providerId === providerId) {
      bridgeCache.delete(key)
    }
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  size: number
  maxSize: number
  entries: Array<{
    proxyId: string
    providerId: string
    lastUsed: number
  }>
} {
  const entries = Array.from(bridgeCache.values()).map(entry => ({
    proxyId: entry.proxyId,
    providerId: entry.providerId,
    lastUsed: entry.lastUsed
  }))
  
  return {
    size: bridgeCache.size,
    maxSize: MAX_CACHE_SIZE,
    entries
  }
}
