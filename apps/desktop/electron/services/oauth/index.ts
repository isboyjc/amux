/**
 * OAuth Service Module Entry Point
 */

export { getOAuthManager, type CreateOAuthAccountResult } from './oauth-manager'
export { getTokenManager } from './token-manager'
export { getCallbackServer } from './callback-server'

export type {
  OAuthProviderType,
  OAuthProviderConfig,
  OAuthTokens,
  OAuthAccountInfo,
  CodexMetadata,
  CodexUsageStats,
  AntigravityMetadata,
  AntigravityQuotaInfo
} from './types'

export { OAuthError, OAuthTimeoutError, TokenRefreshError } from './types'
