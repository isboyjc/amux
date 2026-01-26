/**
 * OAuth IPC Handlers
 * 
 * Electron IPC handlers for OAuth functionality
 */

import { ipcMain } from 'electron'

import { trackOAuthAuthorized, trackOAuthAccountDeleted } from '../services/analytics'
import { getOAuthManager } from '../services/oauth/oauth-manager'
import { getPoolHandler } from '../services/oauth/pool-handler'
import { getProviderGenerator } from '../services/oauth/provider-generator'
import type { OAuthProviderType } from '../services/oauth/types'

/**
 * 注册OAuth相关的IPC handlers
 */
export function registerOAuthHandlers(): void {
  const oauthManager = getOAuthManager()
  const poolHandler = getPoolHandler()
  const providerGenerator = getProviderGenerator()  // ✅ 添加 provider generator

  /**
   * 获取OAuth授权URL（不打开浏览器）
   */
  ipcMain.handle('oauth:getAuthUrl', async (_event, providerType: OAuthProviderType) => {
    try {
      const service = oauthManager.getService(providerType)
      const { authUrl, state } = await service.getAuthorizationUrl()
      
      return {
        success: true,
        authUrl,
        state
      }
    } catch (error: any) {
      console.error('[IPC:oauth:getAuthUrl] Error:', error)
      return {
        success: false,
        error: error?.message || 'Failed to get authorization URL'
      }
    }
  })

  /**
   * 启动OAuth授权流程
   * 
   * ✅ 授权成功后自动确保 Pool Provider 存在
   */
  ipcMain.handle('oauth:authorize', async (_event, providerType: OAuthProviderType) => {
    try {
      // 1. 执行OAuth授权，创建账号
      const result = await oauthManager.authorizeAccount(providerType)
      
      if (!result.success || !result.account) {
        // 追踪授权失败（异步，不阻塞）
        setImmediate(() => {
          try {
            trackOAuthAuthorized(providerType, false, result.error)
          } catch (e) {
            // 静默失败
          }
        })
        
        return {
          success: false,
          error: result.error
        }
      }
      
      // 2. 🆕 自动确保 Pool Provider 存在
      let poolProviderId: string | undefined
      
      try {
        poolProviderId = await providerGenerator.ensurePoolProvider(providerType)
        console.log(`[IPC:oauth:authorize] Pool provider ensured: ${poolProviderId}`)
        
        // 3. 🆕 重启代理服务器以注册新路由
        const { stopServer, startServer } = await import('../services/proxy-server')
        await stopServer()
        await startServer()
        console.log(`[IPC:oauth:authorize] Proxy server restarted`)
        
        // 4. Provider 已创建，无需跳转页面（用户可在 Provider 页面自行查看）
      } catch (error) {
        console.error('[IPC:oauth:authorize] Failed to ensure pool provider:', error)
        // 不影响账号创建流程，只是记录错误
      }
      
      // 追踪授权成功（异步，不阻塞）
      setImmediate(() => {
        try {
          trackOAuthAuthorized(providerType, true)
        } catch (e) {
          // 静默失败
        }
      })
      
      return {
        success: true,
        account: result.account,
        poolProviderId  // ✅ 返回 Pool Provider ID 给 UI
      }
    } catch (error: any) {
      console.error('[IPC:oauth:authorize] Error:', error)
      
      // 追踪授权失败（异步，不阻塞）
      setImmediate(() => {
        try {
          trackOAuthAuthorized(providerType, false, error?.message)
        } catch (e) {
          // 静默失败
        }
      })
      
      return {
        success: false,
        error: error?.message || 'Authorization failed'
      }
    }
  })

  /**
   * 取消OAuth授权流程
   */
  ipcMain.handle('oauth:cancelAuthorize', async (_event, providerType: OAuthProviderType, state: string) => {
    try {
      const service = oauthManager.getService(providerType)
      await service.cancelOAuthFlow(state)
      
      return {
        success: true
      }
    } catch (error: any) {
      console.error('[IPC:oauth:cancelAuthorize] Error:', error)
      return {
        success: false,
        error: error?.message || 'Failed to cancel authorization'
      }
    }
  })

  /**
   * 获取OAuth账号列表
   */
  ipcMain.handle('oauth:getAccounts', async (_event, providerType?: OAuthProviderType) => {
    try {
      const accounts = oauthManager.getAccounts(providerType)
      return {
        success: true,
        accounts
      }
    } catch (error: any) {
      console.error('[IPC:oauth:getAccounts] Error:', error)
      return {
        success: false,
        error: error?.message || 'Failed to get accounts'
      }
    }
  })

  /**
   * 删除OAuth账号
   * ✅ 自动删除 Individual Provider 和检查清理 Pool Provider
   */
  ipcMain.handle('oauth:deleteAccount', async (_event, accountId: string) => {
    try {
      // 1. 获取账号信息以便后续清理
      const accounts = oauthManager.getAccounts()
      const account = accounts.find(a => a.id === accountId)
      
      if (!account) {
        return {
          success: false,
          error: 'Account not found'
        }
      }
      
      const providerType = account.provider_type
      
      // 2. 删除账号
      const success = await oauthManager.deleteAccount(accountId)
      
      if (!success) {
        return {
          success: false,
          error: 'Failed to delete account'
        }
      }
      
      // 3. 检查并清理孤立的 Pool Provider
      await providerGenerator.cleanupOrphanedPoolProviders(providerType)
      
      console.log(`[IPC:oauth:deleteAccount] Deleted account: ${accountId}`)
      
      // 追踪账号删除（异步，不阻塞）
      setImmediate(() => {
        try {
          trackOAuthAccountDeleted(providerType)
        } catch (e) {
          // 静默失败
        }
      })
      
      return {
        success: true
      }
    } catch (error: any) {
      console.error('[IPC:oauth:deleteAccount] Error:', error)
      return {
        success: false,
        error: error?.message || 'Failed to delete account'
      }
    }
  })

  /**
   * 刷新账号token
   */
  ipcMain.handle('oauth:refreshToken', async (_event, accountId: string) => {
    try {
      const success = await oauthManager.refreshAccountToken(accountId)
      return {
        success
      }
    } catch (error: any) {
      console.error('[IPC:oauth:refreshToken] Error:', error)
      return {
        success: false,
        error: error?.message || 'Failed to refresh token'
      }
    }
  })

  /**
   * 更新账号配额信息（Antigravity）
   */
  ipcMain.handle('oauth:updateQuota', async (_event, accountId: string) => {
    try {
      const success = await oauthManager.updateAccountQuota(accountId)
      return {
        success
      }
    } catch (error: any) {
      console.error('[IPC:oauth:updateQuota] Error:', error)
      return {
        success: false,
        error: error?.message || 'Failed to update quota'
      }
    }
  })

  /**
   * 切换账号Pool启用状态
   */
  ipcMain.handle('oauth:togglePoolEnabled', async (_event, accountId: string, enabled: boolean) => {
    try {
      const accounts = oauthManager.getAccounts()
      const account = accounts.find(a => a.id === accountId)
      
      if (!account) {
        return {
          success: false,
          error: 'Account not found'
        }
      }
      
      // 更新pool_enabled状态
      const { getOAuthAccountRepository } = await import('../services/database/repositories/oauth-account')
      const repo = getOAuthAccountRepository()
      
      repo.update(accountId, {
        pool_enabled: enabled ? 1 : 0
      })
      
      return {
        success: true
      }
    } catch (error: any) {
      console.error('[IPC:oauth:togglePoolEnabled] Error:', error)
      return {
        success: false,
        error: error?.message || 'Failed to toggle pool enabled'
      }
    }
  })

  /**
   * 获取Pool统计信息
   */
  ipcMain.handle('oauth:getPoolStats', async (_event, providerType: OAuthProviderType) => {
    try {
      const stats = poolHandler.getPoolStats(providerType)
      return {
        success: true,
        stats
      }
    } catch (error: any) {
      console.error('[IPC:oauth:getPoolStats] Error:', error)
      return {
        success: false,
        error: error?.message || 'Failed to get pool stats'
      }
    }
  })

  /**
   * 为Individual模式生成Provider
   */
  ipcMain.handle('oauth:generateIndividualProvider', async (_event, accountId: string) => {
    try {
      const accounts = oauthManager.getAccounts()
      const account = accounts.find(a => a.id === accountId)
      
      if (!account) {
        return {
          success: false,
          error: 'Account not found'
        }
      }
      
      const result = await providerGenerator.generateProvider(account, {
        mode: 'individual'
      })
      
      return result
    } catch (error: any) {
      console.error('[IPC:oauth:generateIndividualProvider] Error:', error)
      return {
        success: false,
        error: error?.message || 'Failed to generate provider'
      }
    }
  })

  /**
   * 为Pool模式生成Provider
   */
  ipcMain.handle('oauth:generatePoolProvider', async (_event, providerType: OAuthProviderType, strategy: 'round_robin' | 'least_used' | 'quota_aware') => {
    try {
      const accounts = oauthManager.getAccounts(providerType)
      
      if (accounts.length === 0) {
        return {
          success: false,
          error: 'No accounts found for this provider type'
        }
      }
      
      // 使用第一个账号来触发pool provider生成
      const account = accounts[0]
      if (!account) {
        return {
          success: false,
          error: 'No valid account found'
        }
      }
      
      const result = await providerGenerator.generateProvider(account, {
        mode: 'pool',
        poolStrategy: strategy
      })
      
      return result
    } catch (error: any) {
      console.error('[IPC:oauth:generatePoolProvider] Error:', error)
      return {
        success: false,
        error: error?.message || 'Failed to generate pool provider'
      }
    }
  })

  /**
   * 🆕 检测并确保 Pool Provider 存在（手动触发）
   */
  ipcMain.handle('oauth:check-pool-provider', async (_event, params: {
    providerType: string
  }) => {
    try {
      const { getOAuthAccountRepository, getProviderRepository } = await import('../services/database/repositories')
      const oauthRepo = getOAuthAccountRepository()
      const providerRepo = getProviderRepository()
      
      console.log(`[IPC:oauth:check-pool-provider] Checking pool provider for: ${params.providerType}`)
      
      // 1. 查找是否已存在 Pool Provider
      const existingPool = providerRepo.findAll().find(p => 
        p.is_pool === 1 && p.oauth_provider_type === params.providerType
      )
      
      if (existingPool) {
        // 2. 如果存在，检查所有账号的健康状态
        const accounts = oauthRepo.findByProviderType(params.providerType)
        const activeAccounts = accounts.filter(a => a.is_active === 1)
        const healthyAccounts = activeAccounts.filter(a => a.health_status === 'active')
        
        console.log(`[IPC:oauth:check-pool-provider] Pool provider exists: ${existingPool.name}`)
        console.log(`[IPC:oauth:check-pool-provider] Active accounts: ${activeAccounts.length}, Healthy: ${healthyAccounts.length}`)
        
        return {
          success: true,
          providerId: existingPool.id,
          exists: true,
          accountsStatus: {
            total: accounts.length,
            active: activeAccounts.length,
            healthy: healthyAccounts.length
          }
        }
      }
      
      // 3. 如果不存在，创建 Pool Provider
      console.log(`[IPC:oauth:check-pool-provider] Pool provider not found, creating...`)
      
      const providerId = await providerGenerator.ensurePoolProvider(params.providerType)
      
      // 4. 确保所有活跃账号启用了 pool
      const accounts = oauthRepo.findByProviderType(params.providerType)
      const activeAccounts = accounts.filter(a => a.is_active === 1)
      
      for (const account of activeAccounts) {
        if (account.pool_enabled !== 1) {
          oauthRepo.update(account.id, {
            pool_enabled: 1,
            updated_at: Date.now()
          })
        }
      }
      
      console.log(`[IPC:oauth:check-pool-provider] Created pool provider: ${providerId}, enabled ${activeAccounts.length} accounts`)
      
      // 🆕 重启代理服务器以注册新路由
      const { stopServer, startServer } = await import('../services/proxy-server')
      await stopServer()
      await startServer()
      console.log(`[IPC:oauth:check-pool-provider] Proxy server restarted`)
      
      return {
        success: true,
        providerId,
        exists: false,
        accountsStatus: {
          total: accounts.length,
          active: activeAccounts.length,
          healthy: activeAccounts.filter(a => a.health_status === 'active').length
        }
      }
    } catch (error: any) {
      console.error('[IPC:oauth:check-pool-provider] Error:', error)
      return {
        success: false,
        error: error?.message || 'Failed to check pool provider'
      }
    }
  })

  /**
   * 🆕 创建或更新 Individual Provider
   */
  // ❌ Individual Provider 功能已移除
  // 每个 OAuth 厂商只有一个 Pool Provider

  /**
   * 获取账号的本地调用统计（支持时间范围）
   */
  ipcMain.handle('oauth:get-account-stats', async (_event, accountId: string, timeRange: 'today' | 'week' | 'month' | 'total' = 'today') => {
    try {
      const { getOAuthLogger } = await import('../services/proxy-server/oauth/logger')
      const logger = getOAuthLogger()
      
      const stats = await logger.getAccountStatsByRange(accountId, timeRange)
      
      if (!stats) {
        return {
          requestCount: 0,
          successCount: 0,
          errorCount: 0,
          inputTokens: 0,
          outputTokens: 0,
          lastUsedAt: null,
          successRate: '0.0',
          totalTokens: 0,
          timeRange
        }
      }
      
      const requestCount = (stats as any).request_count || 0
      const successCount = (stats as any).success_count || 0
      const errorCount = (stats as any).error_count || 0
      const inputTokens = (stats as any).input_tokens || 0
      const outputTokens = (stats as any).output_tokens || 0
      
      return {
        requestCount,
        successCount,
        errorCount,
        inputTokens,
        outputTokens,
        lastUsedAt: (stats as any).last_used_at || null,
        successRate: requestCount > 0 
          ? ((successCount / requestCount) * 100).toFixed(1)
          : '0.0',
        totalTokens: inputTokens + outputTokens,
        timeRange
      }
    } catch (error) {
      console.error('[IPC:oauth:get-account-stats] Error:', error)
      return {
        requestCount: 0,
        successCount: 0,
        errorCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        lastUsedAt: null,
        successRate: '0.0',
        totalTokens: 0,
        timeRange
      }
    }
  })

  console.log('[IPC] OAuth handlers registered')
}
