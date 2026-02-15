/**
 * Provider IPC handlers
 */

import { ipcMain } from 'electron'

import {
  trackProviderCreated,
  trackProviderDeleted,
  trackProviderTested
} from '../services/analytics'
import { encryptApiKey, decryptApiKey } from '../services/crypto'
import {
  getProviderRepository,
  CodeSwitchRepository,
  type CreateProviderDTO,
  type UpdateProviderDTO
} from '../services/database/repositories'
import type { ProviderRow } from '../services/database/types'
import { generateSlug, ensureUniqueSlug, validateSlug } from '../utils/slug'
import { ConfigBackup, invalidateCodeSwitchCache } from '../services/code-switch'

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
    // OAuth Pool Provider fields
    isPool: row.is_pool === 1,
    poolStrategy: row.pool_strategy ?? undefined,
    oauthAccountId: row.oauth_account_id ?? undefined,
    oauthProviderType: row.oauth_provider_type ?? undefined,
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
    
    // 追踪 Provider 创建（异步，不阻塞）
    setImmediate(() => {
      try {
        trackProviderCreated(data.adapterType, !!data.apiKey)
      } catch (e) {
        // 静默失败，不影响功能
      }
    })
    
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
    // 获取 Provider 信息用于追踪
    const provider = repo.findById(id)
    const adapterType = provider?.adapter_type
    
    // Check if this provider is used by Code Switch
    const codeSwitchRepo = new CodeSwitchRepository()
    const affectedConfigs = codeSwitchRepo.findByProvider(id)
    
    // Restore original CLI configs before deletion
    for (const config of affectedConfigs) {
      if (config.enabled && config.backup_config) {
        try {
          await ConfigBackup.restore(
            config.config_path,
            config.backup_config
          )
          console.log(`[Provider Delete] Restored ${config.cli_type} config`)
          
          // Invalidate cache
          invalidateCodeSwitchCache(config.cli_type)
        } catch (error) {
          console.error(`[Provider Delete] Failed to restore ${config.cli_type} config:`, error)
        }
      }
    }
    
    // Delete provider (Code Switch configs will cascade delete due to FK constraint)
    const result = repo.delete(id)
    
    // 追踪 Provider 删除（异步，不阻塞）
    if (result && adapterType) {
      setImmediate(() => {
        try {
          trackProviderDeleted(adapterType)
        } catch (e) {
          // 静默失败，不影响功能
        }
      })
    }
    
    return result
  })

  // Toggle provider enabled
  ipcMain.handle('provider:toggle', async (_event, id: string, enabled: boolean) => {
    return repo.toggleEnabled(id, enabled)
  })

  // Test provider connection
  ipcMain.handle('provider:test', async (_event, id: string, modelId?: string) => {
    const row = repo.findById(id)
    if (!row) {
      return { success: false, latency: 0, error: 'Provider not found' }
    }

    // All providers use api_key field (including OAuth Pool Providers)
    const apiKey = row.api_key ? decryptApiKey(row.api_key) : ''
    if (!apiKey) {
      return { success: false, latency: 0, error: 'No API key configured' }
    }

    const baseUrl = row.base_url || getDefaultBaseUrl(row.adapter_type)
    const modelsPath = row.models_path || null
    const startTime = Date.now()

    console.log(`[Provider Test] Testing provider: ${row.name} (${row.adapter_type})`)
    console.log(`[Provider Test]   - baseUrl: ${baseUrl}`)
    console.log(`[Provider Test]   - modelsPath: ${modelsPath}`)
    console.log(`[Provider Test]   - modelId: ${modelId}`)

    // If no modelsPath configured, send a test chat message instead
    if (!modelsPath) {
      if (!modelId) {
        return { success: false, latency: 0, error: 'No model specified for test' }
      }

      const chatPath = row.chat_path || '/v1/chat/completions'
      console.log(`[Provider Test]   - Using chat test: ${baseUrl}${chatPath}`)

      try {
        // Build test message request based on adapter type
        let requestBody: Record<string, unknown>
        let headers: Record<string, string>

        if (row.adapter_type === 'anthropic') {
          // Anthropic format
          requestBody = {
            model: modelId,
            messages: [{ role: 'user', content: 'Hi' }],
            max_tokens: 10
          }
          headers = {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          }
        } else {
          // OpenAI-compatible format (including MiniMax)
          requestBody = {
            model: modelId,
            messages: [{ role: 'user', content: 'Hi' }],
            max_tokens: 10
          }
          headers = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }

        const response = await fetch(`${baseUrl}${chatPath}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(30000)
        })

        const latency = Date.now() - startTime

        if (!response.ok) {
          const errorText = await response.text()
          return {
            success: false,
            latency,
            error: `HTTP ${response.status}: ${errorText}`
          }
        }

        // 追踪测试成功（异步，不阻塞）
        setImmediate(() => {
          try {
            trackProviderTested(row.adapter_type, true, latency)
          } catch (e) {
            // 静默失败
          }
        })

        return {
          success: true,
          latency,
          message: 'Chat test successful'
        }
      } catch (error) {
        const failureLatency = Date.now() - startTime

        // 追踪测试失败（异步，不阻塞）
        setImmediate(() => {
          try {
            trackProviderTested(row.adapter_type, false, failureLatency)
          } catch (e) {
            // 静默失败
          }
        })

        return {
          success: false,
          latency: failureLatency,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    // Original logic: Try to fetch models list
    console.log(`[Provider Test]   - Full URL: ${baseUrl}${modelsPath}`)

    try {
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

      // 追踪测试成功（异步，不阻塞）
      setImmediate(() => {
        try {
          trackProviderTested(row.adapter_type, true, latency)
        } catch (e) {
          // 静默失败
        }
      })

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
      const failureLatency = Date.now() - startTime

      // 追踪测试失败（异步，不阻塞）
      setImmediate(() => {
        try {
          trackProviderTested(row.adapter_type, false, failureLatency)
        } catch (e) {
          // 静默失败
        }
      })

      return {
        success: false,
        latency: failureLatency,
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

      console.log(`[FetchModels] Fetching models from: ${url}`)

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
      
      // ✅ Antigravity v1internal:fetchAvailableModels format: { models: { "model-id": {...}, ... } }
      if (data.models && typeof data.models === 'object' && !Array.isArray(data.models)) {
        console.log(`[FetchModels] Detected Antigravity object format`)
        const modelKeys = Object.keys(data.models)
        console.log(`[FetchModels] Model count:`, modelKeys.length)
        console.log(`[FetchModels] First 5 model keys:`, modelKeys.slice(0, 5))
        
        models = modelKeys.map(modelId => {
          const modelData = data.models[modelId]
          // Use displayName if available, otherwise use the model ID
          const displayName = modelData?.displayName || modelData?.name || modelId
          return {
            id: modelId,
            name: displayName
          }
        })
      } else if (Array.isArray(data)) {
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
        // Gemini / Google format or other providers
        models = data.models.map((m: { id?: string; name?: string; model?: string; displayName?: string }) => {
          // Extract model ID from different formats:
          // 1. For Gemini: name field like "models/gemini-1.5-pro" -> extract "gemini-1.5-pro"
          // 2. For other providers: use id or model field directly
          let modelId = m.id || m.model || ''
          
          // Special handling for Gemini format (name starts with "models/")
          if (!modelId && m.name && m.name.startsWith('models/')) {
            modelId = m.name.replace('models/', '')
          } else if (!modelId) {
            modelId = m.name || ''
          }
          
          // Use displayName for Gemini, fallback to other fields
          const displayName = m.displayName || m.name || modelId
          
          return {
            id: modelId,
            name: displayName
          }
        })
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

  // Fetch models for OAuth provider
  ipcMain.handle('providers:fetch-models-oauth', async (_event, providerId: string) => {
    try {
      const row = repo.findById(providerId)
      if (!row) {
        return { success: false, error: 'Provider not found', models: [] }
      }

      // Check if this is an OAuth provider
      const isOAuthProvider = row.is_pool === 1 || !!row.oauth_account_id
      if (!isOAuthProvider) {
        return { success: false, error: 'Not an OAuth provider', models: [] }
      }

      // Get OAuth token
      const { getOAuthManager } = await import('../services/oauth/oauth-manager')
      const { getPoolHandler } = await import('../services/oauth/pool-handler')
      const oauthManager = getOAuthManager()
      const poolHandler = getPoolHandler()

      let apiKey = ''
      if (row.is_pool === 1) {
        const selection = await poolHandler.selectAccount(
          row.oauth_provider_type!
        )
        if (!selection) {
          return { success: false, error: 'No available OAuth accounts in pool', models: [] }
        }
        apiKey = selection.accessToken
      } else if (row.oauth_account_id) {
        const token = await oauthManager.getAccessToken(row.oauth_account_id)
        if (!token) {
          return { success: false, error: 'Failed to get OAuth token', models: [] }
        }
        apiKey = token
      }

      const baseUrl = row.base_url || getDefaultBaseUrl(row.adapter_type)
      const modelsPath = row.models_path || '/v1/models'

      console.log(`[FetchModels OAuth] Fetching from: ${baseUrl}${modelsPath}`)
      console.log(`[FetchModels OAuth] Using token: ${apiKey.substring(0, 20)}...`)

      const response = await fetch(`${baseUrl}${modelsPath}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(15000)
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error')
        console.error(`[FetchModels OAuth] HTTP ${response.status}:`, errorText)
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText} - ${errorText}`,
          models: []
        }
      }

      const data = await response.json()

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
        // Gemini / Google format
        models = data.models.map((m: { id?: string; name?: string; model?: string; displayName?: string }) => {
          let modelId = m.id || m.model || ''
          if (!modelId && m.name && m.name.startsWith('models/')) {
            modelId = m.name.replace('models/', '')
          } else if (!modelId) {
            modelId = m.name || ''
          }
          const displayName = m.displayName || m.name || modelId
          return {
            id: modelId,
            name: displayName
          }
        })
      }

      console.log(`[FetchModels OAuth] Success! Found ${models.length} models`)
      return { success: true, models }
    } catch (error) {
      console.error('[FetchModels OAuth] Error:', error)
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
