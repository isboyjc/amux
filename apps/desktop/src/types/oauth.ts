/**
 * OAuth Types for Frontend
 */

export type OAuthProviderType = 'codex' | 'antigravity'

export type OAuthHealthStatus = 'active' | 'rate_limited' | 'expired' | 'forbidden' | 'error'

export interface OAuthAccount {
  id: string
  provider_type: OAuthProviderType
  email: string
  token_type?: string
  is_active: number
  health_status: OAuthHealthStatus
  consecutive_failures: number
  pool_enabled: number
  pool_weight: number
  created_at: number
  updated_at: number
  last_used_at?: number
  last_refresh_at?: number
  provider_metadata?: string
  quota_info?: string
  usage_stats?: string
  error_message?: string
}

export interface CodexMetadata {
  account_type?: 'plus' | 'team' | 'enterprise'
  organization_id?: string
}

export interface CodexUsageStats {
  total_requests: number
  total_prompt_tokens: number
  total_completion_tokens: number
  today: {
    requests: number
    prompt_tokens: number
    completion_tokens: number
    reset_at: number
  }
  this_week: {
    requests: number
    tokens: number
    reset_at: number
  }
  this_month: {
    requests: number
    tokens: number
    reset_at: number
  }
  limits?: {
    daily_requests?: number
    monthly_requests?: number
    daily_tokens?: number
  }
}

export interface AntigravityMetadata {
  project_id: string
  subscription_tier: string
  project_id_fallback?: boolean
  device_profile?: {
    machine_id: string
    mac_machine_id: string
    dev_device_id: string
    sqm_id: string
  }
}

export interface AntigravityQuotaInfo {
  models: Array<{
    name: string
    percentage: number
    reset_time: string
  }>
  last_updated: number
  is_forbidden: boolean
  subscription_tier?: string // 'FREE' | 'PRO' | 'ULTRA'
}

export interface OAuthPoolStats {
  total: number
  active: number
  inactive: number
  rate_limited: number
  error: number
}

/**
 * OAuth 统计时间范围
 */
export type OAuthStatsTimeRange = 'today' | 'week' | 'month' | 'total'

/**
 * OAuth 账号本地调用统计（来自 oauth_account_stats 表）
 */
export interface OAuthAccountStats {
  requestCount: number
  successCount: number
  errorCount: number
  inputTokens: number
  outputTokens: number
  lastUsedAt: string | null
  successRate: string  // 百分比字符串 "95.5"
  totalTokens: number
  timeRange: OAuthStatsTimeRange
}

export type ProviderGenerationMode = 'individual' | 'pool'
// PoolStrategy removed - using simple "remember last successful account" logic
