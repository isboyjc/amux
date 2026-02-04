/**
 * Configuration export service
 */

import {
  getProviderRepository,
  getBridgeProxyRepository,
  getApiKeyRepository,
  getSettingsRepository
} from '../database/repositories'
import type { ExportOptions } from '../../../src/types/ipc'

interface ExportData {
  version: string
  exportedAt: string
  providers?: Array<{
    id: string
    name: string
    adapterType: string
    baseUrl?: string
    models: string[]
    enabled: boolean
    sortOrder: number
  }>
  proxies?: Array<{
    id: string
    name?: string
    inboundAdapter: string
    outboundType: string
    outboundId: string
    proxyPath: string
    enabled: boolean
    sortOrder: number
    modelMappings?: Array<{
      sourceModel: string
      targetModel: string
      isDefault: boolean
    }>
  }>
  apiKeys?: Array<{
    id: string
    name?: string
    enabled: boolean
  }>
  settings?: Record<string, unknown>
}

/**
 * Export configuration to JSON string
 */
export function exportConfig(options: ExportOptions): string {
  const exportData: ExportData = {
    version: '1.0.0',
    exportedAt: new Date().toISOString()
  }
  
  // Export providers (without API keys for security)
  if (options.includeProviders) {
    const providerRepo = getProviderRepository()
    const providers = providerRepo.findAll()
    
    exportData.providers = providers.map(p => ({
      id: p.id,
      name: p.name,
      adapterType: p.adapter_type,
      baseUrl: p.base_url ?? undefined,
      models: JSON.parse(p.models || '[]'),
      enabled: p.enabled === 1,
      sortOrder: p.sort_order
    }))
  }
  
  // Export proxies
  if (options.includeProxies) {
    const proxyRepo = getBridgeProxyRepository()
    const proxies = proxyRepo.findAll()
    
    exportData.proxies = proxies.map(p => ({
      id: p.id,
      name: p.name ?? undefined,
      inboundAdapter: p.inbound_adapter,
      outboundType: p.outbound_type,
      outboundId: p.outbound_id,
      proxyPath: p.proxy_path,
      enabled: p.enabled === 1,
      sortOrder: p.sort_order
    }))
  }
  
  // Export API keys (only IDs and names, not actual keys)
  if (options.includeApiKeys) {
    const apiKeyRepo = getApiKeyRepository()
    const apiKeys = apiKeyRepo.findAll()
    
    exportData.apiKeys = apiKeys.map(k => ({
      id: k.id,
      name: k.name ?? undefined,
      enabled: k.enabled === 1
    }))
  }
  
  // Export settings
  if (options.includeSettings) {
    const settingsRepo = getSettingsRepository()
    exportData.settings = settingsRepo.getAll()
  }
  
  return JSON.stringify(exportData, null, 2)
}
