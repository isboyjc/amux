import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

import { electronApp, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, shell, ipcMain } from 'electron'

// Database imports
import { initDatabase, closeDatabase } from './services/database'
import { runMigrations } from './services/database/migrator'
import { getBridgeProxyRepository } from './services/database/repositories/bridge-proxy'
import { getModelMappingRepository } from './services/database/repositories/model-mapping'
import { getProviderRepository } from './services/database/repositories/provider'
import { getRequestLogRepository } from './services/database/repositories/request-log'
import { getApiKeyRepository } from './services/database/repositories/api-key'

// Main window instance
let mainWindow: BrowserWindow | null = null

// Proxy service state (mock for now)
let proxyServiceState = {
  status: 'stopped' as 'running' | 'stopped' | 'starting' | 'stopping' | 'error',
  port: null as number | null,
  host: null as string | null,
  error: null as string | null
}

// Provider preset types
interface ProviderPresetModel {
  id: string
  name: string
  contextLength?: number
  capabilities?: string[]
}

interface ProviderPreset {
  id: string
  name: string
  adapterType: string
  baseUrl: string
  chatPath?: string
  modelsPath?: string
  logo: string
  color: string
  models: ProviderPresetModel[]
}

interface ProviderPresetsFile {
  version: string
  minClientVersion: string
  updatedAt: string
  providers: ProviderPreset[]
}

// Adapter preset types
interface AdapterPreset {
  id: string
  name: string
  description: string
  provider: string
}

interface AdapterPresetsFile {
  version: string
  updatedAt: string
  adapters: AdapterPreset[]
}

// Cached presets (loaded from JSON files)
let cachedPresets: ProviderPreset[] | null = null
let cachedAdapters: AdapterPreset[] | null = null

/**
 * Get the path to provider presets JSON file
 */
function getPresetsFilePath(): string {
  // In development, use the source resources folder
  // In production, use the app resources folder
  if (!app.isPackaged) {
    return join(__dirname, '../../resources/presets/providers.json')
  }
  return join(process.resourcesPath, 'presets/providers.json')
}

/**
 * Get the path to adapter presets JSON file
 */
function getAdaptersFilePath(): string {
  if (!app.isPackaged) {
    return join(__dirname, '../../resources/presets/adapters.json')
  }
  return join(process.resourcesPath, 'presets/adapters.json')
}

/**
 * Load adapter presets from JSON file
 */
function loadAdapterPresets(): AdapterPreset[] {
  if (cachedAdapters) {
    return cachedAdapters
  }

  const adaptersPath = getAdaptersFilePath()

  try {
    if (existsSync(adaptersPath)) {
      const content = readFileSync(adaptersPath, 'utf-8')
      const data: AdapterPresetsFile = JSON.parse(content)
      cachedAdapters = data.adapters
      console.log(`[Presets] Loaded ${cachedAdapters.length} adapter presets from ${adaptersPath}`)
      return cachedAdapters
    }
  } catch (error) {
    console.error('[Presets] Failed to load adapter presets:', error)
  }

  console.warn('[Presets] No adapters file found, returning empty array')
  return []
}

/**
 * Load provider presets from JSON file
 */
function loadProviderPresets(): ProviderPreset[] {
  if (cachedPresets) {
    return cachedPresets
  }

  const presetsPath = getPresetsFilePath()

  try {
    if (existsSync(presetsPath)) {
      const content = readFileSync(presetsPath, 'utf-8')
      const data: ProviderPresetsFile = JSON.parse(content)
      cachedPresets = data.providers
      console.log(`[Presets] Loaded ${cachedPresets.length} provider presets from ${presetsPath}`)
      return cachedPresets
    }
  } catch (error) {
    console.error('[Presets] Failed to load provider presets:', error)
  }

  // Return empty array if file not found or error
  console.warn('[Presets] No presets file found, returning empty array')
  return []
}

