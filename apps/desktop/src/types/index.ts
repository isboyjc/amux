/**
 * Shared type definitions
 */

// Adapter types supported
export type AdapterType = 'openai' | 'openai-responses' | 'anthropic' | 'deepseek' | 'moonshot' | 'qwen' | 'zhipu' | 'google'

// Provider configuration
export interface Provider {
  id: string
  name: string
  adapterType: AdapterType
  apiKey?: string
  baseUrl?: string
  chatPath?: string  // API endpoint for chat completions
  modelsPath?: string // API endpoint for listing models
  models?: string[]
  isCustom?: boolean
  enabled: boolean
  sortOrder: number
  logo?: string  // Base64 data URL for logo
  color?: string // Brand color hex code
  enableAsProxy?: boolean // Enable provider as passthrough proxy
  proxyPath?: string | null // URL path identifier for passthrough proxy
  createdAt: number
  updatedAt: number
}

// Bridge Proxy configuration
export interface BridgeProxy {
  id: string
  name?: string
  inboundAdapter: AdapterType
  outboundType: 'provider' | 'proxy'
  outboundId: string
  proxyPath: string
  enabled: boolean
  sortOrder: number
  createdAt: number
  updatedAt: number
}

// Model mapping
export interface ModelMapping {
  id: string
  proxyId: string
  sourceModel: string
  targetModel: string
  isDefault: boolean
}

// API Key (unified key)
export interface ApiKey {
  id: string
  key: string
  name?: string
  enabled: boolean
  createdAt: number
  lastUsedAt?: number
}

// Request log entry
export interface RequestLog {
  id: string
  proxyId?: string
  proxyPath: string
  sourceModel: string
  targetModel: string
  statusCode: number
  inputTokens?: number
  outputTokens?: number
  latencyMs: number
  requestBody?: string
  responseBody?: string
  error?: string
  createdAt: number
}

// Proxy service state
export interface ProxyServiceState {
  status: 'running' | 'stopped' | 'starting' | 'stopping' | 'error'
  port: number | null
  host: string | null
  error: string | null
}

// Proxy metrics
export interface ProxyMetrics {
  totalRequests: number
  successRequests: number
  failedRequests: number
  averageLatency: number
  p50Latency: number
  p95Latency: number
  p99Latency: number
  requestsPerMinute: number
  activeConnections: number
  totalInputTokens: number
  totalOutputTokens: number
  windowStart: number
  windowEnd: number
}

// Settings schema
export interface SettingsSchema {
  // App settings
  'app.autoLaunch': boolean
  'app.minimizeToTray': boolean
  'app.hasShownTrayNotification': boolean
  'app.theme': 'light' | 'dark' | 'system'
  'app.language': 'zh-CN' | 'en-US'
  
  // Proxy settings
  'proxy.port': number
  'proxy.host': string
  'proxy.autoStart': boolean
  'proxy.timeout': number
  'proxy.cors.enabled': boolean
  'proxy.cors.origins': string[]
  
  // Retry settings
  'proxy.retry.enabled': boolean
  'proxy.retry.maxRetries': number
  'proxy.retry.retryDelay': number
  'proxy.retry.retryOn': number[]
  
  // Circuit breaker settings
  'proxy.circuitBreaker.enabled': boolean
  'proxy.circuitBreaker.threshold': number
  'proxy.circuitBreaker.resetTimeout': number
  
  // SSE settings
  'proxy.sse.heartbeatInterval': number
  'proxy.sse.connectionTimeout': number
  
  // Log settings
  'logs.enabled': boolean
  'logs.saveRequestBody': boolean
  'logs.saveResponseBody': boolean
  'logs.maxBodySize': number
  'logs.retentionDays': number
  'logs.maxEntries': number
  
  // Security settings
  'security.masterKey': string
  'security.masterPassword.enabled': boolean
  'security.masterPassword.hash': string
  'security.masterPassword.salt': string
  'security.unifiedApiKey.enabled': boolean
  
  // Preset settings
  'presets.lastUpdated': number
  'presets.autoUpdate': boolean
}

// Provider preset from JSON config
export interface ProviderPreset {
  id: string
  name: string
  adapterType: string
  baseUrl: string
  chatPath?: string   // API endpoint for chat completions
  modelsPath?: string // API endpoint for listing models
  logo: string  // Base64 data URL for logo
  color: string // Brand color hex code
  models: Array<{
    id: string
    name: string
    contextLength?: number
    capabilities?: string[]
  }>
}

// Presets config
export interface PresetsConfig {
  version: string
  minClientVersion: string
  updatedAt: string
  providers: ProviderPreset[]
}

// Adapter preset from JSON config
export interface AdapterPreset {
  id: string
  name: string
  description: string
  provider: string // corresponding provider type
}
