/**
 * LRU Cache for Code Switch configurations
 * Optimizes database lookups for high-frequency proxy requests
 */

import {
  CodeSwitchRepository,
  CodeModelMappingRepository
} from '../database/repositories'
import type { CodeSwitchConfigRow } from '../database/types'

/**
 * Simple LRU Cache implementation
 */
class LRUCache<K, V> {
  private capacity: number
  private cache: Map<K, V>

  constructor(capacity: number) {
    this.capacity = capacity
    this.cache = new Map()
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined
    }

    // Move to end (most recently used)
    const value = this.cache.get(key)!
    this.cache.delete(key)
    this.cache.set(key, value)

    return value
  }

  set(key: K, value: V): void {
    // Delete if exists (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }

    // Evict oldest if at capacity
    if (this.cache.size >= this.capacity) {
      const iterator = this.cache.keys()
      const firstResult = iterator.next()
      if (!firstResult.done) {
        this.cache.delete(firstResult.value)
      }
    }

    this.cache.set(key, value)
  }

  delete(key: K): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }
}

/**
 * Cached Code Switch configuration with model mappings
 */
export interface CachedCodeSwitchConfig {
  config: CodeSwitchConfigRow
  modelMappings: Map<string, string> // sourceModel -> targetModel
  cachedAt: number
}

/**
 * Code Switch Cache Manager
 * Singleton that manages LRU caches for Code Switch configurations
 */
export class CodeSwitchCacheManager {
  // LRU cache for Code Switch configs (key: cliType)
  private configCache: LRUCache<string, CachedCodeSwitchConfig>

  // In-memory model mapping cache for active configs
  private modelMappingCache: Map<string, Map<string, string>> // codeSwitchId -> (sourceModel -> targetModel)

  // Repositories
  private codeSwitchRepo: CodeSwitchRepository
  private modelMappingRepo: CodeModelMappingRepository

  // Cache TTL (5 minutes)
  private readonly CACHE_TTL = 5 * 60 * 1000

  // Singleton instance getter
  static getInstance: () => CodeSwitchCacheManager

  constructor() {
    this.configCache = new LRUCache(10) // Small cache, only 2 CLI types at most
    this.modelMappingCache = new Map()
    this.codeSwitchRepo = new CodeSwitchRepository()
    this.modelMappingRepo = new CodeModelMappingRepository()
  }

  /**
   * Get Code Switch config with model mappings
   * Uses cache if available and not expired
   */
  getConfig(cliType: 'claudecode' | 'codex'): CachedCodeSwitchConfig | null {
    // Check cache first
    const cached = this.configCache.get(cliType)
    if (cached) {
      // Check if expired
      if (Date.now() - cached.cachedAt < this.CACHE_TTL) {
        console.log(`[DEBUG-CACHE] Cache HIT for ${cliType}, mappings:`,
          Array.from(cached.modelMappings.entries()).map(([k, v]) => `${k} -> ${v || '(empty)'}`)
        )
        return cached
      }
      // Expired, remove from cache
      console.log(`[DEBUG-CACHE] Cache EXPIRED for ${cliType}`)
      this.configCache.delete(cliType)
    } else {
      console.log(`[DEBUG-CACHE] Cache MISS for ${cliType}`)
    }

    // Fetch from database
    const config = this.codeSwitchRepo.findByCLIType(cliType)
    if (!config || !config.enabled) {
      console.log(`[DEBUG-CACHE] DB lookup: config=${config ? 'found' : 'null'}, enabled=${config?.enabled}, returning null`)
      return null
    }

    // Fetch active model mappings
    const mappings = this.modelMappingRepo.findActiveByCodeSwitchId(config.id)
    console.log(`[DEBUG-CACHE] DB lookup: found ${mappings.length} active mappings for config ${config.id}`)
    const modelMappings = new Map<string, string>()
    for (const mapping of mappings) {
      modelMappings.set(mapping.source_model, mapping.target_model)
    }
    console.log(`[DEBUG-CACHE] Loaded mappings:`,
      Array.from(modelMappings.entries()).map(([k, v]) => `${k} -> ${v || '(empty)'}`)
    )

    // Cache it
    const cachedConfig: CachedCodeSwitchConfig = {
      config,
      modelMappings,
      cachedAt: Date.now()
    }

    this.configCache.set(cliType, cachedConfig)
    this.modelMappingCache.set(config.id, modelMappings)

    return cachedConfig
  }

  /**
   * Invalidate cache for a CLI type
   * Called when configuration is updated
   */
  invalidate(cliType: 'claudecode' | 'codex'): void {
    console.log(`[DEBUG-CACHE] Invalidating cache for ${cliType}`)
    this.configCache.delete(cliType)

    // Also clean up model mapping cache
    const config = this.codeSwitchRepo.findByCLIType(cliType)
    if (config) {
      this.modelMappingCache.delete(config.id)
    }
  }

  /**
   * Invalidate all caches
   */
  invalidateAll(): void {
    this.configCache.clear()
    this.modelMappingCache.clear()
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      configCacheSize: this.configCache.size(),
      modelMappingCacheSize: this.modelMappingCache.size,
      ttl: this.CACHE_TTL
    }
  }
}

// Singleton instance
let cacheManager: CodeSwitchCacheManager | null = null

/**
 * Get singleton instance of Code Switch cache manager
 */
CodeSwitchCacheManager.getInstance = function(): CodeSwitchCacheManager {
  if (!cacheManager) {
    cacheManager = new CodeSwitchCacheManager()
  }
  return cacheManager
}

/**
 * Get Code Switch cache manager instance (deprecated, use CodeSwitchCacheManager.getInstance())
 */
export function getCodeSwitchCache(): CodeSwitchCacheManager {
  return CodeSwitchCacheManager.getInstance()
}

/**
 * Invalidate cache for a CLI type
 * Helper function for external use
 */
export function invalidateCodeSwitchCache(cliType: 'claudecode' | 'codex'): void {
  getCodeSwitchCache().invalidate(cliType)
}

/**
 * Invalidate all Code Switch caches
 */
export function invalidateAllCodeSwitchCaches(): void {
  getCodeSwitchCache().invalidateAll()
}