// Helper to convert database row to API response format
function formatProviderRow(row: {
  id: string
  name: string
  adapter_type: string
  api_key: string | null
  base_url: string | null
  chat_path: string | null
  models_path: string | null
  models: string
  enabled: number
  sort_order: number
  logo: string | null
  color: string | null
  created_at: number
  updated_at: number
}) {
  return {
    id: row.id,
    name: row.name,
    adapterType: row.adapter_type,
    apiKey: row.api_key || '',
    baseUrl: row.base_url || '',
    chatPath: row.chat_path || '',
    modelsPath: row.models_path || '',
    models: JSON.parse(row.models || '[]'),
    enabled: row.enabled === 1,
    sortOrder: row.sort_order,
    logo: row.logo || '',
    color: row.color || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function formatProxyRow(row: {
  id: string
  name: string
  inbound_adapter: string
  outbound_type: string
  outbound_id: string
  proxy_path: string
  enabled: number
  sort_order: number
  created_at: number
  updated_at: number
}) {
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

// Initialize default providers from presets (only if database is empty)
function initializeDefaultProviders(): void {
  const providerRepo = getProviderRepository()
  const existingProviders = providerRepo.findAll()
  
  if (existingProviders.length > 0) {
    console.log(`[Init] Found ${existingProviders.length} existing providers, skipping initialization`)
    return
  }
  
  const presets = loadProviderPresets()
  
  if (presets.length === 0) {
    console.warn('[Init] No presets available, skipping provider initialization')
    return
  }
  
  console.log('[Init] Database empty, initializing default providers from presets...')
  
  for (const preset of presets) {
    providerRepo.create({
      name: preset.name,
      adapterType: preset.adapterType,
      apiKey: '',
      baseUrl: preset.baseUrl,
      chatPath: preset.chatPath || '',
      modelsPath: preset.modelsPath || '',
      models: preset.models.map(m => m.id),
      enabled: false,
      logo: preset.logo,
      color: preset.color
    })
  }
  
  console.log(`[Init] Created ${presets.length} default providers`)
}

// Register IPC handlers
function registerIpcHandlers(): void {
  const providerRepo = getProviderRepository()
  const proxyRepo = getBridgeProxyRepository()
  const mappingRepo = getModelMappingRepository()

  // Provider handlers - using SQLite
  ipcMain.handle('provider:list', () => {
    const rows = providerRepo.findAll()
    return rows.map(formatProviderRow)
  })

  ipcMain.handle('provider:get', (_event, id: string) => {
    const row = providerRepo.findById(id)
    return row ? formatProviderRow(row) : null
  })

  ipcMain.handle('provider:create', (_event, data) => {
    const row = providerRepo.create({
      name: data.name,
      adapterType: data.adapterType,
      apiKey: data.apiKey || '',
      baseUrl: data.baseUrl || '',
      chatPath: data.chatPath || '',
      modelsPath: data.modelsPath || '',
      models: data.models || [],
      enabled: data.enabled ?? false,
      logo: data.logo || '',
      color: data.color || ''
    })
    return formatProviderRow(row)
  })

  ipcMain.handle('provider:update', (_event, id: string, data) => {
    const row = providerRepo.update(id, {
      name: data.name,
      adapterType: data.adapterType,
      apiKey: data.apiKey,
      baseUrl: data.baseUrl,
      chatPath: data.chatPath,
      modelsPath: data.modelsPath,
      models: data.models,
      enabled: data.enabled,
      sortOrder: data.sortOrder,
      logo: data.logo,
      color: data.color
    })
    return row ? formatProviderRow(row) : null
  })

  ipcMain.handle('provider:delete', (_event, id: string) => {
    return providerRepo.delete(id)
  })

  ipcMain.handle('provider:toggle', (_event, id: string, enabled: boolean) => {
    return providerRepo.toggleEnabled(id, enabled)
  })

  ipcMain.handle('provider:test', async (_event, id: string, modelId?: string) => {
    const row = providerRepo.findById(id)
    if (!row) {
      return { success: false, latency: 0, error: 'Provider not found' }
    }

    if (!row.api_key || !row.base_url) {
      return { success: false, latency: 0, error: 'API key or base URL not configured' }
    }

    if (!row.chat_path) {
      return { success: false, latency: 0, error: 'Chat API path not configured' }
    }

    const models = JSON.parse(row.models || '[]')
    const testModel = modelId || models[0]
    if (!testModel) {
      return { success: false, latency: 0, error: 'No model available for testing' }
    }

    try {
      const startTime = Date.now()

      // Build the API endpoint using chatPath from database
      const baseUrl = row.base_url.endsWith('/') ? row.base_url.slice(0, -1) : row.base_url
      let chatPath = row.chat_path.startsWith('/') ? row.chat_path : `/${row.chat_path}`

      // Handle model placeholder in chatPath (e.g., for Gemini: /v1beta/models/{model}:generateContent)
      if (chatPath.includes('{model}')) {
        chatPath = chatPath.replace('{model}', testModel)
      }

      const endpoint = `${baseUrl}${chatPath}`
      console.log(`[ProviderTest] Testing endpoint: ${endpoint} with model: ${testModel}`)

      // Determine the request body format based on adapter type
      let requestBody: Record<string, unknown>
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }

      // Different providers have different request formats
      if (row.adapter_type === 'anthropic') {
        headers['x-api-key'] = row.api_key
        headers['anthropic-version'] = '2023-06-01'
        requestBody = {
          model: testModel,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5
        }
      } else if (row.adapter_type === 'gemini') {
        // Gemini uses query parameter for API key
        const geminiEndpoint = `${endpoint}?key=${row.api_key}`
        const geminiResponse = await fetch(geminiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Hi' }] }]
          })
        })

        const latency = Date.now() - startTime

        if (!geminiResponse.ok) {
          const errorText = await geminiResponse.text()
          let errorMessage = `HTTP ${geminiResponse.status}`
          try {
            const errorJson = JSON.parse(errorText)
            errorMessage = errorJson.error?.message || errorJson.message || errorMessage
          } catch {
            errorMessage = errorText.substring(0, 100) || errorMessage
          }
          return { success: false, latency, error: errorMessage }
        }

        return { success: true, latency, models }
      } else {
        // OpenAI-compatible format (default)
        headers['Authorization'] = `Bearer ${row.api_key}`
        requestBody = {
          model: testModel,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5,
          stream: false
        }
      }

      // Make the test request
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      })

      const latency = Date.now() - startTime

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = `HTTP ${response.status}`
        try {
          const errorJson = JSON.parse(errorText)
          errorMessage = errorJson.error?.message || errorJson.message || errorMessage
        } catch {
          errorMessage = errorText.substring(0, 100) || errorMessage
        }
        return { success: false, latency, error: errorMessage }
      }

      return { success: true, latency, models }
    } catch (error) {
      return {
        success: false,
        latency: 0,
        error: error instanceof Error ? error.message : 'Connection failed'
      }
    }
  })

  ipcMain.handle('provider:fetch-models', async (_event, id: string) => {
    const row = providerRepo.findById(id)
    return row ? JSON.parse(row.models || '[]') : []
  })

  // Fetch models from provider API
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
        }
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

  // Proxy handlers - using SQLite
  ipcMain.handle('proxy:list', () => {
    const rows = proxyRepo.findAll()
    return rows.map(formatProxyRow)
  })

  ipcMain.handle('proxy:get', (_event, id: string) => {
    const row = proxyRepo.findById(id)
    return row ? formatProxyRow(row) : null
  })

  ipcMain.handle('proxy:create', (_event, data) => {
    const row = proxyRepo.create({
      name: data.name || '',
      inboundAdapter: data.inboundAdapter,
      outboundType: data.outboundType,
      outboundId: data.outboundId,
      proxyPath: data.proxyPath,
      enabled: data.enabled ?? true
    })
    return formatProxyRow(row)
  })

  ipcMain.handle('proxy:update', (_event, id: string, data) => {
    const row = proxyRepo.update(id, {
      name: data.name,
      inboundAdapter: data.inboundAdapter,
      outboundType: data.outboundType,
      outboundId: data.outboundId,
      proxyPath: data.proxyPath,
      enabled: data.enabled,
      sortOrder: data.sortOrder
    })
    return row ? formatProxyRow(row) : null
  })

  ipcMain.handle('proxy:delete', (_event, id: string) => {
    return proxyRepo.delete(id)
  })

  ipcMain.handle('proxy:toggle', (_event, id: string, enabled: boolean) => {
    return proxyRepo.toggleEnabled(id, enabled)
  })

  ipcMain.handle('proxy:validate-path', (_event, path: string, excludeId?: string) => {
    return proxyRepo.isPathUnique(path, excludeId)
  })

  ipcMain.handle('proxy:check-circular', (_event, proxyId: string, outboundId: string) => {
    return proxyRepo.checkCircularDependency(proxyId, outboundId)
  })

  ipcMain.handle('proxy:get-mappings', (_event, proxyId: string) => {
    const rows = mappingRepo.findByProxyId(proxyId)
    return rows.map(row => ({
      id: row.id,
      proxyId: row.proxy_id,
      sourceModel: row.source_model,
      targetModel: row.target_model,
      isDefault: row.is_default === 1
    }))
  })

  ipcMain.handle('proxy:set-mappings', (_event, proxyId: string, mappings: Array<{
    sourceModel: string
    targetModel: string
    isDefault?: boolean
  }>) => {
    const rows = mappingRepo.bulkCreate(proxyId, mappings)
    return rows.map(row => ({
      id: row.id,
      proxyId: row.proxy_id,
      sourceModel: row.source_model,
      targetModel: row.target_model,
      isDefault: row.is_default === 1
    }))
  })

  // Proxy test handler
  ipcMain.handle('proxy:test', async (_event, proxyId: string) => {
    const proxy = proxyRepo.findById(proxyId)
    if (!proxy) {
      return { success: false, error: 'Proxy not found' }
    }

    // Get outbound provider if type is provider
    if (proxy.outbound_type === 'provider') {
      const provider = providerRepo.findById(proxy.outbound_id)
      if (!provider) {
        return { success: false, error: 'Provider not found' }
      }

      if (!provider.api_key) {
        return { success: false, error: 'Provider API key not configured' }
      }

      if (!provider.base_url) {
        return { success: false, error: 'Provider base URL not configured' }
      }

      // Use the same test logic as provider:test
      try {
        const response = await fetch(`${provider.base_url}${provider.chat_path || '/v1/chat/completions'}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${provider.api_key}`
          },
          body: JSON.stringify({
            model: provider.models ? JSON.parse(provider.models)[0] : 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'Hi' }],
            max_tokens: 5
          })
        })

        if (response.ok) {
          return { success: true }
        } else {
          const text = await response.text()
          return { success: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` }
        }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Connection failed' }
      }
    } else {
      // Chain proxy - just verify the target proxy exists and is enabled
      const targetProxy = proxyRepo.findById(proxy.outbound_id)
      if (!targetProxy) {
        return { success: false, error: 'Target proxy not found' }
      }
      if (!targetProxy.enabled) {
        return { success: false, error: 'Target proxy is disabled' }
      }
      return { success: true }
    }
  })

  // Proxy service handlers - use real server implementation
  ipcMain.handle('proxy-service:start', async (_event, config?: { port?: number; host?: string }) => {
    try {
      const { startServer } = await import('./services/proxy-server')
      const { registerRoutes } = await import('./services/proxy-server/routes')

      // Pass route registrar to startServer - routes must be registered BEFORE listen()
      await startServer(config, registerRoutes)

      proxyServiceState = {
        status: 'running',
        port: config?.port ?? 9527,
        host: config?.host ?? '127.0.0.1',
        error: null
      }
      console.log(`[Proxy Service] Started on ${proxyServiceState.host}:${proxyServiceState.port}`)
    } catch (error) {
      proxyServiceState = {
        status: 'error',
        port: null,
        host: null,
        error: error instanceof Error ? error.message : 'Failed to start server'
      }
      console.error('[Proxy Service] Failed to start:', error)
      throw error
    }
  })
  ipcMain.handle('proxy-service:stop', async () => {
    try {
      const { stopServer } = await import('./services/proxy-server')
      await stopServer()
      proxyServiceState = { status: 'stopped', port: null, host: null, error: null }
      console.log('[Proxy Service] Stopped')
    } catch (error) {
      console.error('[Proxy Service] Failed to stop:', error)
      throw error
    }
  })
  ipcMain.handle('proxy-service:restart', async (_event, config?: { port?: number; host?: string }) => {
    try {
      const { restartServer } = await import('./services/proxy-server')
      const { registerRoutes } = await import('./services/proxy-server/routes')

      // Pass route registrar to restartServer - routes must be registered BEFORE listen()
      await restartServer(config, registerRoutes)

      proxyServiceState = {
        status: 'running',
        port: config?.port ?? 9527,
        host: config?.host ?? '127.0.0.1',
        error: null
      }
      console.log(`[Proxy Service] Restarted on ${proxyServiceState.host}:${proxyServiceState.port}`)
    } catch (error) {
      proxyServiceState = {
        status: 'error',
        port: null,
        host: null,
        error: error instanceof Error ? error.message : 'Failed to restart server'
      }
      console.error('[Proxy Service] Failed to restart:', error)
      throw error
    }
  })
  ipcMain.handle('proxy-service:status', () => proxyServiceState)
  ipcMain.handle('proxy-service:metrics', async () => {
    try {
      const { getMetrics } = await import('./services/proxy-server')
      return getMetrics()
    } catch {
      return {
        totalRequests: 0,
        successRequests: 0,
        failedRequests: 0,
        averageLatency: 0,
        p50Latency: 0,
        p95Latency: 0,
        p99Latency: 0,
        requestsPerMinute: 0,
        activeConnections: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        windowStart: Date.now(),
        windowEnd: Date.now()
      }
    }
  })

  // Settings handlers
  ipcMain.handle('settings:get', () => undefined)
  ipcMain.handle('settings:set', () => {})
  ipcMain.handle('settings:getAll', () => ({}))
  ipcMain.handle('settings:setMany', () => {})

  // API Key handlers - use real database
  ipcMain.handle('api-key:list', () => {
    const repo = getApiKeyRepository()
    const rows = repo.findAll()
    return rows.map(row => ({
      id: row.id,
      key: row.key,
      name: row.name,
      enabled: row.enabled === 1,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at
    }))
  })

  ipcMain.handle('api-key:create', (_event, name?: string) => {
    const repo = getApiKeyRepository()
    const row = repo.create({ name })
    return {
      id: row.id,
      key: row.key,
      name: row.name,
      enabled: row.enabled === 1,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at
    }
  })

  ipcMain.handle('api-key:delete', (_event, id: string) => {
    const repo = getApiKeyRepository()
    return repo.delete(id)
  })

  ipcMain.handle('api-key:toggle', (_event, id: string, enabled: boolean) => {
    const repo = getApiKeyRepository()
    return repo.toggleEnabled(id, enabled)
  })

  ipcMain.handle('api-key:rename', (_event, id: string, name: string) => {
    const repo = getApiKeyRepository()
    const row = repo.updateName(id, name)
    if (!row) return null
    return {
      id: row.id,
      key: row.key,
      name: row.name,
      enabled: row.enabled === 1,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at
    }
  })

  // Logs handlers - use real database queries
  const logRepo = getRequestLogRepository()

  ipcMain.handle('logs:query', (_event, filter: unknown, pagination: unknown) => {
    const result = logRepo.query(filter as Record<string, unknown>, pagination as { page: number; pageSize: number })
    return {
      ...result,
      data: result.data.map(row => ({
        id: row.id,
        proxyId: row.proxy_id ?? undefined,
        proxyPath: row.proxy_path,
        sourceModel: row.source_model,
        targetModel: row.target_model,
        statusCode: row.status_code,
        inputTokens: row.input_tokens ?? undefined,
        outputTokens: row.output_tokens ?? undefined,
        latencyMs: row.latency_ms,
        requestBody: row.request_body ?? undefined,
        responseBody: row.response_body ?? undefined,
        error: row.error ?? undefined,
        createdAt: row.created_at
      }))
    }
  })
  ipcMain.handle('logs:get-stats', (_event, filter?: unknown) => {
    return logRepo.getStats((filter || {}) as Record<string, unknown>)
  })
  ipcMain.handle('logs:export', (_event, filter: unknown, format: 'json' | 'csv') => {
    if (format === 'csv') {
      return logRepo.exportToCsv(filter as Record<string, unknown>)
    }
    return logRepo.exportToJson(filter as Record<string, unknown>)
  })
  ipcMain.handle('logs:clear', (_event, before?: number) => {
    if (before) {
      return logRepo.clearBefore(before)
    }
    return logRepo.clearAll()
  })
  ipcMain.handle('logs:cleanup', async () => {
    const { cleanupOldLogs } = await import('./services/logger')
    return cleanupOldLogs()
  })

  // Config handlers
  ipcMain.handle('config:export', () => JSON.stringify({ version: '1.0.0', exportedAt: new Date().toISOString() }))
  ipcMain.handle('config:import', () => ({ success: true, imported: { providers: 0, proxies: 0, apiKeys: 0, settings: 0 }, errors: [] }))

  // Presets handlers - return official presets (from JSON file)
  ipcMain.handle('presets:get-providers', () => loadProviderPresets())
  ipcMain.handle('presets:get-adapters', () => loadAdapterPresets())
  ipcMain.handle('presets:refresh', () => {
    // Clear cache to force reload
    cachedPresets = null
    cachedAdapters = null
    const providers = loadProviderPresets()
    const adapters = loadAdapterPresets()
    return { providers: providers.length, adapters: adapters.length }
  })

  // App handlers
  ipcMain.handle('app:get-version', () => app.getVersion())
  ipcMain.handle('app:get-platform', () => process.platform)
  ipcMain.handle('app:open-external', (_event, url: string) => shell.openExternal(url))
  ipcMain.handle('app:show-item-in-folder', (_event, path: string) => shell.showItemInFolder(path))
  ipcMain.handle('app:get-path', (_event, name: 'userData' | 'logs' | 'temp') => app.getPath(name))

  console.log('[IPC] All handlers registered')
}

// Get the icon path based on platform
function getIconPath(): string | undefined {
  if (process.platform === 'linux') {
    return join(__dirname, '../../resources/icons/icon.png')
  }
  return undefined // macOS and Windows use their own icon formats
}

function createWindow(): void {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    // Traffic lights position: y=12 so button center (~18px) aligns with header content center (38px/2=19px)
    ...(process.platform === 'darwin' && {
      trafficLightPosition: { x: 14, y: 12 }
    }),
    icon: getIconPath(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    
    // Open DevTools in development
    if (!app.isPackaged) {
      mainWindow?.webContents.openDevTools()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Load the remote URL for development or the local html file for production
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Get main window instance
export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

// Show main window
export function showMainWindow(): void {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }
    mainWindow.focus()
  } else {
    createWindow()
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.amux.desktop')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize crypto service (must be before database for API key encryption)
  console.log('[App] Initializing crypto service...')
  try {
    const { initCrypto } = await import('./services/crypto')
    await initCrypto()
    console.log('[App] Crypto service initialized')
  } catch (error) {
    console.error('[App] Failed to initialize crypto service:', error)
  }

  // Initialize database
  console.log('[App] Initializing database...')
  const db = initDatabase()
  
  // Run migrations
  console.log('[App] Running database migrations...')
  runMigrations(db)
  
  // Initialize default providers if database is empty
  initializeDefaultProviders()

  // Initialize logger service
  import('./services/logger').then(({ initLogger }) => {
    initLogger()
  })

  // Register IPC handlers (after database is ready)
  registerIpcHandlers()

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Handle app before quit
app.on('before-quit', async () => {
  // Shutdown logger (flush remaining logs)
  try {
    const { shutdownLogger } = await import('./services/logger')
    shutdownLogger()
  } catch (e) {
    // Ignore errors during shutdown
  }
  
  // Close database connection
  closeDatabase()
  console.log('[App] Cleanup completed')
})
