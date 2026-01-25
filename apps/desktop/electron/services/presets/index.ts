/**
 * Presets service - Load and manage provider presets
 */

import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { getSettingsRepository } from '../database/repositories'

// Types for provider presets
export interface ModelPreset {
  id: string
  name: string
  contextLength?: number
  capabilities?: string[]
  deprecated?: boolean
}

export interface ProviderPreset {
  id: string
  name: string
  adapterType: string
  baseUrl: string
  chatPath?: string
  modelsPath?: string
  models: ModelPreset[]
  logo?: string
  color?: string
}

export interface PresetsConfig {
  version: string
  minClientVersion: string
  updatedAt: string
  providers: ProviderPreset[]
}

// Default remote URL
const DEFAULT_REMOTE_URL = 'https://raw.githubusercontent.com/isboyjc/amux/main/apps/desktop/resources/presets/providers.json'

// Cache file name
const PRESETS_CACHE_FILE = 'presets-cache.json'

// In-memory cache
let presetsCache: PresetsConfig | null = null
let lastFetchTime = 0

/**
 * Get the path to built-in presets
 */
function getBuiltinPresetsPath(): string {
  // In development, use the resources folder directly
  // In production, use the extraResources path
  if (app.isPackaged) {
    return join(process.resourcesPath, 'presets', 'providers.json')
  }
  // __dirname is out/main/, so go up 2 levels to apps/desktop/
  return join(__dirname, '../../resources/presets/providers.json')
}

/**
 * Get the path to cached presets
 */
function getCachePresetsPath(): string {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, PRESETS_CACHE_FILE)
}

/**
 * Load built-in presets from resources folder
 */
export function loadBuiltinPresets(): PresetsConfig | null {
  const path = getBuiltinPresetsPath()
  
  console.log('[Presets] Loading built-in presets from:', path)
  console.log('[Presets] File exists:', existsSync(path))
  
  try {
    if (existsSync(path)) {
      const content = readFileSync(path, 'utf8')
      const config = JSON.parse(content) as PresetsConfig
      console.log(`[Presets] Loaded ${config.providers.length} built-in providers`)
      return config
    } else {
      console.error('[Presets] Built-in presets file not found at:', path)
    }
  } catch (error) {
    console.error('[Presets] Failed to load built-in presets:', error)
  }
  
  return null
}

/**
 * Load cached presets from user data folder
 */
export function loadCachedPresets(): PresetsConfig | null {
  const path = getCachePresetsPath()
  
  try {
    if (existsSync(path)) {
      const content = readFileSync(path, 'utf8')
      return JSON.parse(content) as PresetsConfig
    }
  } catch (error) {
    console.error('[Presets] Failed to load cached presets:', error)
  }
  
  return null
}

/**
 * Save presets to cache
 */
function saveCachedPresets(presets: PresetsConfig): void {
  const path = getCachePresetsPath()
  
  try {
    const dir = app.getPath('userData')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    
    writeFileSync(path, JSON.stringify(presets, null, 2))
    console.log('[Presets] Cache saved')
  } catch (error) {
    console.error('[Presets] Failed to save cache:', error)
  }
}

/**
 * Fetch presets from remote URL
 */
export async function fetchRemotePresets(url?: string): Promise<PresetsConfig | null> {
  const settings = getSettingsRepository()
  const remoteUrl = url ?? settings.get('presets.remoteUrl') ?? DEFAULT_REMOTE_URL
  
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000) // 10s timeout
    
    const response = await fetch(remoteUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    })
    
    clearTimeout(timeout)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json() as PresetsConfig
    
    // Update last fetch time in settings
    settings.set('presets.lastUpdated', Date.now())
    
    // Cache the result
    saveCachedPresets(data)
    
    console.log('[Presets] Remote presets fetched successfully')
    return data
  } catch (error) {
    // Silently fail - will use builtin presets as fallback
    // Only log in development mode
    if (!app.isPackaged) {
      console.warn('[Presets] Failed to fetch remote presets:', error)
    }
    return null
  }
}

/**
 * Compare version strings (semver)
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number)
  const parts2 = v2.split('.').map(Number)
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] ?? 0
    const p2 = parts2[i] ?? 0
    
    if (p1 < p2) return -1
    if (p1 > p2) return 1
  }
  
  return 0
}

/**
 * Merge remote and built-in presets
 * Remote presets take precedence
 */
