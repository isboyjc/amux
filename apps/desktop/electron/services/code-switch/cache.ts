/**
 * LRU Cache for Code Switch configurations
 * Optimizes database lookups for high-frequency proxy requests
 */

import {
  CodeSwitchRepository,
  CodeModelMappingRepository
} from '../database/repositories'
import type { CodeSwitchConfigRow } from '../database/types'
import { getCLIPreset } from '../presets/code-switch-preset'

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
 * Cached Code Switch configuration with model mappings by type
 */
export interface FamilyMapping {
  family: string
  targetModel: string
  priority: number
}

export interface CachedCodeSwitchConfig {
  config: CodeSwitchConfigRow
  /** Exact model ID -> target model */
  exactMappings: Map<string, string>
  /** Family mappings sorted by priority (lower = higher priority) */
  familyMappings: FamilyMapping[]
  /** Target model when thinking is enabled; null if not set */
  reasoningModel: string | null
  /** Fallback target model for all other requests; null if not set */
  defaultModel: string | null
  cachedAt: number
}

/**
 * Code Switch Cache Manager
 * Singleton that manages LRU caches for Code Switch configurations
 */
export class CodeSwitchCacheManager {
  // LRU cache for Code Switch configs (key: cliType)
  private configCache: LRUCache<string, CachedCodeSwitchConfig>

  // Repositories
  private codeSwitchRepo: CodeSwitchRepository
  private modelMappingRepo: CodeModelMappingRepository

  // Cache TTL (5 minutes)
  private readonly CACHE_TTL = 5 * 60 * 1000

  // Singleton instance getter
  static getInstance: () => CodeSwitchCacheManager

  constructor() {
    this.configCache = new LRUCache(10) // Small cache, only 2 CLI types at most
    this.codeSwitchRepo = new CodeSwitchRepository()
    this.modelMappingRepo = new CodeModelMappingRepository()
  }

  /**
   * Get Code Switch config with model mappings
   * Uses cache if available and not expired
   */
  getConfig(cliType: string): CachedCodeSwitchConfig | null {
    // Check cache first
    const cached = this.configCache.get(cliType)
    if (cached) {
      // Check if expired
      if (Date.now() - cached.cachedAt < this.CACHE_TTL) {
        return cached
      }
      // Expired, remove from cache
      this.configCache.delete(cliType)
    }

    // Fetch from database
    const config = this.codeSwitchRepo.findByCLIType(cliType)
    if (!config || !config.enabled) {
      return null
    }

    // Fetch active model mappings for current provider only (filter by provider_id)
    const allActive = this.modelMappingRepo.findActiveByCodeSwitchId(config.id)
    const mappings = allActive.filter((m) => m.provider_id === config.provider_id)
    const exactMappings = new Map<string, string>()
    const familyMappingsRaw: FamilyMapping[] = []
    let reasoningModel: string | null = null
    let defaultModel: string | null = null

    // Load preset family priorities for sorting
    const preset = getCLIPreset(cliType)
    const familyPriorityMap = new Map<string, number>()
    if (preset?.modelFamilies) {
      for (const fam of preset.modelFamilies) {
        for (const keyword of fam.keywords) {
          familyPriorityMap.set(keyword.toLowerCase(), fam.priority)
        }
      }
    }

    for (const mapping of mappings) {
      const mt = mapping.mapping_type ?? 'exact'
      switch (mt) {
        case 'exact':
          exactMappings.set(mapping.source_model, mapping.target_model)
          break
        case 'family': {
          const priority = familyPriorityMap.get(mapping.source_model.toLowerCase()) ?? 99
          familyMappingsRaw.push({
            family: mapping.source_model,
            targetModel: mapping.target_model,
            priority
          })
          break
        }
        case 'reasoning':
          reasoningModel = mapping.target_model
          break
        case 'default':
          defaultModel = mapping.target_model
          break
        default:
          exactMappings.set(mapping.source_model, mapping.target_model)
      }
    }

    // Sort family mappings by priority (lower = higher priority)
    const familyMappings = familyMappingsRaw.sort((a, b) => a.priority - b.priority)

    const cachedConfig: CachedCodeSwitchConfig = {
      config,
      exactMappings,
      familyMappings,
      reasoningModel,
      defaultModel,
      cachedAt: Date.now()
    }

    this.configCache.set(cliType, cachedConfig)
    return cachedConfig
  }

  /**
   * Invalidate cache for a CLI type
   * Called when configuration is updated
   */
  invalidate(cliType: string): void {
    this.configCache.delete(cliType)
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
 * Get Code Switch cache manager instance
 */
export function getCodeSwitchCache(): CodeSwitchCacheManager {
  return CodeSwitchCacheManager.getInstance()
}

/**
 * Invalidate cache for a CLI type
 * Helper function for external use
 */
export function invalidateCodeSwitchCache(cliType: string): void {
  getCodeSwitchCache().invalidate(cliType)
}
