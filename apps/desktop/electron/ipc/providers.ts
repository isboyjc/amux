/**
 * Provider IPC handlers
 */

import { ipcMain } from 'electron'

import { encryptApiKey, decryptApiKey } from '../services/crypto'
import {
  getProviderRepository,
  type CreateProviderDTO,
  type UpdateProviderDTO
} from '../services/database/repositories'
import type { ProviderRow } from '../services/database/types'
import { generateSlug, ensureUniqueSlug, validateSlug } from '../utils/slug'

// Convert DB row to Provider object
function toProvider(row: ProviderRow) {
  return {
    id: row.id,
    name: row.name,
    adapterType: row.adapter_type,
    apiKey: row.api_key ? decryptApiKey(row.api_key) : undefined,
    baseUrl: row.base_url ?? undefined,
    chatPath: row.chat_path ?? undefined,
    modelsPath: row.models_path ?? undefined,
    models: JSON.parse(row.models || '[]'),
    isCustom: !['openai', 'anthropic', 'deepseek', 'moonshot', 'qwen', 'zhipu', 'google'].includes(row.adapter_type),
    enabled: row.enabled === 1,
    sortOrder: row.sort_order,
    logo: row.logo ?? undefined,
    color: row.color ?? undefined,
    enableAsProxy: row.enable_as_proxy === 1,
    proxyPath: row.proxy_path ?? undefined,
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
      chatPath: data.chatPath,
      modelsPath: data.modelsPath,
      models: data.models,
      enabled: data.enabled,
      logo: data.logo,
      color: data.color
    }
    const row = repo.create(createData)
    return toProvider(row)
  })

  // Update provider
  ipcMain.handle('provider:update', async (_event, id: string, data: UpdateProviderDTO) => {
    const updateData: UpdateProviderDTO = { 
      ...data,
      chatPath: data.chatPath,
      modelsPath: data.modelsPath,
      logo: data.logo,
      color: data.color
    }
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
    const modelsPath = row.models_path || '/v1/models'
    const startTime = Date.now()

    try {
      // Try to fetch models list
      const response = await fetch(`${baseUrl}${modelsPath}`, {
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

  // Fetch models from provider API (by provider ID)
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
    const modelsPath = row.models_path || '/v1/models'

    const response = await fetch(`${baseUrl}${modelsPath}`, {
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

  // Fetch models directly from API (with params)
  ipcMain.handle('providers:fetch-models', async (_event, params: {
    baseUrl: string
    apiKey: string
    modelsPath: string
    adapterType: string
  }) => {
    try {
      const { baseUrl, apiKey, modelsPath } = params
      const url = `${baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl}${modelsPath}`

      console.log(`[FetchModels] Request URL: ${url}`)
      console.log(`[FetchModels] Adapter Type: ${params.adapterType}`)

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(10000)
      })

      console.log(`[FetchModels] Response Status: ${response.status}`)

      if (!response.ok) {
        const errorText = await response.text()
        console.log(`[FetchModels] Error Response: ${errorText.substring(0, 200)}`)
        return { success: false, error: `HTTP ${response.status}: ${errorText.substring(0, 100)}`, models: [] }
      }

      const data = await response.json()
      console.log(`[FetchModels] Response Data Keys:`, Object.keys(data))

      // Handle different API response formats
      let models: Array<{ id: string; name?: string }> = []
      if (Array.isArray(data)) {
        models = data.map((m: { id?: string; name?: string }) => ({
          id: m.id || '',
          name: m.name || m.id || ''
        }))
      } else if (data.data && Array.isArray(data.data)) {
        // OpenAI format
        models = data.data.map((m: { id: string; name?: string }) => ({
          id: m.id,
          name: m.name || m.id
        }))
      } else if (data.models && Array.isArray(data.models)) {
        models = data.models.map((m: { id?: string; name?: string; model?: string }) => ({
          id: m.id || m.model || '',
          name: m.name || m.id || m.model || ''
        }))
      }

      console.log(`[FetchModels] Success! Found ${models.length} models`)
      if (models.length > 0) {
        console.log(`[FetchModels] First 5 models:`, models.slice(0, 5).map(m => m.id))
      }

      return { success: true, models }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch models',
        models: []
      }
    }
  })

  // Validate proxy path
  ipcMain.handle('provider:validate-proxy-path', async (_event, path: string, excludeId?: string) => {
    try {
      // 1. Format validation
      const validation = validateSlug(path)
      if (!validation.valid) {
        return false
      }
      
      // 2. Check uniqueness (only among other providers)
      const isTaken = repo.isProxyPathTaken(path, excludeId)
      return !isTaken
    } catch (error) {
      console.error('[ValidateProxyPath] Error:', error)
      return false
    }
  })

  // Generate proxy path
  ipcMain.handle('provider:generate-proxy-path', async (_event, name: string, adapterType: string) => {
    try {
      // Generate base slug
      const baseSlug = generateSlug(name, adapterType)
      
      // Get existing proxy paths
      const allProviders = repo.findAll()
      const existingSlugs = allProviders
        .map(p => p.proxy_path)
        .filter((p): p is string => p !== null && p !== undefined)
      
      // Ensure uniqueness
      const uniqueSlug = ensureUniqueSlug(baseSlug, existingSlugs)
      
      return uniqueSlug
    } catch (error) {
      console.error('[GenerateProxyPath] Error:', error)
      throw error
    }
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
