/**
 * OAuth Provider Base Class
 * 
 * 抽象基类，定义OAuth Provider的公用方法和抽象接口
 */

import { shell } from 'electron'
import { getCallbackServer } from '../callback-server'
import { generateState, generateCodeVerifier, generateCodeChallenge } from '../crypto'
import type { 
  OAuthProviderConfig, 
  OAuthTokens, 
  OAuthAccountInfo,
  PKCECodes,
  OAuthCallbackData 
} from '../types'

export abstract class OAuthProviderService {
  protected abstract config: OAuthProviderConfig

  /**
   * 获取授权URL（不打开浏览器）
   */
  async getAuthorizationUrl(): Promise<{ authUrl: string; state: string }> {
    const state = generateState()
    const pkce = this.generatePKCE()
    
    // 启动回调服务器
    const callbackServer = getCallbackServer()
    await callbackServer.startServer(this.config.callbackPort)
    
    // 构建授权URL
    const authUrl = this.buildAuthUrl(state, pkce)
    
    // 存储state和pkce，供后续验证使用
    await this.storePendingAuth(state, pkce)
    
    return { authUrl, state }
  }

  /**
   * 启动OAuth授权流程（打开浏览器）
   */
  async startOAuthFlow(): Promise<OAuthCallbackData> {
    const { authUrl, state } = await this.getAuthorizationUrl()
    
    // 打开浏览器
    await shell.openExternal(authUrl)
    
    // 获取存储的pkce
    const pkce = await this.getPendingAuth(state)
    if (!pkce) {
      throw new Error('Invalid state: PKCE not found')
    }
    
    try {
      // 等待回调
      const callbackServer = getCallbackServer()
      const callbackData = await callbackServer.waitForCallback(
        this.getCallbackPath(),
        state,
        10 * 60 * 1000 // 10分钟超时
      )
      
      // 存储codeVerifier供后续使用
      ;(callbackData as any).codeVerifier = pkce.codeVerifier
      
      // 清理pending auth
      await this.clearPendingAuth(state)
      
      return callbackData
    } catch (error) {
      // 清理pending auth
      await this.clearPendingAuth(state)
      throw error
    }
  }

  /**
   * 取消OAuth授权流程
   */
  async cancelOAuthFlow(state: string): Promise<void> {
    const callbackServer = getCallbackServer()
    
    // 取消回调等待
    callbackServer.cancelCallback(this.getCallbackPath(), state)
    
    // 清理pending auth
    await this.clearPendingAuth(state)
  }
  
  /**
   * 存储待处理的授权信息
   */
  private pendingAuths = new Map<string, PKCECodes>()
  
  private async storePendingAuth(state: string, pkce: PKCECodes): Promise<void> {
    this.pendingAuths.set(state, pkce)
  }
  
  private async getPendingAuth(state: string): Promise<PKCECodes | undefined> {
    return this.pendingAuths.get(state)
  }
  
  private async clearPendingAuth(state: string): Promise<void> {
    this.pendingAuths.delete(state)
  }

  /**
   * 交换授权码为Token
   */
  async exchangeCodeForTokens(code: string, codeVerifier: string): Promise<OAuthTokens> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      code: code,
      redirect_uri: this.getRedirectUri(),
      code_verifier: codeVerifier
    })

    if (this.config.clientSecret) {
      params.append('client_secret', this.config.clientSecret)
    }

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

  /**
   * 刷新访问Token
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.config.clientId,
      refresh_token: refreshToken
    })

    if (this.config.clientSecret) {
      params.append('client_secret', this.config.clientSecret)
    }

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
      throw new Error(`Token refresh failed: ${response.status} ${error}`)
    }

    const data: any = await response.json()

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken, // 有些provider不返回新的refresh_token
      expiresIn: data.expires_in,
      tokenType: data.token_type || 'Bearer',
      idToken: data.id_token
    }
  }

  /**
   * 获取账号信息（抽象方法，子类必须实现）
   * 
   * @param tokens - OAuth tokens 对象（包含 accessToken, refreshToken, idToken 等）
   */
  abstract getAccountInfo(tokens: OAuthTokens): Promise<OAuthAccountInfo>

  /**
   * 获取配额信息（可选方法）
   */
  async getQuotaInfo?(_accessToken: string, ..._args: any[]): Promise<any> {
    throw new Error(`Quota info not supported by ${this.constructor.name}`)
  }

  /**
   * 获取使用统计（可选方法）
   */
  async getUsageStats?(_accountId: string): Promise<any> {
    throw new Error(`Usage stats not supported by ${this.constructor.name}`)
  }

  /**
   * 更新使用统计（可选方法）
   */
  async updateUsageStats?(_accountId: string, _stats: any): Promise<void> {
    throw new Error(`Usage stats update not supported by ${this.constructor.name}`)
  }

  /**
   * 生成PKCE codes
   */
  protected generatePKCE(): PKCECodes {
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    
    return {
      codeVerifier,
      codeChallenge
    }
  }

  /**
   * 构建授权URL（子类可重写）
   */
  protected buildAuthUrl(state: string, pkce: PKCECodes): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.getRedirectUri(),
      scope: this.config.scopes.join(' '),
      state: state,
      code_challenge: pkce.codeChallenge,
      code_challenge_method: 'S256'
    })

    return `${this.config.authUrl}?${params.toString()}`
  }

  /**
   * 获取回调路径
   */
  protected getCallbackPath(): string {
    const providerName = this.constructor.name.toLowerCase().replace('oauthservice', '')
    return `/oauth/${providerName}/callback`
  }

  /**
   * 获取重定向URI
   */
  protected getRedirectUri(): string {
    const providerName = this.constructor.name.toLowerCase().replace('oauthservice', '')
    return `http://localhost:${this.config.callbackPort}/oauth/${providerName}/callback`
  }
}
