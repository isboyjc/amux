/**
 * Configuration import service
 */

import fs from 'fs/promises'
import {
  getProviderRepository,
  getBridgeProxyRepository,
  getSettingsRepository
} from '../database/repositories'
import type { ConflictStrategy, ImportResult } from '../../src/types/ipc'

interface ImportData {
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
  }>
  settings?: Record<string, unknown>
}

/**
 * Import configuration from file
 */
export async function importConfig(
  filePath: string,
  strategy: ConflictStrategy
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    imported: {
      providers: 0,
      proxies: 0,
      apiKeys: 0,
      settings: 0
    },
    errors: []
  }
  
  try {
    // Read and parse file
    const content = await fs.readFile(filePath, 'utf-8')
    const data: ImportData = JSON.parse(content)
    
    // Validate version
    if (!data.version) {
      throw new Error('Invalid config file: missing version')
    }
    
    // Import providers
    if (data.providers && data.providers.length > 0) {
      const providerRepo = getProviderRepository()
      
      for (const provider of data.providers) {
        try {
          const existing = providerRepo.findById(provider.id)
          
          if (existing) {
            if (strategy === 'skip') {
              continue
            } else if (strategy === 'overwrite') {
              providerRepo.update(provider.id, {
                name: provider.name,
                adapterType: provider.adapterType,
                baseUrl: provider.baseUrl,
                models: provider.models,
                enabled: provider.enabled,
                sortOrder: provider.sortOrder
              })
              result.imported.providers++
            } else if (strategy === 'rename') {
              // Create with new ID
              providerRepo.create({
                name: `${provider.name} (导入)`,
                adapterType: provider.adapterType,
                baseUrl: provider.baseUrl,
                models: provider.models,
                enabled: provider.enabled
              })
              result.imported.providers++
            }
          } else {
            providerRepo.create({
              name: provider.name,
              adapterType: provider.adapterType,
              baseUrl: provider.baseUrl,
              models: provider.models,
              enabled: provider.enabled
            })
            result.imported.providers++
          }
        } catch (error) {
          result.errors.push(`Provider "${provider.name}": ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    }
    
    // Import proxies
    if (data.proxies && data.proxies.length > 0) {
      const proxyRepo = getBridgeProxyRepository()
      
      for (const proxy of data.proxies) {
        try {
          const existing = proxyRepo.findById(proxy.id)
          
          if (existing) {
            if (strategy === 'skip') {
              continue
            } else if (strategy === 'overwrite') {
              proxyRepo.update(proxy.id, {
                name: proxy.name,
                inboundAdapter: proxy.inboundAdapter,
                outboundType: proxy.outboundType as 'provider' | 'proxy',
                outboundId: proxy.outboundId,
                proxyPath: proxy.proxyPath,
                enabled: proxy.enabled,
                sortOrder: proxy.sortOrder
              })
              result.imported.proxies++
            } else if (strategy === 'rename') {
              // Create with new path
              proxyRepo.create({
                name: proxy.name ? `${proxy.name} (导入)` : undefined,
                inboundAdapter: proxy.inboundAdapter,
                outboundType: proxy.outboundType as 'provider' | 'proxy',
                outboundId: proxy.outboundId,
                proxyPath: `${proxy.proxyPath}-imported`,
                enabled: proxy.enabled
              })
              result.imported.proxies++
            }
          } else {
            proxyRepo.create({
              name: proxy.name,
              inboundAdapter: proxy.inboundAdapter,
              outboundType: proxy.outboundType as 'provider' | 'proxy',
              outboundId: proxy.outboundId,
              proxyPath: proxy.proxyPath,
              enabled: proxy.enabled
            })
            result.imported.proxies++
          }
        } catch (error) {
          result.errors.push(`Proxy "${proxy.name || proxy.proxyPath}": ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    }
    
    // Import settings
    if (data.settings) {
      const settingsRepo = getSettingsRepository()
      
      for (const [key, value] of Object.entries(data.settings)) {
        try {
          // Skip sensitive settings
          if (key.startsWith('security.masterPassword') || key.startsWith('security.masterKey')) {
            continue
          }
          
          settingsRepo.set(key as any, value)
          result.imported.settings++
        } catch (error) {
          result.errors.push(`Setting "${key}": ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    }
    
  } catch (error) {
    result.success = false
    result.errors.push(error instanceof Error ? error.message : 'Unknown error')
  }
  
  return result
}
