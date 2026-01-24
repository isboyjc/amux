/**
 * OAuth Providers Index
 */

export { OAuthProviderService } from './base-provider'
export { CodexOAuthService, getCodexOAuthService } from './codex-provider'
export { AntigravityOAuthService, getAntigravityOAuthService } from './antigravity-provider'

export type { OAuthProviderConfig, OAuthTokens, OAuthAccountInfo } from '../types'
