/**
 * Antigravity (Google Codey) OAuth Provider
 * 
 * Antigravity使用Google OAuth 2.0 + 自定义API流程
 */

import type { 
  OAuthProviderConfig, 
  OAuthAccountInfo, 
  OAuthTokens,
  AntigravityMetadata, 
  AntigravityQuotaInfo 
} from '../types'

import { OAuthProviderService } from './base-provider'

export class AntigravityOAuthService extends OAuthProviderService {
  protected config: OAuthProviderConfig = {
    clientId: '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com',
    clientSecret: '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',
    scopes: [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/cclog',
      'https://www.googleapis.com/auth/experimentsandconfigs'
    ],
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    callbackPort: 51121
  }

  /**
   * 获取账号信息
   */
  override async getAccountInfo(tokens: OAuthTokens): Promise<OAuthAccountInfo> {
    const accessToken = tokens.accessToken
    let email = 'unknown@gmail.com'
    
    try {
      // 1. 获取用户基本信息
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })

      if (userInfoResponse.ok) {
        const userInfo: any = await userInfoResponse.json()
        email = userInfo.email || email
      } else {
        console.warn(`[AntigravityOAuth] Failed to fetch user info: ${userInfoResponse.status}`)
      }
    } catch (error) {
      console.error('[AntigravityOAuth] Error fetching user info:', error)
    }

    // 2. 获取Antigravity特定的metadata（永远不会抛出错误）
    const metadata = await this.getAntigravityMetadata(accessToken)

    return {
      email: email,
      providerMetadata: metadata
    }
  }

  /**
   * 获取Antigravity特定的metadata
   */
  private async getAntigravityMetadata(accessToken: string): Promise<AntigravityMetadata> {
    try {
      // 1. 生成metadata
      const metadata = {
        ideType: 'ANTIGRAVITY',
        platform: 'PLATFORM_UNSPECIFIED',
        pluginType: 'GEMINI'
      }

      // 2. 调用loadCodeAssist获取project_id和subscription_tier
      const loadCodeAssistResponse = await fetch(
        'https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'google-api-nodejs-client/9.15.1',
            'X-Goog-Api-Client': 'google-cloud-sdk vscode_cloudshelleditor/0.1',
            'Client-Metadata': JSON.stringify(metadata)
          },
          body: JSON.stringify({
            metadata: metadata
          })
        }
      )

      if (!loadCodeAssistResponse.ok) {
        console.warn(`[AntigravityOAuth] loadCodeAssist failed with status ${loadCodeAssistResponse.status}, trying fallback...`)
        return await this.getMetadataWithFallback(accessToken, metadata)
      }

      const loadCodeAssistData: any = await loadCodeAssistResponse.json()

      // 3. 提取project_id和subscription_tier
      let projectId = ''
      
      // Try different paths for project ID
      if (typeof loadCodeAssistData.cloudaicompanionProject === 'string') {
        projectId = loadCodeAssistData.cloudaicompanionProject
      } else if (loadCodeAssistData.cloudaicompanionProject?.id) {
        projectId = loadCodeAssistData.cloudaicompanionProject.id
      } else if (loadCodeAssistData.user_gcp_project?.project_id) {
        projectId = loadCodeAssistData.user_gcp_project.project_id
      } else if (loadCodeAssistData.gcp_project_id) {
        projectId = loadCodeAssistData.gcp_project_id
      }

      // ✅ 核心逻辑：优先从 paid_tier.id 获取订阅类型（参考 Antigravity-Manager）
      // paid_tier 比 current_tier 更能反映真实账户权益
      const subscriptionTier = 
        loadCodeAssistData.paidTier?.id || 
        loadCodeAssistData.currentTier?.id || 
        'FREE'

      // If no project ID found, try to get tierID and onboard
      if (!projectId) {
        console.warn('[AntigravityOAuth] No project_id in loadCodeAssist, trying onboardUser...')
        
        // Try to get default tier from allowedTiers
        let tierID = 'legacy-tier'
        if (Array.isArray(loadCodeAssistData.allowedTiers)) {
          for (const tier of loadCodeAssistData.allowedTiers) {
            if (tier.isDefault && tier.id) {
              tierID = tier.id
              break
            }
          }
        }
        
        return await this.getMetadataWithFallback(accessToken, metadata, tierID)
      }

      return {
        project_id: projectId,
        subscription_tier: subscriptionTier,
        metadata: metadata,
        project_id_fallback: false
      }
    } catch (error) {
      console.error('[AntigravityOAuth] Failed to get Antigravity metadata:', error)
      // Return default metadata instead of throwing
      return {
        project_id: '',
        subscription_tier: 'FREE',
        metadata: {
          ideType: 'ANTIGRAVITY',
          platform: 'PLATFORM_UNSPECIFIED',
          pluginType: 'GEMINI'
        },
        project_id_fallback: false
      }
    }
  }

  /**
   * Fallback: 使用onboardUser获取project_id
   */
  private async getMetadataWithFallback(
    accessToken: string,
    metadata: any,
    tierID: string = 'legacy-tier'
  ): Promise<AntigravityMetadata> {
    try {
      const onboardResponse = await fetch(
        'https://cloudcode-pa.googleapis.com/v1internal:onboardUser',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'google-api-nodejs-client/9.15.1',
            'X-Goog-Api-Client': 'google-cloud-sdk vscode_cloudshelleditor/0.1',
            'Client-Metadata': JSON.stringify(metadata)
          },
          body: JSON.stringify({
            tierId: tierID,
            metadata: metadata
          })
        }
      )

      if (!onboardResponse.ok) {
        console.warn(`[AntigravityOAuth] onboardUser failed with status ${onboardResponse.status}`)
        // Return default metadata instead of throwing
        return {
          project_id: '',
          subscription_tier: 'FREE',
          metadata: metadata,
          project_id_fallback: true
        }
      }

      const onboardData: any = await onboardResponse.json()
      
      // Check if operation is done
      if (onboardData.done && onboardData.response) {
        let projectId = ''
        
        // Try different paths for project ID
        if (typeof onboardData.response.cloudaicompanionProject === 'string') {
          projectId = onboardData.response.cloudaicompanionProject
        } else if (onboardData.response.cloudaicompanionProject?.id) {
          projectId = onboardData.response.cloudaicompanionProject.id
        } else if (onboardData.response.user_gcp_project?.project_id) {
          projectId = onboardData.response.user_gcp_project.project_id
        }
        
        return {
          project_id: projectId || '',
          subscription_tier: onboardData.response.subscription_tier || 'FREE',
          metadata: metadata,
          project_id_fallback: true
        }
      }

      // Operation not done yet, return default
      return {
        project_id: '',
        subscription_tier: 'FREE',
        metadata: metadata,
        project_id_fallback: true
      }
    } catch (error: any) {
      console.error('[AntigravityOAuth] Fallback failed:', error)
      // Return default metadata instead of throwing
      return {
        project_id: '',
        subscription_tier: 'FREE',
        metadata: metadata,
        project_id_fallback: true
      }
    }
  }

  /**
   * 获取配额信息
   * 调用 /v1internal:fetchAvailableModels 获取每个模型的配额信息
   */
  override async getQuotaInfo(accessToken: string, projectId?: string, subscriptionTier?: string): Promise<AntigravityQuotaInfo> {
    try {
      // 调用 fetchAvailableModels API 获取配额信息
      // 注意：即使没有 project_id，也尝试调用，因为 access token 可能就足够了
      const metadata = {
        ideType: 'ANTIGRAVITY',
        platform: 'PLATFORM_UNSPECIFIED',
        pluginType: 'GEMINI'
      }

      const fullUrl = 'https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels'
      
      const response = await fetch(
        fullUrl,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'antigravity/1.11.3 Darwin/arm64',
            'X-Goog-Api-Client': 'google-cloud-sdk vscode_cloudshelleditor/0.1',
            'Client-Metadata': JSON.stringify(metadata)
          },
          body: JSON.stringify({})  // ✅ 发送空 JSON 对象（参考 Antigravity-Manager）
        }
      )

      // 如果返回403,说明访问被禁止
      if (response.status === 403) {
        console.warn('[AntigravityOAuth] Access forbidden (403)')
        return {
          models: [],
          last_updated: Date.now(),
          is_forbidden: true,
          subscription_tier: subscriptionTier
        }
      }

      if (!response.ok) {
        const errorText = await response.text()
        console.warn(`[AntigravityOAuth] Quota check failed with status ${response.status}: ${errorText}`)
        // 非403错误,可能是其他原因,不标记为forbidden
        return {
          models: [],
          last_updated: Date.now(),
          is_forbidden: false,
          subscription_tier: subscriptionTier
        }
      }

      // 解析响应
      const data: any = await response.json()
      const models: any[] = []

      // 解析模型配额信息
      // 响应格式: { models: { "model-name": { quotaInfo: { remainingFraction, resetTime } } } }
      if (data.models && typeof data.models === 'object') {
        for (const [modelName, modelInfo] of Object.entries(data.models)) {
          const info = modelInfo as any
          if (info.quotaInfo) {
            const remainingFraction = info.quotaInfo.remainingFraction || 0
            const resetTime = info.quotaInfo.resetTime || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            
            // ✅ 计算剩余配额百分比（与 Antigravity-Manager 保持一致）
            // remainingFraction: 1.0 表示满额, 0.0 表示耗尽
            const percentage = Math.round(remainingFraction * 100)

            models.push({
              name: modelName,
              percentage: percentage,
              reset_time: resetTime
            })
          }
        }
      }

      return {
        models,
        last_updated: Date.now(),
        is_forbidden: false,
        subscription_tier: subscriptionTier
      }
    } catch (error) {
      console.error('[AntigravityOAuth] Failed to fetch quota info:', error)
      return {
        models: [],
        last_updated: Date.now(),
        is_forbidden: false,
        subscription_tier: subscriptionTier
      }
    }
  }

  /**
   * 重写 getRedirectUri 以匹配 CLIProxyAPIPlus 的路径
   * 实际代码使用 /google/callback 路径
   */
  protected override getRedirectUri(): string {
    return `http://localhost:${this.config.callbackPort}/google/callback`
  }

  /**
   * 重写 getCallbackPath 以匹配重定向URI
   */
  protected override getCallbackPath(): string {
    return '/google/callback'
  }

  /**
   * 重写buildAuthUrl以添加额外的参数
   * 注意：不使用 PKCE，遵循 CLIProxyAPIPlus 的实现
   */
  protected override buildAuthUrl(state: string, _pkce: any): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.getRedirectUri(),
      scope: this.config.scopes.join(' '),
      state: state,
      access_type: 'offline',
      prompt: 'consent'
    })

    return `${this.config.authUrl}?${params.toString()}`
  }

  /**
   * 重写 exchangeCodeForTokens
   * Antigravity 不使用 PKCE，而是使用 client_secret
   */
  override async exchangeCodeForTokens(code: string, _codeVerifier: string): Promise<any> {
    if (!this.config.clientSecret) {
      throw new Error('Client secret is required for Antigravity OAuth')
    }

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code: code,
      redirect_uri: this.getRedirectUri()
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
      throw new Error(`Token exchange failed: ${response.status} ${error}`)
    }

    const data: any = await response.json()

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type || 'Bearer',
      idToken: data.id_token
    }
  }
}

// 单例导出
let antigravityOAuthService: AntigravityOAuthService | null = null

export function getAntigravityOAuthService(): AntigravityOAuthService {
  if (!antigravityOAuthService) {
    antigravityOAuthService = new AntigravityOAuthService()
  }
  return antigravityOAuthService
}
