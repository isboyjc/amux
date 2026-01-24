import type { Database } from 'better-sqlite3'
import { getDatabase } from '../../database'
import type { OAuthProviderType } from '../../types/oauth'
import type { OAuthRequestLog, OAuthMetrics } from './types'

/**
 * OAuth 服务日志记录器
 * 记录账号使用统计和健康状态
 */
export class OAuthLogger {
  private db: Database
  
  constructor() {
    this.db = getDatabase()
    this.initTables()
  }
  
  private initTables() {
    // OAuth 账号统计表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS oauth_account_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id TEXT NOT NULL,
        provider_type TEXT NOT NULL,
        request_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        last_used_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(account_id, provider_type)
      )
    `)
    
    // 创建索引
    this.db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_account_stats_account 
        ON oauth_account_stats(account_id, provider_type)
    `)
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_oauth_account_stats_provider 
        ON oauth_account_stats(provider_type)
    `)
    
    // OAuth 请求详细日志表（可选，用于调试）
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS oauth_request_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id TEXT NOT NULL,
        provider_type TEXT NOT NULL,
        model TEXT,
        success INTEGER DEFAULT 1,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        latency_ms INTEGER,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    // 创建索引
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_oauth_request_logs_account 
        ON oauth_request_logs(account_id)
    `)
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_oauth_request_logs_provider 
        ON oauth_request_logs(provider_type)
    `)
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_oauth_request_logs_created_at 
        ON oauth_request_logs(created_at)
    `)
  }
  
  /**
   * 记录请求（聚合统计）
   */
  async logRequest(params: OAuthRequestLog): Promise<void> {
    const { accountId, providerType, success, inputTokens = 0, outputTokens = 0 } = params
    
    // 更新聚合统计
    this.db.prepare(`
      INSERT INTO oauth_account_stats (
        account_id, provider_type, 
        request_count, success_count, error_count,
        input_tokens, output_tokens, last_used_at
      )
      VALUES (?, ?, 1, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(account_id, provider_type) DO UPDATE SET
        request_count = request_count + 1,
        success_count = success_count + ?,
        error_count = error_count + ?,
        input_tokens = input_tokens + ?,
        output_tokens = output_tokens + ?,
        last_used_at = CURRENT_TIMESTAMP
    `).run(
      accountId,
      providerType,
      success ? 1 : 0,
      success ? 0 : 1,
      inputTokens,
      outputTokens,
      success ? 1 : 0,
      success ? 0 : 1,
      inputTokens,
      outputTokens
    )
  }
  
  /**
   * 记录详细请求日志（可选）
   */
  async logDetailedRequest(params: OAuthRequestLog): Promise<void> {
    this.db.prepare(`
      INSERT INTO oauth_request_logs (
        account_id, provider_type, model,
        success, input_tokens, output_tokens,
        latency_ms, error_message
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.accountId,
      params.providerType,
      params.model || null,
      params.success ? 1 : 0,
      params.inputTokens || 0,
      params.outputTokens || 0,
      params.latencyMs || null,
      params.errorMessage || null
    )
  }
  
  /**
   * 获取账号统计
   */
  async getAccountStats(accountId: string) {
    return this.db.prepare(`
      SELECT * FROM oauth_account_stats WHERE account_id = ?
    `).get(accountId)
  }
  
  /**
   * 根据时间范围获取账号统计
   */
  async getAccountStatsByRange(
    accountId: string, 
    timeRange: 'today' | 'week' | 'month' | 'total'
  ) {
    if (timeRange === 'total') {
      // 累计统计：从 oauth_account_stats 表读取
      return this.getAccountStats(accountId)
    }
    
    // 按时间范围：从 oauth_request_logs 表聚合查询
    // 注意：created_at 是 UTC 时间，需要转换为本地时间后再比较
    let dateFilter = ''
    
    switch (timeRange) {
      case 'today':
        // ✅ 将 created_at 转换为本地时间后再比较日期
        dateFilter = "DATE(created_at, 'localtime') = DATE('now', 'localtime')"
        break
      case 'week':
        // ✅ 将本地时间转换为 UTC 后再比较
        dateFilter = "created_at >= DATETIME('now', '-7 days')"
        break
      case 'month':
        // ✅ 将本地时间转换为 UTC 后再比较
        dateFilter = "created_at >= DATETIME('now', '-30 days')"
        break
    }
    
    const result = this.db.prepare(`
      SELECT 
        COUNT(*) as request_count,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as error_count,
        SUM(input_tokens) as input_tokens,
        SUM(output_tokens) as output_tokens,
        MAX(created_at) as last_used_at
      FROM oauth_request_logs
      WHERE account_id = ? AND ${dateFilter}
    `).get(accountId)
    
    return result
  }
  
  /**
   * 获取厂商所有账号的统计
   */
  async getProviderStats(providerType: OAuthProviderType) {
    return this.db.prepare(`
      SELECT * FROM oauth_account_stats WHERE provider_type = ?
    `).all(providerType)
  }
  
  /**
   * 获取 OAuth 服务整体指标
   */
  async getMetrics(providerType?: OAuthProviderType): Promise<OAuthMetrics> {
    const query = providerType
      ? `SELECT 
          SUM(request_count) as totalRequests,
          SUM(success_count) as successCount,
          SUM(error_count) as errorCount,
          COUNT(*) as activeAccounts,
          SUM(CASE WHEN error_count > success_count THEN 1 ELSE 0 END) as failedAccounts
        FROM oauth_account_stats 
        WHERE provider_type = ?`
      : `SELECT 
          SUM(request_count) as totalRequests,
          SUM(success_count) as successCount,
          SUM(error_count) as errorCount,
          COUNT(*) as activeAccounts,
          SUM(CASE WHEN error_count > success_count THEN 1 ELSE 0 END) as failedAccounts
        FROM oauth_account_stats`
    
    const stmt = this.db.prepare(query)
    const result = providerType ? stmt.get(providerType) : stmt.get()
    
    return {
      totalRequests: (result as any)?.totalRequests || 0,
      successCount: (result as any)?.successCount || 0,
      errorCount: (result as any)?.errorCount || 0,
      avgLatency: 0, // TODO: Calculate from oauth_request_logs
      activeAccounts: (result as any)?.activeAccounts || 0,
      failedAccounts: (result as any)?.failedAccounts || 0,
    }
  }
}

// 单例
let oauthLogger: OAuthLogger | null = null

export function getOAuthLogger(): OAuthLogger {
  if (!oauthLogger) {
    oauthLogger = new OAuthLogger()
  }
  return oauthLogger
}
