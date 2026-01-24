import { getOAuthManager } from '../../oauth/oauth-manager'
import { getPoolHandler } from '../../oauth/pool-handler'
import { getOAuthAccountRepository } from '../../database/repositories'
import type { OAuthProviderType } from '../../types/oauth'
import type { AccountSelection } from './types'

/**
 * OAuth 账号池管理器
 * 负责账号选择、请求执行和自动重试（OAuth 转换服务层）
 * 策略：记住上次成功的账号，失败时自动切换并重试
 */
export class OAuthPoolManager {
  private oauthManager = getOAuthManager()
  private poolHandler = getPoolHandler()
  private readonly MAX_RETRY_ATTEMPTS = 3
  
  /**
   * 执行请求并自动重试（核心方法）
   * 
   * 工作流程：
   * 1. 选择账号（优先使用上次成功的账号）
   * 2. 执行请求
   * 3. 如果成功：记录成功账号并返回结果
   * 4. 如果失败：切换到下一个账号重试
   * 5. 最多重试 3 次，全部失败则返回错误
   * 
   * @param providerType - OAuth 厂商类型
   * @param requestExecutor - 请求执行函数，接收账号信息并执行请求
   * @returns 请求结果
   */
  async executeWithRetry<T>(
    providerType: OAuthProviderType,
    requestExecutor: (selection: AccountSelection) => Promise<T>
  ): Promise<T> {
    const attemptedAccountIds: string[] = []
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt < this.MAX_RETRY_ATTEMPTS; attempt++) {
      // 选择账号（排除已尝试的）
      const selection = await this.selectAccount(providerType, attemptedAccountIds)
      
      if (!selection) {
        // 没有更多可用账号
        if (lastError && (lastError as any).status) {
          // ✅ 如果有原始错误且包含 status，直接抛出（保留错误详情）
          throw lastError
        }
        
        // 否则抛出通用错误
        const errorMessage = attemptedAccountIds.length > 0
          ? `All ${attemptedAccountIds.length} available accounts failed`
          : 'No available OAuth accounts'
        
        throw new Error(errorMessage)
      }
      
      const accountId = selection.account.id
      attemptedAccountIds.push(accountId)
      
      try {
        // 执行请求
        const result = await requestExecutor(selection)
        
        // ✅ 成功：记录成功账号
        this.recordSuccessfulAccount(providerType, accountId)
        
        return result
        
      } catch (error) {
        lastError = error as Error
        
        // 如果还有重试机会，继续下一个账号
        if (attempt < this.MAX_RETRY_ATTEMPTS - 1) {
          continue
        }
      }
    }
    
    // 全部失败
    throw lastError || new Error('All retry attempts failed')
  }
  
  /**
   * 从账号池中选择一个可用账号
   * @param providerType - OAuth 厂商类型
   * @param excludeAccountIds - 要排除的账号 ID（用于失败重试）
   */
  private async selectAccount(
    providerType: OAuthProviderType,
    excludeAccountIds: string[] = []
  ): Promise<AccountSelection | null> {
    // 使用 PoolHandler 选择账号（已过滤排除的账号）
    const selection = await this.poolHandler.selectAccount(
      providerType,
      excludeAccountIds
    )
    
    if (!selection) {
      return null
    }
    
    // 解析 metadata
    let metadata: Record<string, unknown> = {}
    try {
      if (selection.account.provider_metadata) {
        metadata = JSON.parse(selection.account.provider_metadata)
      }
    } catch {
      // Failed to parse metadata, use empty object
    }
    
    return {
      account: {
        id: selection.account.id,
        email: selection.account.email,
        provider_metadata: selection.account.provider_metadata || '{}'
      },
      accessToken: selection.accessToken,
      metadata
    }
  }
  
  /**
   * 获取指定账号的 Token
   */
  async getAccountToken(accountId: string): Promise<string | null> {
    return await this.oauthManager.getAccessToken(accountId)
  }
  
  /**
   * 刷新账号 Token
   */
  async refreshAccountToken(accountId: string): Promise<string | null> {
    return await this.oauthManager.refreshAccessToken(accountId)
  }
  
  /**
   * 获取账号总数
   */
  async getAccountCount(providerType: OAuthProviderType): Promise<number> {
    const accounts = this.poolHandler['getAvailableAccounts'](providerType)
    return accounts.length
  }
  
  /**
   * 记录成功的账号（在请求成功后调用）
   */
  private recordSuccessfulAccount(providerType: OAuthProviderType, accountId: string): void {
    this.poolHandler.recordSuccessfulAccount(providerType, accountId)
  }
}

// 单例
let poolManager: OAuthPoolManager | null = null

export function getOAuthPoolManager(): OAuthPoolManager {
  if (!poolManager) {
    poolManager = new OAuthPoolManager()
  }
  return poolManager
}
