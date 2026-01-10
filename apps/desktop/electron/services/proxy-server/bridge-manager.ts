/**
 * Bridge Manager - Manages Bridge instances with LRU caching
 */

import { Bridge } from '@amux/llm-bridge'
import { OpenAIAdapter } from '@amux/adapter-openai'
import { AnthropicAdapter } from '@amux/adapter-anthropic'
import { DeepSeekAdapter } from '@amux/adapter-deepseek'
import { MoonshotAdapter } from '@amux/adapter-moonshot'
import { QwenAdapter } from '@amux/adapter-qwen'
import { ZhipuAdapter } from '@amux/adapter-zhipu'
import { GoogleAdapter } from '@amux/adapter-google'
import { getBridgeProxyRepository, getProviderRepository } from '../database/repositories'
import { decryptApiKey } from '../crypto'
import type { BridgeProxyRow, ProviderRow } from '../database/types'

// Adapter type to class mapping
const ADAPTER_MAP: Record<string, new () => unknown> = {
  openai: OpenAIAdapter,
  anthropic: AnthropicAdapter,
  deepseek: DeepSeekAdapter,
  moonshot: MoonshotAdapter,
  qwen: QwenAdapter,
  zhipu: ZhipuAdapter,
  google: GoogleAdapter
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

/**
 * Create an adapter instance by type
 */
function createAdapter(adapterType: string): unknown {
  const AdapterClass = ADAPTER_MAP[adapterType]
  if (!AdapterClass) {
    throw new Error(`Unknown adapter type: ${adapterType}`)
  }
  return new AdapterClass()
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
    console.log(`[BridgeManager] Evicted LRU entry: ${oldestKey}`)
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
 */
export function getBridge(proxyId: string): {
  bridge: Bridge
  proxy: BridgeProxyRow
  provider: ProviderRow
} {
  const { chain, provider } = resolveProxyChain(proxyId)
  const proxy = chain[0] // First proxy is the entry point
  
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
  
  // Get decrypted API key
  const apiKey = provider.api_key ? decryptApiKey(provider.api_key) : undefined
  
  // Create adapters
  const inboundAdapter = createAdapter(proxy.inbound_adapter)
  const outboundAdapter = createAdapter(provider.adapter_type)
  
  // Create bridge
  const bridge = new Bridge({
    inbound: inboundAdapter as Parameters<typeof Bridge.prototype.constructor>[0]['inbound'],
    outbound: outboundAdapter as Parameters<typeof Bridge.prototype.constructor>[0]['outbound'],
    outboundConfig: {
      apiKey,
      baseUrl: provider.base_url ?? undefined
    }
  })
  
  // Cache the bridge
  bridgeCache.set(cacheKey, {
    bridge,
    lastUsed: Date.now(),
    proxyId,
    providerId: provider.id
  })
  
  console.log(`[BridgeManager] Created bridge for proxy ${proxy.proxy_path}`)
  
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
    console.log(`[BridgeManager] Invalidated cache for proxy: ${proxyId}`)
  } else {
    // Invalidate all
    bridgeCache.clear()
    console.log('[BridgeManager] Cache cleared')
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
  console.log(`[BridgeManager] Invalidated cache for provider: ${providerId}`)
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
