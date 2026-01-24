/**
 * Pool Handler
 * 
 * 处理Pool Provider的账号选择和故障转移
 * 策略：记住上次成功的账号，如果失败则切换到下一个账号
 */

import { getOAuthAccountRepository } from '../database/repositories'
import { getOAuthManager } from './oauth-manager'
import type { OAuthAccountRow } from '../database/types'

export interface PoolAccountSelection {
  account: OAuthAccountRow
  accessToken: string
}

export class PoolHandler {
  // 记住每个 provider 上次成功使用的账号 ID
  private lastSuccessfulAccount: Map<string, string> = new Map()

  /**
   * 从Pool中选择一个账号
   * 策略：优先使用上次成功的账号，如果失败或被排除则选择下一个可用账号
   * @param excludeAccountIds - 要排除的账号 ID 列表（用于失败重试）
   */
  async selectAccount(
    providerType: string,
    excludeAccountIds: string[] = []
  ): Promise<PoolAccountSelection | null> {
    const accounts = this.getAvailableAccounts(providerType, excludeAccountIds)
    
    if (accounts.length === 0) {
      return null
    }
    
    let selectedAccount: OAuthAccountRow | null = null
    
    // 1. 尝试使用上次成功的账号
    const lastAccountId = this.lastSuccessfulAccount.get(providerType)
    if (lastAccountId) {
      selectedAccount = accounts.find(a => a.id === lastAccountId) || null
    }
    
    // 2. 如果上次的账号不可用，选择第一个可用账号
    if (!selectedAccount) {
      selectedAccount = accounts[0]
    }
    
    if (!selectedAccount) {
      return null
    }
    
    // 获取访问token
    const oauthManager = getOAuthManager()
    const accessToken = await oauthManager.getAccessToken(selectedAccount.id)
    
    if (!accessToken) {
      return null
    }
    
    // 更新last_used_at
    const repo = getOAuthAccountRepository()
    repo.update(selectedAccount.id, {
      last_used_at: Date.now()
    })
    
    return {
      account: selectedAccount,
      accessToken
    }
  }
  
  /**
   * 记录成功的账号（在请求成功后调用）
   */
  recordSuccessfulAccount(providerType: string, accountId: string): void {
    this.lastSuccessfulAccount.set(providerType, accountId)
  }

  /**
   * 获取可用的账号列表
   * @param excludeAccountIds - 要排除的账号 ID 列表
   */
  private getAvailableAccounts(
    providerType: string, 
    excludeAccountIds: string[] = []
  ): OAuthAccountRow[] {
    const repo = getOAuthAccountRepository()
    const accounts = repo.findByProviderType(providerType)
    
    return accounts
      .filter(account => 
        account.is_active === 1 &&
        account.pool_enabled === 1 &&
        account.health_status === 'active' &&
        !excludeAccountIds.includes(account.id)  // ✅ 排除指定账号
      )
      .sort((a, b) => {
        // 按pool_weight排序（权重越大优先级越高）
        return b.pool_weight - a.pool_weight
      })
  }


  /**
   * 处理账号失败（用于故障转移）
   */
  async handleAccountFailure(
    accountId: string,
    error: any
  ): Promise<void> {
    const repo = getOAuthAccountRepository()
    const account = repo.findById(accountId)
    
    if (!account) return
    
    const consecutiveFailures = account.consecutive_failures + 1
    
    const updates: Partial<OAuthAccountRow> = {
      consecutive_failures: consecutiveFailures,
      error_message: error.message || 'Unknown error'
    }
    
    // 根据错误类型设置health_status
    if (error.status === 429 || error.message?.includes('rate limit')) {
      updates.health_status = 'rate_limited'
    } else if (error.status === 401 || error.message?.includes('unauthorized')) {
      updates.health_status = 'expired'
    } else if (error.status === 403 || error.message?.includes('forbidden')) {
      updates.health_status = 'forbidden'
    } else if (consecutiveFailures >= 3) {
      updates.health_status = 'error'
      updates.is_active = 0 // 连续失败3次，停用账号
    }
    
    repo.update(accountId, updates)
  }

  /**
   * 重置账号失败计数（用于成功请求后）
   */
  async resetAccountFailure(accountId: string): Promise<void> {
    const repo = getOAuthAccountRepository()
    
    repo.update(accountId, {
      consecutive_failures: 0,
      health_status: 'active',
      error_message: null
    })
  }

  /**
   * 获取Pool统计信息
   */
  getPoolStats(providerType: string): {
    total: number
    active: number
    inactive: number
    rate_limited: number
    error: number
  } {
    const repo = getOAuthAccountRepository()
    const accounts = repo.findByProviderType(providerType)
    
    return {
      total: accounts.length,
      active: accounts.filter(a => a.health_status === 'active').length,
      inactive: accounts.filter(a => a.is_active === 0).length,
      rate_limited: accounts.filter(a => a.health_status === 'rate_limited').length,
      error: accounts.filter(a => a.health_status === 'error').length
    }
  }
}

// 单例导出
let poolHandler: PoolHandler | null = null

export function getPoolHandler(): PoolHandler {
  if (!poolHandler) {
    poolHandler = new PoolHandler()
  }
  return poolHandler
}
