/**
 * Provider Generator
 * 
 * 自动生成Provider配置（单账号模式或Pool模式）
 */

import * as fs from 'fs'
import * as path from 'path'

import { app } from 'electron'

import { encryptApiKey } from '../crypto'
import { getProviderRepository, getOAuthAccountRepository } from '../database/repositories'
import type { ProviderRow, OAuthAccountRow } from '../database/types'
import { getOAuthKeyManager } from '../proxy-server/oauth/key-manager'

/**
 * OAuth Provider 预设配置
 */
interface OAuthProviderPreset {
  id: string
  name: string
  displayName: string
  description: string
  adapterType: string
  baseUrl: string
  chatPath: string
  modelsPath: string | null
  logo: string | null
  color: string
  modelStrategy: 'hardcoded' | 'dynamic'
  models: Array<{
    id: string
    name: string
  }>
}

interface OAuthProvidersConfig {
  version: string
  minClientVersion: string
  updatedAt: string
  description: string
  providers: OAuthProviderPreset[]
}

export type ProviderGenerationMode = 'individual' | 'pool'

export interface GenerateProviderOptions {
  mode: ProviderGenerationMode
  poolStrategy?: 'round_robin' | 'least_used' | 'quota_aware'
}

export interface GenerateProviderResult {
  success: boolean
  provider?: ProviderRow
  error?: string
}

export class ProviderGenerator {
  private oauthProviderPresets: Map<string, OAuthProviderPreset> | null = null

  /**
   * 获取资源文件路径（兼容开发和生产环境）
   */
  private getResourcePath(filename: string): string {
    if (app.isPackaged) {
      // 生产环境：extraResources 映射到 process.resourcesPath/presets
      // 参考 electron-builder.json: "from": "resources/presets", "to": "presets"
      return path.join(process.resourcesPath, 'presets', filename)
    } else {
      // 开发环境：__dirname 在 out/main/chunks，需要向上 3 级到达项目根目录
      // out/main/chunks -> out/main -> out -> 项目根目录
      return path.join(__dirname, '..', '..', '..', 'resources', 'presets', filename)
    }
  }

  /**
   * 加载 OAuth Provider 预设配置
   */
  private loadOAuthProviderPresets(): Map<string, OAuthProviderPreset> {
    if (this.oauthProviderPresets) {
      return this.oauthProviderPresets
    }

    try {
      // 从 resources/presets 读取配置
      const presetsPath = this.getResourcePath('oauth-providers.json')
      
      const configData = fs.readFileSync(presetsPath, 'utf-8')
      const config: OAuthProvidersConfig = JSON.parse(configData)

      this.oauthProviderPresets = new Map()
      for (const provider of config.providers) {
        this.oauthProviderPresets.set(provider.id, provider)
      }

      return this.oauthProviderPresets
    } catch (error) {
      console.error('[ProviderGenerator] Failed to load OAuth provider presets:', error)
      // 返回空 Map，使用硬编码的默认值
      return new Map()
    }
  }

  /**
   * 为OAuth账号生成Provider配置
   */
  async generateProvider(
    account: OAuthAccountRow,
    options: GenerateProviderOptions
  ): Promise<GenerateProviderResult> {
    try {
      if (options.mode === 'individual') {
        return await this.generateIndividualProvider(account)
      } else {
        return await this.generatePoolProvider(account, options.poolStrategy || 'round_robin')
      }
    } catch (error) {
      console.error('[ProviderGenerator] Failed to generate provider:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate provider'
      }
    }
  }

