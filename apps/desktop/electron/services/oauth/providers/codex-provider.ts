/**
 * Codex (OpenAI) OAuth Provider
 * 
 * Codex使用标准的OpenAI OAuth 2.0流程
 */

import { parseJWT } from '../crypto'
import type { 
  OAuthProviderConfig, 
  OAuthAccountInfo, 
  CodexMetadata, 
  CodexUsageStats, 
  PKCECodes,
  OAuthTokens,
  CodexJWTClaims 
} from '../types'

import { OAuthProviderService } from './base-provider'

export class CodexOAuthService extends OAuthProviderService {
  protected config: OAuthProviderConfig = {
    clientId: 'app_EMoamEEZ73f0CkXaXp7hrann',
    scopes: ['openid', 'email', 'profile', 'offline_access'],
    authUrl: 'https://auth.openai.com/oauth/authorize',
    tokenUrl: 'https://auth.openai.com/oauth/token',
    callbackPort: 1455
  }

  /**
   * 获取账号信息
   */
  override async getAccountInfo(tokens: OAuthTokens): Promise<OAuthAccountInfo> {
    // Codex 必须使用 id_token 来获取用户信息
    if (!tokens.idToken) {
      throw new Error('id_token is required for Codex OAuth')
    }

    try {
      // 解析 id_token 的 JWT claims
      const claims = this.parseCodexClaims(tokens.idToken)
      
      // 提取用户信息
      const email = claims.email || 'unknown@openai.com'
      const metadata = this.extractCodexMetadata(claims, tokens.idToken)

      return {
        email,
        providerMetadata: metadata
      }
    } catch (error) {
      console.error('[CodexOAuth] Failed to parse id_token:', error)
      throw new Error(`Failed to get Codex account info: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 解析 Codex JWT Claims
   * 
   * Codex 的 id_token 包含用户信息在 "https://api.openai.com/auth" 字段中
   */
  private parseCodexClaims(idToken: string): CodexJWTClaims {
    const claims = parseJWT(idToken) as CodexJWTClaims
    
    // 验证必要字段
    if (!claims.email) {
      throw new Error('Invalid Codex id_token: missing email')
    }
    
    if (!claims['https://api.openai.com/auth']) {
      throw new Error('Invalid Codex id_token: missing OpenAI auth info')
    }
    
    return claims
  }

  /**
   * 提取 Codex 特定的 metadata
   * 
   * 从 JWT claims 中提取并转换为我们的 metadata 格式
   */
  private extractCodexMetadata(claims: CodexJWTClaims, idToken: string): CodexMetadata {
    const authInfo = claims['https://api.openai.com/auth']
    
    return {
      account_id: authInfo.chatgpt_account_id,
      user_id: authInfo.chatgpt_user_id || authInfo.user_id,
      plan_type: authInfo.chatgpt_plan_type,
      organizations: authInfo.organizations || [],
      id_token: idToken  // 保存 id_token 用于后续使用
    }
  }

  /**
   * 重写 getRedirectUri 以匹配 CLIProxyAPIPlus 的路径
   */
  protected override getRedirectUri(): string {
    return `http://localhost:${this.config.callbackPort}/auth/callback`
  }

  /**
   * 重写 getCallbackPath 以匹配重定向URI
   */
  protected override getCallbackPath(): string {
    return '/auth/callback'
  }

  /**
   * 重写buildAuthUrl以添加Codex特殊参数
   */
  protected override buildAuthUrl(state: string, pkce: PKCECodes): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.getRedirectUri(),
      scope: this.config.scopes.join(' '),
      state: state,
      code_challenge: pkce.codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'login',
      id_token_add_organizations: 'true',
      codex_cli_simplified_flow: 'true'
    })

    return `${this.config.authUrl}?${params.toString()}`
  }

  /**
   * 重写 refreshAccessToken 以添加 scope 参数
   * 
   * Codex 刷新 token 时必须指定 scope，否则不会返回 id_token
   */
  override async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.config.clientId,
      refresh_token: refreshToken,
      scope: 'openid profile email'  // 必须指定 scope 以获取 id_token
    })

    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Codex token refresh failed: ${response.status} ${error}`)
    }

    const data: any = await response.json()

    // 确保返回了所有必要的 token
    if (!data.access_token || !data.refresh_token) {
      throw new Error('Codex token refresh response missing required tokens')
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in || 3600,
      tokenType: data.token_type || 'Bearer',
      idToken: data.id_token  // 刷新后也应该返回 id_token
    }
  }

  /**
   * 初始化使用统计
   */
  async initUsageStats(): Promise<CodexUsageStats> {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)
    
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    return {
      total_requests: 0,
      total_prompt_tokens: 0,
      total_completion_tokens: 0,
      today: {
        requests: 0,
        prompt_tokens: 0,
        completion_tokens: 0,
        reset_at: todayStart.getTime() + 24 * 60 * 60 * 1000
      },
      this_week: {
        requests: 0,
        tokens: 0,
        reset_at: weekStart.getTime() + 7 * 24 * 60 * 60 * 1000
      },
      this_month: {
        requests: 0,
        tokens: 0,
        reset_at: new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1).getTime()
      }
      // 注意：OpenAI 没有公开的配额查询 API，因此不设置 limits
      // 用户可以在前端看到实际使用量，但不会显示虚假的"限制"
    }
  }

  /**
   * 更新使用统计（Codex专用方法）
   * 
   * 注意：此方法签名与基类不同，因为Codex需要特殊的usage tracking
   */
  async updateCodexUsageStats(
    currentStats: CodexUsageStats,
    requestData: { promptTokens: number; completionTokens: number }
  ): Promise<CodexUsageStats> {
    const now = Date.now()
    const stats = { ...currentStats }

    // 检查是否需要重置
    if (now >= stats.today.reset_at) {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      stats.today = {
        requests: 0,
        prompt_tokens: 0,
        completion_tokens: 0,
        reset_at: todayStart.getTime() + 24 * 60 * 60 * 1000
      }
    }

    if (now >= stats.this_week.reset_at) {
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      weekStart.setHours(0, 0, 0, 0)
      stats.this_week = {
        requests: 0,
        tokens: 0,
        reset_at: weekStart.getTime() + 7 * 24 * 60 * 60 * 1000
      }
    }

    if (now >= stats.this_month.reset_at) {
      const monthStart = new Date()
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)
      stats.this_month = {
        requests: 0,
        tokens: 0,
        reset_at: new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1).getTime()
      }
    }

    // 更新统计
    const totalTokens = requestData.promptTokens + requestData.completionTokens

    stats.total_requests += 1
    stats.total_prompt_tokens += requestData.promptTokens
    stats.total_completion_tokens += requestData.completionTokens

    stats.today.requests += 1
    stats.today.prompt_tokens += requestData.promptTokens
    stats.today.completion_tokens += requestData.completionTokens

    stats.this_week.requests += 1
    stats.this_week.tokens += totalTokens

    stats.this_month.requests += 1
    stats.this_month.tokens += totalTokens

    return stats
  }
}

// 单例导出
let codexOAuthService: CodexOAuthService | null = null

export function getCodexOAuthService(): CodexOAuthService {
  if (!codexOAuthService) {
    codexOAuthService = new CodexOAuthService()
  }
  return codexOAuthService
}
