/**
 * IPC type definitions for type-safe communication between main and renderer processes
 */

import type {
  Provider,
  BridgeProxy,
  ModelMapping,
  ApiKey,
  RequestLog,
  SettingsSchema,
  ProxyServiceState,
  ProxyMetrics,
  AdapterType,
  Conversation,
  ChatMessage
} from './index'

// ============ DTOs ============

export interface CreateProviderDTO {
  name: string
  adapterType: AdapterType
  apiKey?: string
  baseUrl?: string
  chatPath?: string
  modelsPath?: string
  models?: string[]
  enabled?: boolean
  logo?: string
  color?: string
}

export interface UpdateProviderDTO {
  name?: string
  adapterType?: AdapterType
  apiKey?: string
  baseUrl?: string
  chatPath?: string
  modelsPath?: string
  models?: string[]
  enabled?: boolean
  sortOrder?: number
  logo?: string
  color?: string
  enableAsProxy?: boolean
  proxyPath?: string | null
}

export interface CreateProxyDTO {
  name?: string
  inboundAdapter: AdapterType
  outboundType: 'provider' | 'proxy'
  outboundId: string
  proxyPath: string
  enabled?: boolean
  modelMappings?: Array<{
    sourceModel: string
    targetModel: string
    isDefault?: boolean
  }>
}

export interface UpdateProxyDTO {
  name?: string
  inboundAdapter?: AdapterType
  outboundType?: 'provider' | 'proxy'
  outboundId?: string
  proxyPath?: string
  enabled?: boolean
  sortOrder?: number
}

export interface ProxyServiceConfig {
  port?: number
  host?: string
}

export interface ProviderTestResult {
  success: boolean
  latency: number
  error?: string
  models?: string[]
  rateLimit?: {
    limit: number
    remaining: number
    reset: number
  }
}

export interface LogFilter {
  proxyId?: string
  proxyPath?: string
  statusCode?: number
  statusRange?: 'success' | 'error' | 'all'
  startDate?: number
  endDate?: number
  search?: string
}

export interface PaginationOptions {
  page: number
  pageSize: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ExportOptions {
  includeProviders: boolean
  includeProxies: boolean
  includeApiKeys: boolean
  includeSettings: boolean
  encryptionPassword?: string
}

export type ConflictStrategy = 'skip' | 'overwrite' | 'rename'

export interface ImportResult {
  success: boolean
  imported: {
    providers: number
    proxies: number
    apiKeys: number
    settings: number
  }
  errors: string[]
}

// Chat DTOs
export interface CreateConversationDTO {
  title?: string
  providerId?: string
  proxyId?: string
  model: string
  systemPrompt?: string
}

export interface UpdateConversationDTO {
  title?: string
  providerId?: string
  proxyId?: string
  model?: string
  systemPrompt?: string
}

// ============ IPC Handlers ============

export interface IPCHandlers {
  // Provider operations
  'provider:list': () => Promise<Provider[]>
  'provider:get': (id: string) => Promise<Provider | null>
  'provider:create': (data: CreateProviderDTO) => Promise<Provider>
  'provider:update': (id: string, data: UpdateProviderDTO) => Promise<Provider | null>
  'provider:delete': (id: string) => Promise<boolean>
  'provider:test': (id: string) => Promise<ProviderTestResult>
  'provider:fetch-models': (id: string) => Promise<string[]>
  'provider:toggle': (id: string, enabled: boolean) => Promise<boolean>
  'provider:validate-proxy-path': (path: string, excludeId?: string) => Promise<boolean>
  'provider:generate-proxy-path': (name: string, adapterType: AdapterType) => Promise<string>

  // Bridge Proxy operations
  'proxy:list': () => Promise<BridgeProxy[]>
  'proxy:get': (id: string) => Promise<BridgeProxy | null>
  'proxy:create': (data: CreateProxyDTO) => Promise<BridgeProxy>
  'proxy:update': (id: string, data: UpdateProxyDTO) => Promise<BridgeProxy | null>
  'proxy:delete': (id: string) => Promise<boolean>
  'proxy:validate-path': (path: string, excludeId?: string) => Promise<boolean>
  'proxy:check-circular': (proxyId: string, outboundId: string) => Promise<string[] | null>
  'proxy:toggle': (id: string, enabled: boolean) => Promise<boolean>
  'proxy:get-mappings': (proxyId: string) => Promise<ModelMapping[]>
  'proxy:set-mappings': (proxyId: string, mappings: Array<{
    sourceModel: string
    targetModel: string
    isDefault?: boolean
  }>) => Promise<ModelMapping[]>
  'proxy:test': (proxyId: string) => Promise<{ success: boolean; error?: string }>

  // Proxy Service operations
  'proxy-service:start': (config?: ProxyServiceConfig) => Promise<void>
  'proxy-service:stop': () => Promise<void>
  'proxy-service:restart': (config?: ProxyServiceConfig) => Promise<void>
  'proxy-service:status': () => Promise<ProxyServiceState>
  'proxy-service:metrics': () => Promise<ProxyMetrics>

  // Settings operations
  'settings:get': <K extends keyof SettingsSchema>(key: K) => Promise<SettingsSchema[K] | undefined>
  'settings:set': <K extends keyof SettingsSchema>(key: K, value: SettingsSchema[K]) => Promise<void>
  'settings:getAll': () => Promise<Partial<SettingsSchema>>
  'settings:setMany': (settings: Partial<SettingsSchema>) => Promise<void>