  /**
   * 生成单账号Provider
   */
  private async generateIndividualProvider(account: OAuthAccountRow): Promise<GenerateProviderResult> {
    const repo = getProviderRepository()
    
    // 映射provider类型
    const { adapterType, baseUrl, chatPath, modelsPath, models, logo, color, displayName } = 
      await this.getProviderMapping(account.provider_type)
    
    // 检查是否已存在该账号的provider
    const existingProviders = repo.findAll().filter(p => 
      p.oauth_account_id === account.id && p.is_pool === 0
    )
    
    if (existingProviders.length > 0) {
      // 更新现有provider
      const provider = existingProviders[0]
      if (!provider) {
        return {
          success: false,
          error: 'Provider not found'
        }
      }
      
      const updated = repo.update(provider.id, {
        enabled: true
      })
      
      if (!updated) {
        return {
          success: false,
          error: 'Failed to update provider'
        }
      }
      
      
      return {
        success: true,
        provider: updated
      }
    }
    
    // 创建新provider
    const provider = repo.create({
      name: `${displayName} - ${account.email}`,  // 使用 displayName
      adapterType: adapterType,
      apiKey: undefined, // OAuth不使用API key
      baseUrl: baseUrl,
      chatPath: chatPath,
      modelsPath: modelsPath,
      models: models,
      enabled: true,
      logo: logo || undefined,
      color: color || undefined,
      isPool: false,
      poolStrategy: undefined,
      oauthAccountId: account.id,
      oauthProviderType: account.provider_type,
      enableAsProxy: true,  // 默认开启直通代理
      proxyPath: `${account.provider_type.toLowerCase()}-${account.id.substring(0, 8)}`  // 自动生成代理路径
    })
    
    
    return {
      success: true,
      provider
    }
  }

  /**
   * 生成或更新Pool Provider
   */
  private async generatePoolProvider(
    account: OAuthAccountRow,
    strategy: 'round_robin' | 'least_used' | 'quota_aware'
  ): Promise<GenerateProviderResult> {
    const repo = getProviderRepository()
    
    // 映射provider类型
    const { adapterType, baseUrl, chatPath, modelsPath, models, logo, color, displayName } = 
      await this.getProviderMapping(account.provider_type)
    
    // 查找是否已存在该类型的pool provider
    const existingPool = repo.findAll().find(p => 
      p.is_pool === 1 && p.oauth_provider_type === account.provider_type
    )
    
    if (existingPool) {
      // 更新现有pool provider的策略
      const updated = repo.update(existingPool.id, {
        poolStrategy: strategy,
        enabled: true
      })
      
      if (!updated) {
        return {
          success: false,
          error: 'Failed to update provider'
        }
      }
      
      
      return {
        success: true,
        provider: updated
      }
    }
    
    // 创建新的pool provider
    const provider = repo.create({
      name: `${displayName} Pool`,  // 使用 displayName
      adapterType: adapterType,
      apiKey: undefined,
      baseUrl: baseUrl,
      chatPath: chatPath,
      modelsPath: modelsPath,
      models: models,
      enabled: true,
      logo: logo || undefined,
      color: color || undefined,
      isPool: true,
      poolStrategy: strategy,
      oauthAccountId: undefined, // Pool provider不关联单个账号
      oauthProviderType: account.provider_type,
      enableAsProxy: true,  // 默认开启直通代理
      proxyPath: `${account.provider_type.toLowerCase()}-pool`  // 代理路径: codex-pool, antigravity-pool
    })
    
    
    return {
      success: true,
      provider
    }
  }

