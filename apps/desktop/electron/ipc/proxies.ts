/**
 * Proxy IPC handlers
 */

import { ipcMain } from 'electron'
import {
  getBridgeProxyRepository,
  getModelMappingRepository,
  type CreateProxyDTO,
  type UpdateProxyDTO
} from '../services/database/repositories'
import { invalidateCache } from '../services/proxy-server/bridge-manager'
import type { BridgeProxyRow, ModelMappingRow } from '../services/database/types'

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
}
