/**
 * OAuth Token Manager
 * 
 * 管理OAuth账号的token自动刷新、健康检查等
 */

import { getOAuthAccountRepository } from '../database/repositories'
import { encryptToken, decryptToken } from './crypto'
import { getCodexOAuthService } from './providers/codex-provider'
import { getAntigravityOAuthService } from './providers/antigravity-provider'
import type { OAuthAccountRow } from '../database/types'
import type { OAuthProviderService } from './providers/base-provider'

interface TokenRefreshTask {
  accountId: string
  scheduledAt: number
  timeoutId: NodeJS.Timeout
}

export class TokenManager {
  private refreshTasks: Map<string, TokenRefreshTask> = new Map()
  private isRunning = false

  /**
   * 启动Token Manager
   */
  start(): void {
    if (this.isRunning) return
    
    this.isRunning = true
    
    // 立即检查一次所有账号
    this.checkAllAccounts()
    
    // 每小时检查一次
    setInterval(() => {
      this.checkAllAccounts()
    }, 60 * 60 * 1000)
  }

  /**
   * 停止Token Manager
   */
  stop(): void {
    if (!this.isRunning) return
    
    this.isRunning = false
    
    // 清理所有刷新任务
    this.refreshTasks.forEach(task => {
      clearTimeout(task.timeoutId)
    })
    this.refreshTasks.clear()
  }

  /**
   * 检查所有账号的token状态
   */
  private async checkAllAccounts(): Promise<void> {
    const repo = getOAuthAccountRepository()
    const accounts = repo.findAll()
    
    for (const account of accounts) {
      if (account.is_active === 0) continue
      
      await this.checkAccountToken(account)
    }
  }

  /**
   * 检查单个账号的token状态
   */
  private async checkAccountToken(account: OAuthAccountRow): Promise<void> {
    const now = Date.now()
    const expiresAt = account.expires_at
    const timeUntilExpiry = expiresAt - now
    
    // 如果token在15分钟内过期，立即刷新
    if (timeUntilExpiry < 15 * 60 * 1000) {
      await this.refreshAccountToken(account.id)
    } else {
      // 否则，在token过期前15分钟调度刷新任务
      this.scheduleTokenRefresh(account.id, expiresAt - 15 * 60 * 1000)
    }
  }

  /**
   * 调度token刷新任务
   */
  private scheduleTokenRefresh(accountId: string, scheduledAt: number): void {
    // 如果已经存在任务，先清理
    const existingTask = this.refreshTasks.get(accountId)
    if (existingTask) {
      clearTimeout(existingTask.timeoutId)
    }
    
    const now = Date.now()
    const delay = Math.max(0, scheduledAt - now)
    
    const timeoutId = setTimeout(async () => {
      await this.refreshAccountToken(accountId)
      this.refreshTasks.delete(accountId)
    }, delay)
    
    this.refreshTasks.set(accountId, {
      accountId,
      scheduledAt,
      timeoutId
    })
  }

  /**
   * 刷新账号token
   */
  async refreshAccountToken(accountId: string): Promise<boolean> {
    const repo = getOAuthAccountRepository()
    const account = repo.findById(accountId)
    
    if (!account) {
      console.error(`[TokenManager] Account ${accountId} not found`)
      return false
    }
    
    try {
      // 解密refresh_token
      let refreshToken: string
      try {
        refreshToken = decryptToken(account.refresh_token)
      } catch (decryptError) {
        console.error(`[TokenManager] Failed to decrypt token for ${account.email}:`, decryptError)
        // 解密失败，标记账号为 forbidden 状态
        repo.update(accountId, {
          health_status: 'forbidden',
          is_active: 0,
          error_message: 'Token decryption failed. Please re-authenticate.',
          consecutive_failures: account.consecutive_failures + 1
        })
        return false
      }
      
      // 获取对应的OAuth service
      const service = this.getOAuthService(account.provider_type)
      if (!service) {
        throw new Error(`Unknown provider type: ${account.provider_type}`)
      }
      
      // 刷新token
      const newTokens = await service.refreshAccessToken(refreshToken)
      
      // 更新数据库
      const expiresAt = Date.now() + newTokens.expiresIn * 1000
      
      const updates: Partial<OAuthAccountRow> = {
        access_token: encryptToken(newTokens.accessToken),
        refresh_token: encryptToken(newTokens.refreshToken),
        expires_at: expiresAt,
        last_refresh_at: Date.now(),
        health_status: 'active',
        consecutive_failures: 0,
        error_message: null
      }
      
      // 如果返回了新的 id_token，更新 provider_metadata
      // 这对 Codex 很重要，因为 id_token 中包含用户信息
      if (newTokens.idToken) {
        try {
          const currentMetadata = JSON.parse(account.provider_metadata || '{}')
          currentMetadata.id_token = newTokens.idToken
          updates.provider_metadata = JSON.stringify(currentMetadata)
        } catch (error) {
          console.error(`[TokenManager] Failed to update id_token in metadata:`, error)
        }
      }
      
      repo.update(accountId, updates)
      
      // 调度下一次刷新
      this.scheduleTokenRefresh(accountId, expiresAt - 15 * 60 * 1000)
      
      return true
    } catch (error) {
      console.error(`[TokenManager] Failed to refresh token for ${account.email}:`, error)
      
      // 更新失败状态
      const consecutiveFailures = account.consecutive_failures + 1
      const updates: Partial<OAuthAccountRow> = {
        consecutive_failures: consecutiveFailures,
        error_message: error instanceof Error ? error.message : String(error)
      }
      
      // 如果连续失败3次，标记为 expired 状态并禁用账号
      if (consecutiveFailures >= 3) {
        updates.health_status = 'expired'
        updates.is_active = 0
      }
      
      repo.update(accountId, updates)
      
      return false
    }
  }

  /**
   * 获取OAuth service实例
   */
  private getOAuthService(providerType: string): OAuthProviderService | null {
    switch (providerType) {
      case 'codex':
        return getCodexOAuthService()
      case 'antigravity':
        return getAntigravityOAuthService()
      default:
        return null
    }
  }

  /**
   * 手动刷新指定账号的token
   */
  async manualRefresh(accountId: string): Promise<boolean> {
    return await this.refreshAccountToken(accountId)
  }

  /**
   * 获取账号的访问token（自动解密）
   */
  async getAccessToken(accountId: string): Promise<string | null> {
    const repo = getOAuthAccountRepository()
    const account = repo.findById(accountId)
    
    if (!account || account.is_active === 0) {
      return null
    }
    
    // 检查token是否即将过期
    const now = Date.now()
    const timeUntilExpiry = account.expires_at - now
    
    // 如果在5分钟内过期，先刷新
    if (timeUntilExpiry < 5 * 60 * 1000) {
      const refreshed = await this.refreshAccountToken(accountId)
      if (!refreshed) {
        return null
      }
      
      // 重新获取账号信息
      const updatedAccount = repo.findById(accountId)
      if (!updatedAccount) {
        return null
      }
      
      return decryptToken(updatedAccount.access_token)
    }
    
    return decryptToken(account.access_token)
  }
}

// 单例导出
let tokenManager: TokenManager | null = null

export function getTokenManager(): TokenManager {
  if (!tokenManager) {
    tokenManager = new TokenManager()
  }
  return tokenManager
}