  /**
   * 🆕 确保 Pool Provider 存在（如果不存在则创建）
   * OAuth 账号授权成功后自动调用
   * 
   * @param providerType - OAuth provider type (codex, antigravity)
   * @returns Provider ID
   */
  async ensurePoolProvider(providerType: string): Promise<string> {
    const repo = getProviderRepository()
    
    
    // 1. 查找是否已存在该类型的 pool provider
    const existingPool = repo.findAll().find(p => 
      p.is_pool === 1 && p.oauth_provider_type === providerType
    )
    
    if (existingPool) {
      
      // 🆕 获取最新配置（包括 OAuth 服务 API Key）
      const mapping = await this.getProviderMapping(providerType)
      
      // 🆕 更新现有 Provider 的配置（baseUrl, apiKey, modelsPath 等）
      repo.update(existingPool.id, {
        baseUrl: mapping.baseUrl,
        chatPath: mapping.chatPath,
        modelsPath: mapping.modelsPath,  // 🆕 更新 modelsPath
        apiKey: encryptApiKey(mapping.apiKey),  // 🔐 加密 API Key
        adapterType: mapping.adapterType,
        models: mapping.models
      })
      
      // 🆕 如果有 modelsPath 且不是 Codex，则异步获取真实模型列表
      // ✅ 使用新的 modelsPath（而不是数据库旧值）
      if (mapping.modelsPath && providerType !== 'codex') {
        this.fetchAndUpdateModels(existingPool.id).catch(error => {
          console.error(`[ProviderGenerator] Failed to fetch models for ${providerType}:`, error)
        })
      }
      return existingPool.id
    }
    
    // 2. 不存在则创建新的 pool provider
    const { adapterType, baseUrl, chatPath, modelsPath, models: presetModels, logo, color, displayName, apiKey } = 
      await this.getProviderMapping(providerType)
    
    // 🆕 对于 Antigravity，先获取真实的模型列表（同步）
    let initialModels = presetModels
    if (providerType === 'antigravity' && modelsPath) {
      try {
        const fetchedModels = await this.fetchModels(baseUrl, modelsPath, apiKey, providerType)
        if (fetchedModels.length > 0) {
          initialModels = fetchedModels
        }
      } catch (error) {
        console.error(`[ProviderGenerator] Failed to fetch models, using preset models:`, error)
      }
    }
    
    // 3. 创建新的 pool provider
    const provider = repo.create({
      name: `${displayName} Pool`,  // 使用 displayName
      adapterType: adapterType,
      apiKey: encryptApiKey(apiKey),  // 🔐 加密 OAuth 服务 API Key
      baseUrl: baseUrl,  // 🆕 指向 OAuth 转换服务
      chatPath: chatPath,  // 🆕 根据 provider type 设置
      modelsPath: modelsPath,  // 🆕 设置 modelsPath
      models: initialModels,  // 🆕 使用获取到的模型列表
      enabled: true,
      logo: logo || undefined,
      color: color || undefined,
      isPool: true,
      poolStrategy: 'round_robin',  // 默认策略
      oauthAccountId: undefined,
      oauthProviderType: providerType,
      enableAsProxy: true,  // ✅ 使用 passthrough 架构
      proxyPath: `${providerType.toLowerCase()}-pool`  // 代理路径: codex-pool, antigravity-pool
    })
    
    return provider.id
  }
  
  /**
   * 🆕 获取模型列表（可复用的底层方法）
   * 
   * @param baseUrl - Provider base URL
   * @param modelsPath - Models endpoint path
   * @param apiKey - OAuth service API key
   * @param providerType - OAuth provider type
   * @returns 模型 ID 列表
   */
  private async fetchModels(
    baseUrl: string,
    modelsPath: string,
    apiKey: string,
    providerType: string
  ): Promise<string[]> {
    try {
      const fullUrl = `${baseUrl}${modelsPath}`
      
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(15000)
      })

      if (!response.ok) {
        return []
      }

      const data = await response.json()

      // 解析模型列表
      let models: string[] = []
      
      // 🆕 Antigravity v1internal:fetchAvailableModels 返回格式特殊
      if (providerType === 'antigravity' && data.models && typeof data.models === 'object' && !Array.isArray(data.models)) {
        // 格式: { models: { "model-name": {...}, ... } }
        models = Object.keys(data.models).filter(Boolean)
      } else if (Array.isArray(data)) {
        models = data.map((m: { id?: string }) => m.id || '').filter(Boolean)
      } else if (data.data && Array.isArray(data.data)) {
        // OpenAI format
        models = data.data.map((m: { id: string }) => m.id).filter(Boolean)
      } else if (data.models && Array.isArray(data.models)) {
        // Gemini / Google format
        models = data.models.map((m: { id?: string; name?: string; model?: string }) => {
          let modelId = m.id || m.model || ''
          if (!modelId && m.name && m.name.startsWith('models/')) {
            modelId = m.name.replace('models/', '')
          } else if (!modelId) {
            modelId = m.name || ''
          }
          return modelId
        }).filter(Boolean)
      }