  // API Key operations
  'api-key:list': () => Promise<ApiKey[]>
  'api-key:create': (name?: string) => Promise<ApiKey>
  'api-key:delete': (id: string) => Promise<boolean>
  'api-key:toggle': (id: string, enabled: boolean) => Promise<boolean>
  'api-key:rename': (id: string, name: string) => Promise<ApiKey | null>

  // Log operations
  'logs:query': (filter: LogFilter, pagination: PaginationOptions) => Promise<PaginatedResult<RequestLog>>
  'logs:get-stats': (filter?: LogFilter) => Promise<{
    totalRequests: number
    successRequests: number
    failedRequests: number
    totalInputTokens: number
    totalOutputTokens: number
    averageLatency: number
  }>
  'logs:export': (filter: LogFilter, format: 'json' | 'csv') => Promise<string>
  'logs:clear': (before?: number) => Promise<number>
  'logs:cleanup': () => Promise<{ deletedByDate: number; deletedByCount: number }>

  // Config export/import
  'config:export': (options: ExportOptions) => Promise<string>
  'config:import': (filePath: string, strategy: ConflictStrategy) => Promise<ImportResult>

  // Presets operations
  'presets:get-providers': () => Promise<Array<{
    id: string
    name: string
    adapterType: string
    baseUrl: string
    chatPath?: string
    modelsPath?: string
    logo?: string
    color?: string
    models: Array<{
      id: string
      name: string
      contextLength?: number
      capabilities?: string[]
    }>
  }>>
  'presets:get-adapters': () => Promise<Array<{
    id: string
    name: string
    description: string
    provider: string
  }>>
  'presets:refresh': () => Promise<{ providers: number; adapters: number }>

  // Provider models fetch
  'providers:fetch-models': (params: {
    baseUrl: string
    apiKey: string
    modelsPath: string
    adapterType: string
  }) => Promise<{
    success: boolean
    models: Array<{ id: string; name?: string }>
    error?: string
  }>

  // App operations
  'app:get-version': () => Promise<string>
  'app:get-platform': () => Promise<string>
  'app:open-external': (url: string) => Promise<void>
  'app:show-item-in-folder': (path: string) => Promise<void>
  'app:get-path': (name: 'userData' | 'logs' | 'temp') => Promise<string>

  // Chat operations
  'chat:list-conversations': () => Promise<Conversation[]>
  'chat:get-conversation': (id: string) => Promise<Conversation | null>
  'chat:create-conversation': (data: CreateConversationDTO) => Promise<Conversation>
  'chat:update-conversation': (id: string, data: UpdateConversationDTO) => Promise<Conversation | null>
  'chat:delete-conversation': (id: string) => Promise<boolean>
  'chat:get-messages': (conversationId: string) => Promise<ChatMessage[]>
  'chat:send-message': (
    conversationId: string,
    content: string,
    selectedModel?: string,
    selectedProxy?: { type: 'provider' | 'proxy'; id: string }
  ) => Promise<void>
  'chat:stop-streaming': (conversationId: string) => Promise<void>
  'chat:delete-message': (messageId: string) => Promise<boolean>
  'chat:delete-message-pair': (userMessageId: string) => Promise<boolean>
  'chat:regenerate': (
    conversationId: string,
    assistantMessageId: string,
    selectedModel?: string,
    selectedProxy?: { type: 'provider' | 'proxy'; id: string }
  ) => Promise<void>

  // OAuth operations
  'oauth:getAuthUrl': (providerType: string) => Promise<{ success: boolean; authUrl?: string; state?: string; error?: string }>
  'oauth:authorize': (providerType: string) => Promise<{ success: boolean; account?: any; error?: string }>
  'oauth:cancelAuthorize': (providerType: string, state: string) => Promise<{ success: boolean; error?: string }>
  'oauth:getAccounts': (providerType?: string) => Promise<{ success: boolean; accounts: any[]; error?: string }>
  'oauth:deleteAccount': (accountId: string, options?: { deleteIndividualProvider?: boolean; cleanupPool?: boolean }) => Promise<{ success: boolean; error?: string }>
  'oauth:refreshToken': (accountId: string) => Promise<{ success: boolean; error?: string }>
  'oauth:updateQuota': (accountId: string) => Promise<{ success: boolean; error?: string }>
  'oauth:togglePoolEnabled': (accountId: string, enabled: boolean) => Promise<{ success: boolean; error?: string }>
  'oauth:getPoolStats': (providerType: string) => Promise<{ success: boolean; stats?: any; error?: string }>
  'oauth:generateIndividualProvider': (accountId: string) => Promise<{ success: boolean; provider?: any; error?: string }>
  'oauth:generatePoolProvider': (providerType: string, strategy: string) => Promise<{ success: boolean; provider?: any; error?: string }>

  // Updater operations
  'updater:check': () => Promise<{
    currentVersion: string
    latestVersion: string
    hasUpdate: boolean
    releaseUrl: string
    releaseNotes: string
    publishedAt: string
  }>
  'updater:get-release-url': () => Promise<string>
  'updater:open-release-page': () => Promise<void>
}

// ============ IPC Events (Main -> Renderer) ============

export interface IPCEvents {
  'proxy-service:state-changed': (state: ProxyServiceState) => void
  'proxy-service:request': (data: {
    proxyPath: string
    model: string
    timestamp: number
  }) => void
  'settings:changed': (key: keyof SettingsSchema, value: unknown) => void
  'app:theme-changed': (theme: 'light' | 'dark') => void

  // Chat streaming events
  'chat:stream-start': () => void
  'chat:stream-content': (content: string) => void
  'chat:stream-reasoning': (reasoning: string) => void
  'chat:stream-end': (message: ChatMessage) => void
  'chat:stream-error': (error: string) => void
}
