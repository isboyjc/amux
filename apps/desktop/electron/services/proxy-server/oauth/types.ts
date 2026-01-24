import type { FastifyRequest, FastifyReply } from 'fastify'
import type { OAuthProviderType } from '../../../types/oauth'

/**
 * OAuth 转换器接口
 * 将 OAuth 厂商的非标准格式转换为标准适配器格式
 */
export interface OAuthTranslator {
  /**
   * 标准适配器类型（转换后的格式）
   * 例如：'openai', 'gemini', 'anthropic'
   */
  standardAdapterType: string
  
  /**
   * 处理请求
   * @param request - Fastify 请求（标准适配器格式）
   * @param reply - Fastify 响应
   */
  handle(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void>
}

/**
 * OAuth 账号选择结果
 */
export interface AccountSelection {
  account: {
    id: string
    email: string
    provider_metadata: string
  }
  accessToken: string
  metadata: Record<string, unknown>
}

/**
 * OAuth 请求日志参数
 */
export interface OAuthRequestLog {
  accountId: string
  providerType: OAuthProviderType
  success: boolean
  inputTokens?: number
  outputTokens?: number
  latencyMs?: number
  model?: string
  errorMessage?: string
}

/**
 * OAuth 账号健康状态
 */
export interface AccountHealth {
  accountId: string
  providerType: OAuthProviderType
  score: number  // 0-100
  successRate: number
  avgLatency: number
  recentErrors: number
  lastUsed: Date | null
  status: 'healthy' | 'degraded' | 'failed'
}

/**
 * OAuth 服务指标
 */
export interface OAuthMetrics {
  totalRequests: number
  successCount: number
  errorCount: number
  avgLatency: number
  activeAccounts: number
  failedAccounts: number
}