      return models
    } catch (error) {
      console.error(`[ProviderGenerator] Error fetching models:`, error)
      return []
    }
  }

  /**
   * 🆕 获取并更新 Provider 的模型列表
   * 
   * @param providerId - Provider ID
   */
  private async fetchAndUpdateModels(providerId: string): Promise<void> {
    try {
      const repo = getProviderRepository()
      const provider = repo.findById(providerId)
      if (!provider) {
        console.warn(`[ProviderGenerator] Provider not found: ${providerId}`)
        return
      }

      const baseUrl = provider.base_url || ''
      const modelsPath = provider.models_path || ''
      const oauthProviderType = provider.oauth_provider_type
      
      if (!baseUrl || !modelsPath || !oauthProviderType) {
        console.warn(`[ProviderGenerator] Missing required fields for ${provider.name}`)
        return
      }

      // 获取 OAuth 服务 API Key
      const keyManager = getOAuthKeyManager()
      const oauthServiceKey = await keyManager.getOrCreateKey(oauthProviderType as any)
      
      // 调用复用的获取模型方法
      const models = await this.fetchModels(baseUrl, modelsPath, oauthServiceKey, oauthProviderType)

      if (models.length > 0) {
        // 更新 Provider 的模型列表
        repo.update(providerId, {
          models: models
        })
      }
    } catch (error) {
      console.error(`[ProviderGenerator] Error fetching models:`, error)
    }
  }

  /**
   * 🆕 清理孤立的 Pool Provider（没有活跃账号时删除）
   */
  async cleanupOrphanedPoolProviders(providerType: string): Promise<void> {
    try {
      const providerRepo = getProviderRepository()
      const oauthRepo = getOAuthAccountRepository()
      
      
      // 1. 查找该类型的 Pool Provider
      const poolProvider = providerRepo.findAll().find(p => 
        p.is_pool === 1 && p.oauth_provider_type === providerType
      )
      
      if (!poolProvider) {
        return
      }
      
      // 2. 检查是否还有该类型的活跃账号
      const activeAccounts = oauthRepo.findByProviderType(providerType).filter(a => 
        a.is_active === 1 && a.pool_enabled === 1
      )
      
      
      // 3. 如果没有活跃账号，删除 Pool Provider 和对应的 API Key
      if (activeAccounts.length === 0) {
        
        // 删除 Provider
        providerRepo.delete(poolProvider.id)
        
        // 🆕 删除对应的 OAuth 服务 API Key
        const keyManager = getOAuthKeyManager()
        await keyManager.deleteKey(providerType as any)
      } else {
      }
    } catch (error) {
      console.error('[ProviderGenerator] Failed to cleanup orphaned pool providers:', error)
    }
  }

  /**
   * @deprecated 使用 cleanupOrphanedPoolProviders 代替
   * 检查并清理空的Pool Provider
   */
  async cleanupEmptyPoolProviders(providerType: string): Promise<void> {
    return this.cleanupOrphanedPoolProviders(providerType)
  }

  /**
   * 映射OAuth provider类型到Amux provider类型
   * 从预设配置文件中读取
   */
  private async getProviderMapping(providerType: string): Promise<{
    adapterType: string
    baseUrl: string
    chatPath: string | undefined
    modelsPath: string | undefined
    models: string[]
    logo: string | null
    color: string | null
    displayName: string
    apiKey: string  // 🆕 OAuth 服务 API Key
  }> {
    const presets = this.loadOAuthProviderPresets()
    const preset = presets.get(providerType)

    if (!preset) {
      throw new Error(`Unknown OAuth provider type: ${providerType}`)
    }

    // 🆕 获取或创建 OAuth 服务 API Key
    const keyManager = getOAuthKeyManager()
    const oauthServiceKey = await keyManager.getOrCreateKey(providerType as any)

    // ✅ OAuth Provider 配置：使用对应 adapter 的默认格式（架构完全分离）
    // - Codex: chatPath = undefined → 使用 OpenAI adapter 默认 /v1/chat/completions
    // - Antigravity: chatPath = undefined → 使用 Google adapter 默认 /v1beta/models/{model}:streamGenerateContent
    // 
    // OAuth 中转层负责：
    // 1. 接收标准 adapter 格式的请求
    // 2. 转换为各厂商的特殊格式（如 Antigravity v1internal）
    // 3. 处理认证、账号选择、请求/响应转换
    const chatPath: string | undefined = undefined

    return {
      adapterType: preset.adapterType,
      // ✅ 指向本地 OAuth 转换服务
      baseUrl: `http://localhost:9527/oauth/${providerType}`,
      // ✅ chatPath 设为 undefined，使用 adapter 默认格式
      chatPath: chatPath,
      modelsPath: preset.modelsPath || undefined,
      models: preset.models.map(m => m.id),
      logo: preset.logo,
      color: preset.color,
      displayName: preset.displayName,
      apiKey: oauthServiceKey  // 🆕 OAuth 服务 API Key
    }
  }
}

// 单例导出
let providerGenerator: ProviderGenerator | null = null

export function getProviderGenerator(): ProviderGenerator {
  if (!providerGenerator) {
    providerGenerator = new ProviderGenerator()
  }
  return providerGenerator
}