function mergePresets(remote: PresetsConfig | null, builtin: PresetsConfig | null): PresetsConfig {
  if (!remote && !builtin) {
    return {
      version: '0.0.0',
      minClientVersion: '0.0.0',
      updatedAt: new Date().toISOString(),
      providers: []
    }
  }
  
  if (!remote) return builtin!
  if (!builtin) return remote
  
  // Use remote as base, add any built-in providers not in remote
  const remoteIds = new Set(remote.providers.map(p => p.id))
  const additionalProviders = builtin.providers.filter(p => !remoteIds.has(p.id))
  
  return {
    ...remote,
    providers: [...remote.providers, ...additionalProviders]
  }
}

/**
 * Initialize presets service
 * Loads from cache/built-in and starts background refresh
 */
export async function initPresets(): Promise<PresetsConfig> {
  console.log('[Presets] Starting initialization...')
  
  // Try loading in order: cache -> built-in
  const cached = loadCachedPresets()
  console.log('[Presets] Cached presets:', cached ? `${cached.providers.length} providers` : 'none')
  
  const builtin = loadBuiltinPresets()
  console.log('[Presets] Built-in presets:', builtin ? `${builtin.providers.length} providers` : 'none')
  
  presetsCache = mergePresets(cached, builtin)
  lastFetchTime = Date.now()
  
  console.log(`[Presets] Initialized with ${presetsCache.providers.length} providers`)
  
  // Background refresh if auto-update is enabled
  const settings = getSettingsRepository()
  const autoUpdate = settings.get('presets.autoUpdate') ?? true
  
  if (autoUpdate) {
    // Don't await - let it run in background
    refreshPresetsInBackground()
  }
  
  return presetsCache
}

/**
 * Refresh presets in background
 */
async function refreshPresetsInBackground(): Promise<void> {
  try {
    const remote = await fetchRemotePresets()
    if (remote) {
      const builtin = loadBuiltinPresets()
      presetsCache = mergePresets(remote, builtin)
      console.log('[Presets] Background refresh completed')
    }
  } catch (error) {
    // Silently fail - will continue using cached/builtin presets
    if (!app.isPackaged) {
      console.warn('[Presets] Background refresh failed:', error)
    }
  }
}

/**
 * Get all provider presets
 */
export function getProviderPresets(): ProviderPreset[] {
  return presetsCache?.providers ?? []
}

/**
 * Get a specific provider preset by ID
 */
export function getProviderPreset(id: string): ProviderPreset | null {
  return presetsCache?.providers.find(p => p.id === id) ?? null
}

/**
 * Get models for a specific provider
 */
export function getModelsByProvider(providerId: string): ModelPreset[] {
  const provider = getProviderPreset(providerId)
  return provider?.models ?? []
}

/**
 * Get model by provider and model ID
 */
export function getModel(providerId: string, modelId: string): ModelPreset | null {
  const models = getModelsByProvider(providerId)
  return models.find(m => m.id === modelId) ?? null
}

/**
 * Manually refresh presets
 */
export async function refreshPresets(): Promise<PresetsConfig> {
  const remote = await fetchRemotePresets()
  const builtin = loadBuiltinPresets()
  
  presetsCache = mergePresets(remote, builtin)
  lastFetchTime = Date.now()
  
  return presetsCache
}

/**
 * Check if presets need refresh (older than 24 hours)
 */
export function needsRefresh(): boolean {
  const settings = getSettingsRepository()
  const lastUpdated = settings.get('presets.lastUpdated') ?? 0
  const now = Date.now()
  const dayInMs = 24 * 60 * 60 * 1000
  
  return now - lastUpdated > dayInMs
}

/**
 * Get presets metadata
 */
export function getPresetsMetadata(): {
  version: string
  updatedAt: string
  providerCount: number
  lastFetchTime: number
} {
  return {
    version: presetsCache?.version ?? '0.0.0',
    updatedAt: presetsCache?.updatedAt ?? '',
    providerCount: presetsCache?.providers.length ?? 0,
    lastFetchTime
  }
}

/**
 * Get adapter types supported
 */
export function getSupportedAdapterTypes(): string[] {
  const types = new Set<string>()
  for (const provider of presetsCache?.providers ?? []) {
    types.add(provider.adapterType)
  }
  return Array.from(types)
}
