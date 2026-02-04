/**
 * OAuth Manager
 * 
 * OAuth服务的主入口，协调各个模块
 */

import { getOAuthAccountRepository } from '../database/repositories'
import type { OAuthAccountRow } from '../database/types'

import { encryptToken, decryptToken } from './crypto'
import { getAntigravityOAuthService } from './providers/antigravity-provider'
import type { OAuthProviderService } from './providers/base-provider'
import { getCodexOAuthService } from './providers/codex-provider'
import { getTokenManager } from './token-manager'
import type { OAuthProviderType } from './types'

export interface CreateOAuthAccountResult {
  success: boolean
  account?: OAuthAccountRow
  error?: string
}

export class OAuthManager {
  private tokenManager = getTokenManager()

  /**
   * 初始化OAuth Manager
   */
  async initialize(): Promise<void> {
    // 启动Token Manager
    this.tokenManager.start()
  }

  /**
   * 清理OAuth Manager
   */
  async cleanup(): Promise<void> {
    // 停止Token Manager
    this.tokenManager.stop()
  }

  /**
   * 启动OAuth授权流程
   */
  async authorizeAccount(providerType: OAuthProviderType): Promise<CreateOAuthAccountResult> {
    try {
      // 获取对应的OAuth service
      const service = this.getOAuthService(providerType)
      if (!service) {
        throw new Error(`Unknown provider type: ${providerType}`)
      }
      
      // 1. 启动OAuth流程，获取授权码
      const callbackData = await service.startOAuthFlow()
      
      // 2. 交换授权码为token
      const tokens = await service.exchangeCodeForTokens(
        callbackData.code,
        callbackData.codeVerifier!
      )
      
      // 3. 获取账号信息（传入完整的 tokens 对象）
      const accountInfo = await service.getAccountInfo(tokens)
      
      // 4. 检查账号是否已存在
      const repo = getOAuthAccountRepository()
      const existingAccount = repo.findByEmail(accountInfo.email, providerType)
      
      // 🔍 检测 Codex 免费账号（免费账号默认禁用 pool）
      const metadata = accountInfo.providerMetadata || {}
      const planType = (metadata as any).plan_type
      const isCodexFree = providerType === 'codex' && planType === 'free'
      
      if (existingAccount) {
        // 更新现有账号的token
        const expiresAt = Date.now() + tokens.expiresIn * 1000
        
        // 构建更新数据
        const updateData: any = {
          access_token: encryptToken(tokens.accessToken),
          refresh_token: encryptToken(tokens.refreshToken),
          expires_at: expiresAt,
          token_type: tokens.tokenType,
          is_active: 1,
          health_status: 'active',
          consecutive_failures: 0,
          last_refresh_at: Date.now(),
          provider_metadata: JSON.stringify(metadata),
          error_message: null
        }
        
        // 🔄 如果检测到免费账号，且当前 pool_enabled = 1，则禁用
        if (isCodexFree && existingAccount.pool_enabled === 1) {
          updateData.pool_enabled = 0
        }
        
        const updatedAccount = repo.update(existingAccount.id, updateData)
        
        // 🆕 更新现有账号时也需要初始化数据（如配额信息）
        await this.initializeAccountData(updatedAccount!, service)
        
        return {
          success: true,
          account: updatedAccount!
        }
      }
      
      // 5. 创建新账号
      const expiresAt = Date.now() + tokens.expiresIn * 1000
      
      const newAccount = repo.create({
        provider_type: providerType,
        email: accountInfo.email,
        access_token: encryptToken(tokens.accessToken),
        refresh_token: encryptToken(tokens.refreshToken),
        expires_at: expiresAt,
        token_type: tokens.tokenType,
        is_active: 1,
        health_status: 'active',
        consecutive_failures: 0,
        error_message: null,
        pool_enabled: isCodexFree ? 0 : 1,  // 🔄 免费账号默认禁用
        pool_weight: 1,
        last_used_at: null,
        last_refresh_at: Date.now(),
        provider_metadata: JSON.stringify(metadata),
        quota_info: null,
        usage_stats: null
      })
      
      // 6. 初始化provider-specific数据
      await this.initializeAccountData(newAccount, service)
      
      return {
        success: true,
        account: newAccount
      }
    } catch (error) {
      console.error('[OAuthManager] Authorization failed:', error)
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authorization failed'
      }
    }
  }

  /**
   * 初始化账号的provider-specific数据
   */
  private async initializeAccountData(
    account: OAuthAccountRow,
    service: OAuthProviderService
  ): Promise<void> {
    const repo = getOAuthAccountRepository()
    
    try {
      // Codex: 初始化usage stats
      if (account.provider_type === 'codex') {
        const codexService = service as any
        if (codexService.initUsageStats) {
          const usageStats = await codexService.initUsageStats()
          repo.update(account.id, {
            usage_stats: JSON.stringify(usageStats)
          })
        }
      }
      
      // Antigravity: 获取quota info
      if (account.provider_type === 'antigravity') {
        const antigravityService = service as any
        if (antigravityService.getQuotaInfo) {
          const metadata = JSON.parse(account.provider_metadata || '{}')
          const projectId = metadata.project_id
          const subscriptionTier = metadata.subscription_tier
          
          // ✅ 即使没有 project_id，也尝试获取配额信息（access token 可能就足够了）
          const accessToken = decryptToken(account.access_token)
          const quotaInfo = await antigravityService.getQuotaInfo(accessToken, projectId, subscriptionTier)
          repo.update(account.id, {
            quota_info: JSON.stringify(quotaInfo)
          })
        }
      }
    } catch (error) {
      console.error('[OAuthManager] Failed to initialize account data:', error)
    }
  }

  /**
   * 删除OAuth账号
   */
  async deleteAccount(accountId: string): Promise<boolean> {
    try {
      const repo = getOAuthAccountRepository()
      const account = repo.findById(accountId)
      
      if (!account) {
        console.warn(`[OAuthManager] Account ${accountId} not found`)
        return false
      }
      
      // 删除账号
      repo.delete(accountId)
      
      return true
    } catch (error) {
      console.error('[OAuthManager] Failed to delete account:', error)
      return false
    }
  }

  /**
   * 获取账号列表
   */
  getAccounts(providerType?: OAuthProviderType): OAuthAccountRow[] {
    const repo = getOAuthAccountRepository()
    
    if (providerType) {
      return repo.findByProviderType(providerType)
    }
    
    return repo.findAll()
  }

  /**
   * 获取账号的访问token
   */
  async getAccessToken(accountId: string): Promise<string | null> {
    return await this.tokenManager.getAccessToken(accountId)
  }

  /**
   * 手动刷新账号token
   */
  async refreshAccountToken(accountId: string): Promise<boolean> {
    return await this.tokenManager.manualRefresh(accountId)
  }

  /**
   * 更新账号健康状态
   */
  async updateAccountHealth(
    accountId: string,
    status: OAuthAccountRow['health_status'],
    errorMessage?: string
  ): Promise<void> {
    const repo = getOAuthAccountRepository()
    
    const updates: Partial<OAuthAccountRow> = {
      health_status: status
    }
    
    if (errorMessage) {
      updates.error_message = errorMessage
    } else {
      updates.error_message = null
      updates.consecutive_failures = 0
    }
    
    repo.update(accountId, updates)
  }

  /**
   * 更新账号配额信息（仅Antigravity）
   */
  async updateAccountQuota(accountId: string): Promise<boolean> {
    try {
      const repo = getOAuthAccountRepository()
      const account = repo.findById(accountId)
      
      if (!account || account.provider_type !== 'antigravity') {
        return false
      }
      
      const service = getAntigravityOAuthService()
      const metadata = JSON.parse(account.provider_metadata || '{}')
      const projectId = metadata.project_id
      const subscriptionTier = metadata.subscription_tier
      
      const accessToken = await this.getAccessToken(accountId)
      if (!accessToken) {
        return false
      }
      
      // ✅ 即使没有 project_id，也尝试获取配额信息
      const quotaInfo = await service.getQuotaInfo(accessToken, projectId, subscriptionTier)
      
      repo.update(accountId, {
        quota_info: JSON.stringify(quotaInfo)
      })
      
      return true
    } catch (error) {
      console.error('[OAuthManager] Failed to update quota:', error)
      return false
    }
  }

  /**
   * 更新账号使用统计（仅Codex）
   */
  async updateAccountUsage(
    accountId: string,
    requestData: { promptTokens: number; completionTokens: number }
  ): Promise<boolean> {
    try {
      const repo = getOAuthAccountRepository()
      const account = repo.findById(accountId)
      
      if (!account || account.provider_type !== 'codex') {
        return false
      }
      
      const service = getCodexOAuthService()
      const currentStats = JSON.parse(account.usage_stats || '{}')
      const updatedStats = await (service as any).updateUsageStats(currentStats, requestData)
      
      repo.update(accountId, {
        usage_stats: JSON.stringify(updatedStats),
        last_used_at: Date.now()
      })
      
      return true
    } catch (error) {
      console.error('[OAuthManager] Failed to update usage:', error)
      return false
    }
  }

  /**
   * 获取OAuth service实例（公共方法）
   */
  getService(providerType: OAuthProviderType): OAuthProviderService {
    const service = this.getOAuthService(providerType)
    if (!service) {
      throw new Error(`Unknown provider type: ${providerType}`)
    }
    return service
  }

  /**
   * 获取OAuth service实例
   */
  private getOAuthService(providerType: OAuthProviderType): OAuthProviderService | null {
    switch (providerType) {
      case 'codex':
        return getCodexOAuthService()
      case 'antigravity':
        return getAntigravityOAuthService()
      default:
        return null
    }
  }
}

// 单例导出
let oauthManager: OAuthManager | null = null

export function getOAuthManager(): OAuthManager {
  if (!oauthManager) {
    oauthManager = new OAuthManager()
  }
  return oauthManager
}
