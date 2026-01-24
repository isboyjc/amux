/**
 * OAuth Service Type Definitions
 */

// OAuth provider types
export type OAuthProviderType = 'codex' | 'antigravity'

// OAuth provider configuration
export interface OAuthProviderConfig {
  clientId: string
  clientSecret?: string
  scopes: string[]
  authUrl: string
  tokenUrl: string
  callbackPort: number
}

// OAuth tokens
export interface OAuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: string
  idToken?: string // For Codex
}

// OAuth account info (returned after authorization)
export interface OAuthAccountInfo {
  email: string
  providerMetadata?: Record<string, any>
}

// PKCE codes for OAuth 2.0
export interface PKCECodes {
  codeVerifier: string
  codeChallenge: string
}

// OAuth callback data
export interface OAuthCallbackData {
  code: string
  state: string
  codeVerifier?: string
}

// Codex JWT Claims (从 id_token 解析)
export interface CodexJWTClaims {
  email: string
  email_verified: boolean
  'https://api.openai.com/auth': {
    chatgpt_account_id: string
    chatgpt_plan_type: string
    chatgpt_user_id: string
    chatgpt_subscription_active_start?: any
    chatgpt_subscription_active_until?: any
    chatgpt_subscription_last_checked?: string
    organizations: Array<{
      id: string
      is_default: boolean
      role: string
      title: string
    }>
    user_id: string
    groups?: any[]
  }
  sub?: string
  aud?: string[]
  iss?: string
  exp?: number
  iat?: number
}

// Codex specific metadata（保存到数据库的 provider_metadata）
export interface CodexMetadata {
  account_id?: string  // chatgpt_account_id
  user_id?: string     // user_id
  plan_type?: string   // chatgpt_plan_type (plus, team, enterprise)
  organizations?: Array<{
    id: string
    is_default: boolean
    role: string
    title: string
  }>
  id_token?: string    // 保存 id_token 用于后续使用
}

// Codex usage statistics
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

// Antigravity specific metadata
export interface AntigravityMetadata {
  project_id: string
  subscription_tier: string // 'FREE' | 'PRO' | 'ULTRA'
  project_id_fallback?: boolean
  metadata?: {
    ideType: string
    platform: string
    pluginType: string
  }
}

// Antigravity quota info
export interface AntigravityQuotaInfo {
  models: Array<{
    name: string
    percentage: number // 0-100
    reset_time: string // ISO 8601
  }>
  last_updated: number
  is_forbidden: boolean
  subscription_tier?: string // 'FREE' | 'PRO' | 'ULTRA'
}

// OAuth error types
export class OAuthError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number
  ) {
    super(message)
    this.name = 'OAuthError'
  }
}

export class OAuthTimeoutError extends OAuthError {
  constructor(message: string = 'OAuth authorization timeout') {
    super(message, 'OAUTH_TIMEOUT')
    this.name = 'OAuthTimeoutError'
  }
}

export class TokenRefreshError extends OAuthError {
  constructor(message: string = 'Failed to refresh access token') {
    super(message, 'TOKEN_REFRESH_FAILED')
    this.name = 'TokenRefreshError'
  }
}
