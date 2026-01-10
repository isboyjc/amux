/**
 * Provider IPC handlers
 */

import { ipcMain } from 'electron'
import {
  getProviderRepository,
  type CreateProviderDTO,
  type UpdateProviderDTO
} from '../services/database/repositories'
import { encryptApiKey, decryptApiKey } from '../services/crypto'
import type { ProviderRow } from '../services/database/types'

// Convert DB row to Provider object
function toProvider(row: ProviderRow) {
  return {
    id: row.id,
    name: row.name,
    adapterType: row.adapter_type,
    apiKey: row.api_key ? decryptApiKey(row.api_key) : undefined,
    baseUrl: row.base_url ?? undefined,
    models: JSON.parse(row.models || '[]'),
    isCustom: !['openai', 'anthropic', 'deepseek', 'moonshot', 'qwen', 'zhipu', 'google'].includes(row.adapter_type),
    enabled: row.enabled === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function registerProviderHandlers(): void {
  const repo = getProviderRepository()

  // List all providers
  ipcMain.handle('provider:list', async () => {
    const rows = repo.findAll()
    return rows.map(toProvider)
  })

  // Get provider by ID
  ipcMain.handle('provider:get', async (_event, id: string) => {
    const row = repo.findById(id)
    return row ? toProvider(row) : null
  })

  // Create provider
  ipcMain.handle('provider:create', async (_event, data: CreateProviderDTO) => {
    const createData = {
      name: data.name,
      adapterType: data.adapterType,
      apiKey: data.apiKey ? encryptApiKey(data.apiKey) : undefined,
      baseUrl: data.baseUrl,
      models: data.models,
      enabled: data.enabled
    }
    const row = repo.create(createData)
    return toProvider(row)
  })

  // Update provider
  ipcMain.handle('provider:update', async (_event, id: string, data: UpdateProviderDTO) => {
    const updateData: UpdateProviderDTO = { ...data }
    if (data.apiKey !== undefined) {
      updateData.apiKey = data.apiKey ? encryptApiKey(data.apiKey) : ''
    }
    const row = repo.update(id, updateData)
    return row ? toProvider(row) : null
  })

  // Delete provider
  ipcMain.handle('provider:delete', async (_event, id: string) => {
    return repo.delete(id)
  })

  // Toggle provider enabled
  ipcMain.handle('provider:toggle', async (_event, id: string, enabled: boolean) => {
    return repo.toggleEnabled(id, enabled)
  })

  // Test provider connection
  ipcMain.handle('provider:test', async (_event, id: string) => {
    const row = repo.findById(id)
    if (!row) {
      return { success: false, latency: 0, error: 'Provider not found' }
    }

    const apiKey = row.api_key ? decryptApiKey(row.api_key) : ''
    if (!apiKey) {
      return { success: false, latency: 0, error: 'No API key configured' }
    }

    const baseUrl = row.base_url || getDefaultBaseUrl(row.adapter_type)
    const startTime = Date.now()

    try {
      // Try to fetch models list
      const response = await fetch(`${baseUrl}/v1/models`, {
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
          latency,
          error: `HTTP ${response.status}: ${response.statusText}`
        }
      }

      const data = await response.json()
      const models = (data.data || []).map((m: { id: string }) => m.id)

      return {
        success: true,
        latency,
        models,
        rateLimit: {
          limit: parseInt(response.headers.get('x-ratelimit-limit') || '0'),
          remaining: parseInt(response.headers.get('x-ratelimit-remaining') || '0'),
          reset: parseInt(response.headers.get('x-ratelimit-reset') || '0')
        }
      }
    } catch (error) {
      return {
        success: false,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  // Fetch models from provider API
  ipcMain.handle('provider:fetch-models', async (_event, id: string) => {
    const row = repo.findById(id)
    if (!row) {
      throw new Error('Provider not found')
    }

    const apiKey = row.api_key ? decryptApiKey(row.api_key) : ''
    if (!apiKey) {
      throw new Error('No API key configured')
    }

    const baseUrl = row.base_url || getDefaultBaseUrl(row.adapter_type)

    const response = await fetch(`${baseUrl}/v1/models`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    return (data.data || []).map((m: { id: string }) => m.id)
  })
}

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
