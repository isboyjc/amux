/**
 * CLI Code Switch 缓存
 * 为每个 CLI 独立缓存配置和模型映射，优化代理请求性能
 */

import { LRUCache } from 'lru-cache'
import { CliType } from '../../types/cli'
import { getCliCodeSwitchConfigRepository } from '../database/repositories/cli-code-switch-config'
import { getCliProviderModelMappingRepository } from '../database/repositories/cli-provider-model-mapping'
import { getProviderRepository } from '../database/repositories/provider'

/**
 * Family 映射配置
 */
export interface FamilyMappingConfig {
  keywords: string[]
  targetModel: string
  priority: number
}

/**
 * 缓存的 CLI 配置
 */
export interface CachedCliConfig {
  cliType: CliType
  enabled: boolean
  providerId: string | null
  providerName: string | null
  providerApiKey: string | null
  providerBaseUrl: string | null
  providerAdapterType: string | null

  // 模型映射
  exactMappings: Map<string, string>
  familyMappings: FamilyMappingConfig[]
  reasoningModel: string | null
  defaultModel: string | null

  cachedAt: number
}

/**
 * 每个 CLI 一个独立的 LRU 缓存实例
 */
const cliCaches = new Map<CliType, LRUCache<string, CachedCliConfig>>()

/**
 * 获取或创建指定 CLI 的缓存实例
 */
function getOrCreateCache(cliType: CliType): LRUCache<string, CachedCliConfig> {
  if (!cliCaches.has(cliType)) {
    cliCaches.set(
      cliType,
      new LRUCache<string, CachedCliConfig>({
        max: 5, // 每个 CLI 缓存 5 个配置（实际只需 1 个，预留空间）
        ttl: 1000 * 60 * 5, // 5 分钟 TTL
      })
    )
  }
  return cliCaches.get(cliType)!
}

/**
 * 获取 CLI 的缓存配置
 * 如果缓存未命中，从数据库加载
 */
export function getCliCodeSwitchCache(cliType: CliType): CachedCliConfig | null {
  const cache = getOrCreateCache(cliType)
  const cacheKey = cliType // 每个 CLI 只有一个配置

  // 尝试从缓存获取
  const cached = cache.get(cacheKey)
  if (cached) {
    return cached
  }

  // 缓存未命中，从数据库加载
  return loadFromDatabase(cliType, cache, cacheKey)
}

/**
 * 从数据库加载配置并缓存
 */
function loadFromDatabase(
  cliType: CliType,
  cache: LRUCache<string, CachedCliConfig>,
  cacheKey: string
): CachedCliConfig | null {
  const configRepo = getCliCodeSwitchConfigRepository()
  const mappingRepo = getCliProviderModelMappingRepository()
  const providerRepo = getProviderRepository()

  // 1. 加载 CLI 配置
  const cliConfig = configRepo.findByCliType(cliType)
  if (!cliConfig || cliConfig.enabled !== 1) {
    return null // CLI 未启用
  }

  const providerId = cliConfig.current_provider_id
  if (!providerId) {
    return null // 未选择供应商
  }

  // 2. 加载供应商信息
  const provider = providerRepo.findById(providerId)
  if (!provider) {
    console.error(`[Cache] 供应商不存在: ${providerId}`)
    return null
  }

  // 3. 加载活动映射
  const mappings = mappingRepo.findActive(cliType, providerId)

  // 4. 解析映射到不同类型
  const exactMappings = new Map<string, string>()
  const familyMappings: FamilyMappingConfig[] = []
  let reasoningModel: string | null = null
  let defaultModel: string | null = null

  for (const mapping of mappings) {
    const mappingType = mapping.mapping_type

    if (mappingType === 'exact' && mapping.source_model) {
      exactMappings.set(mapping.source_model, mapping.target_model)
    } else if (mappingType === 'family' && mapping.keywords) {
      try {
        const keywords = JSON.parse(mapping.keywords) as string[]
        familyMappings.push({
          keywords,
          targetModel: mapping.target_model,
          priority: mapping.priority,
        })
      } catch (error) {
        console.error(`[Cache] 解析 family 映射关键词失败:`, error)
      }
    } else if (mappingType === 'reasoning') {
      reasoningModel = mapping.target_model
    } else if (mappingType === 'default') {
      defaultModel = mapping.target_model
    }
  }

  // 5. 按优先级排序 family 映射（低优先级值 = 高优先级）
  familyMappings.sort((a, b) => a.priority - b.priority)

  // 6. 构建缓存对象
  const cached: CachedCliConfig = {
    cliType,
    enabled: true,
    providerId,
    providerName: provider.name,
    providerApiKey: provider.api_key,
    providerBaseUrl: provider.base_url,
    providerAdapterType: provider.adapter_type,
    exactMappings,
    familyMappings,
    reasoningModel,
    defaultModel,
    cachedAt: Date.now(),
  }

  // 7. 存入缓存
  cache.set(cacheKey, cached)

  return cached
}

/**
 * 使指定 CLI 的缓存失效
 */
export function invalidateCliCodeSwitchCache(cliType: CliType): void {
  const cache = cliCaches.get(cliType)
  if (cache) {
    cache.clear()
  }
}

/**
 * 清空所有 CLI 的缓存
 */
export function clearAllCliCodeSwitchCaches(): void {
  for (const cache of cliCaches.values()) {
    cache.clear()
  }
}

/**
 * 获取缓存统计信息
 */
export function getCacheStats(): Record<CliType, { size: number; maxSize: number }> {
  const stats: Partial<Record<CliType, { size: number; maxSize: number }>> = {}

  for (const [cliType, cache] of cliCaches.entries()) {
    stats[cliType] = {
      size: cache.size,
      maxSize: cache.max,
    }
  }

  return stats as Record<CliType, { size: number; maxSize: number }>
}

/**
 * 预热缓存（服务器启动时调用）
 * 为所有已启用的 CLI 预加载配置
 */
export function warmupCliCodeSwitchCache(): void {
  const configRepo = getCliCodeSwitchConfigRepository()
  const allConfigs = configRepo.findAllEnabled()
  
  console.log(`[Cache] 预热 CLI Code Switch 缓存，启用的 CLI 数量: ${allConfigs.length}`)
  
  for (const config of allConfigs) {
    const cliType = config.cli_type as CliType
    // 调用 getCliCodeSwitchCache 会自动加载并缓存
    const cached = getCliCodeSwitchCache(cliType)
    
    if (cached) {
      console.log(`[Cache]   ✅ 已缓存: ${cliType} -> ${cached.providerName || 'N/A'}`)
    } else {
      console.log(`[Cache]   ⚠️  无法加载: ${cliType}`)
    }
  }
}
