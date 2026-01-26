/**
 * Proxy IPC handlers
 */

import { ipcMain } from 'electron'

import {
  getBridgeProxyRepository,
  getModelMappingRepository,
  getProviderRepository,
  type CreateProxyDTO,
  type UpdateProxyDTO
} from '../services/database/repositories'
import { invalidateCache } from '../services/proxy-server/bridge-manager'
import { decryptApiKey } from '../services/crypto'
import type { BridgeProxyRow, ModelMappingRow } from '../services/database/types'
import { trackProxyCreated, trackProxyDeleted } from '../services/analytics'

// Convert DB row to BridgeProxy object
function toProxy(row: BridgeProxyRow) {
  return {
    id: row.id,
    name: row.name,
    inboundAdapter: row.inbound_adapter,
    outboundType: row.outbound_type as 'provider' | 'proxy',
    outboundId: row.outbound_id,
    proxyPath: row.proxy_path,
    enabled: row.enabled === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

// Convert DB row to ModelMapping object
function toMapping(row: ModelMappingRow) {
  return {
    id: row.id,
    proxyId: row.proxy_id,
    sourceModel: row.source_model,
    targetModel: row.target_model,
    isDefault: row.is_default === 1
  }
}

export function registerProxyHandlers(): void {
  const proxyRepo = getBridgeProxyRepository()
  const mappingRepo = getModelMappingRepository()

  // List all proxies
  ipcMain.handle('proxy:list', async () => {
    const rows = proxyRepo.findAll()
    return rows.map(toProxy)
  })

  // Get proxy by ID
  ipcMain.handle('proxy:get', async (_event, id: string) => {
    const row = proxyRepo.findById(id)
    return row ? toProxy(row) : null
  })

  // Create proxy
  ipcMain.handle('proxy:create', async (_event, data: CreateProxyDTO & {
    modelMappings?: Array<{
      sourceModel: string
      targetModel: string
      isDefault?: boolean
    }>
  }) => {
    const row = proxyRepo.create({
      name: data.name,
      inboundAdapter: data.inboundAdapter,
      outboundType: data.outboundType,
      outboundId: data.outboundId,
      proxyPath: data.proxyPath,
      enabled: data.enabled
    })

    // Create model mappings if provided
    if (data.modelMappings && data.modelMappings.length > 0) {
      for (const mapping of data.modelMappings) {
        mappingRepo.create({
          proxyId: row.id,
          sourceModel: mapping.sourceModel,
          targetModel: mapping.targetModel,
          isDefault: mapping.isDefault
        })
      }
    }

    // 追踪 Proxy 创建（异步，不阻塞）
    setImmediate(() => {
      try {
        trackProxyCreated(data.inboundAdapter, data.outboundType)
      } catch (e) {
        // 静默失败，不影响功能
      }
    })

    return toProxy(row)
  })

  // Update proxy
  ipcMain.handle('proxy:update', async (_event, id: string, data: UpdateProxyDTO) => {
    const row = proxyRepo.update(id, data)
    if (row) {
      // Invalidate bridge cache
      invalidateCache(id)
    }
    return row ? toProxy(row) : null
  })

  // Delete proxy
  ipcMain.handle('proxy:delete', async (_event, id: string) => {
    const result = proxyRepo.delete(id)
    if (result) {
      // Invalidate bridge cache
      invalidateCache(id)
      
      // 追踪 Proxy 删除（异步，不阻塞）
      setImmediate(() => {
        try {
          trackProxyDeleted()
        } catch (e) {
          // 静默失败，不影响功能
        }
      })
    }
    return result
  })

  // Toggle proxy enabled
  ipcMain.handle('proxy:toggle', async (_event, id: string, enabled: boolean) => {
    const result = proxyRepo.toggleEnabled(id, enabled)
    if (result) {
      invalidateCache(id)
    }
    return result
  })

  // Validate proxy path
  ipcMain.handle('proxy:validate-path', async (_event, path: string, excludeId?: string) => {
    return proxyRepo.isPathUnique(path, excludeId)
  })

  // Check circular dependency
  ipcMain.handle('proxy:check-circular', async (_event, proxyId: string, outboundId: string) => {
    return proxyRepo.checkCircularDependency(proxyId, outboundId)
  })

  // Get model mappings for proxy
  ipcMain.handle('proxy:get-mappings', async (_event, proxyId: string) => {
    const rows = mappingRepo.findByProxyId(proxyId)
    return rows.map(toMapping)
  })

  // Set model mappings for proxy
  ipcMain.handle('proxy:set-mappings', async (_event, proxyId: string, mappings: Array<{
    sourceModel: string
    targetModel: string
    isDefault?: boolean
  }>) => {
    const rows = mappingRepo.bulkCreate(proxyId, mappings)
    // Invalidate bridge cache
    invalidateCache(proxyId)
    return rows.map(toMapping)
  })

  // Test proxy connectivity (Level 1 + Level 2)
  ipcMain.handle('proxy:test', async (_event, proxyId: string) => {
    const startTime = Date.now()
    
    try {
      // Level 1: Configuration Check
      const configCheck = await performConfigCheck(proxyId, proxyRepo)
      if (!configCheck.success) {
        return {
          success: false,
          error: configCheck.error,
          details: configCheck.details
        }
      }

      // Level 2: Health Check - Find bottom provider
      const bottomProvider = await findBottomProvider(proxyId, proxyRepo)
      if (!bottomProvider) {
        return {
          success: false,
          error: 'Failed to resolve bottom provider',
          details: 'Cannot find the underlying provider for this proxy chain'
        }
      }

      const providerRepo = getProviderRepository()
      const provider = providerRepo.findById(bottomProvider.providerId)
      if (!provider) {
        return {
          success: false,
          error: 'Provider not found',
          details: `Provider ${bottomProvider.providerId} does not exist`
        }
      }

      // Test provider health
      const apiKey = provider.api_key ? decryptApiKey(provider.api_key) : ''
      if (!apiKey) {
        return {
          success: false,
          error: 'API Key not configured',
          details: `Bottom provider "${provider.name}" (${provider.adapter_type}) has no API key`
        }
      }

      const baseUrl = provider.base_url || getDefaultBaseUrl(provider.adapter_type)
      const modelsPath = provider.models_path || '/v1/models'

      try {
        const response = await fetch(`${baseUrl}${modelsPath}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(10000)
        })

        const latency = Date.now() - startTime

        if (!response.ok) {
          return {
            success: false,
            error: `HTTP ${response.status}`,
            details: `Bottom provider "${provider.name}" returned ${response.status}: ${response.statusText}`,
            latency,
            provider: {
              name: provider.name,
              type: provider.adapter_type
            }
          }
        }

        return {
          success: true,
          latency,
          provider: {
            name: provider.name,
            type: provider.adapter_type
          },
          details: `All checks passed. Bottom provider: ${provider.name}`
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Network error',
          details: `Failed to connect to bottom provider "${provider.name}"`,
          latency: Date.now() - startTime,
          provider: {
            name: provider.name,
            type: provider.adapter_type
          }
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Test failed',
        details: 'Unexpected error during test',
        latency: Date.now() - startTime
      }
    }
  })
}

/**
 * Level 1: Configuration Check
 */
async function performConfigCheck(
  proxyId: string,
  proxyRepo: ReturnType<typeof getBridgeProxyRepository>
): Promise<{ success: boolean; error?: string; details?: string }> {
  const proxy = proxyRepo.findById(proxyId)
  if (!proxy) {
    return { success: false, error: 'Proxy not found', details: 'The proxy configuration does not exist' }
  }

  // Check if proxy path is unique
  if (!proxyRepo.isPathUnique(proxy.proxy_path, proxy.id)) {
    return { success: false, error: 'Proxy path conflict', details: 'Proxy path is already in use' }
  }

  // Check outbound target
  if (proxy.outbound_type === 'provider') {
    const providerRepo = getProviderRepository()
    const provider = providerRepo.findById(proxy.outbound_id)
    if (!provider) {
      return { success: false, error: 'Provider not found', details: 'The target provider does not exist' }
    }
    if (!provider.enabled) {
      return { success: false, error: 'Provider disabled', details: `Provider "${provider.name}" is disabled` }
    }
  } else if (proxy.outbound_type === 'proxy') {
    const targetProxy = proxyRepo.findById(proxy.outbound_id)
    if (!targetProxy) {
      return { success: false, error: 'Target proxy not found', details: 'The target proxy does not exist' }
    }
    if (!targetProxy.enabled) {
      return { success: false, error: 'Target proxy disabled', details: `Target proxy "${targetProxy.name}" is disabled` }
    }
    
    // Check for circular dependency
    if (proxyRepo.checkCircularDependency(proxy.id, proxy.outbound_id)) {
      return { success: false, error: 'Circular dependency detected', details: 'Proxy chain contains a circular reference' }
    }
  }

  return { success: true }
}

/**
 * Find the bottom provider in a proxy chain
 */
async function findBottomProvider(
  proxyId: string,
  proxyRepo: ReturnType<typeof getBridgeProxyRepository>,
  visited: Set<string> = new Set()
): Promise<{ providerId: string; chainLength: number } | null> {
  if (visited.has(proxyId)) {
    return null // Circular dependency
  }
  visited.add(proxyId)

  const proxy = proxyRepo.findById(proxyId)
  if (!proxy) {
    return null
  }

  if (proxy.outbound_type === 'provider') {
    return {
      providerId: proxy.outbound_id,
      chainLength: visited.size
    }
  } else if (proxy.outbound_type === 'proxy') {
    return findBottomProvider(proxy.outbound_id, proxyRepo, visited)
  }

  return null
}

/**
 * Get default base URL for adapter type
 */
function getDefaultBaseUrl(adapterType: string): string {
  const defaults: Record<string, string> = {
    openai: 'https://api.openai.com',
    anthropic: 'https://api.anthropic.com',
    deepseek: 'https://api.deepseek.com',
    moonshot: 'https://api.moonshot.cn',
    qwen: 'https://dashscope.aliyuncs.com/compatible-mode',
    zhipu: 'https://open.bigmodel.cn/api/paas',
    google: 'https://generativelanguage.googleapis.com'
  }
  return defaults[adapterType] || ''
}
