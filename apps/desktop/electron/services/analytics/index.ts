/**
 * Google Analytics 4 统计服务
 * 用于收集应用使用数据，帮助改进产品
 */

import { randomUUID } from 'crypto'

import { app } from 'electron'
import type Analytics4 from 'electron-google-analytics4'

import { getSettingsRepository } from '../database/repositories/settings'

// 动态导入 Analytics4
let Analytics4Class: typeof Analytics4 | null = null

// GA4 配置
const MEASUREMENT_ID = process.env.GA_MEASUREMENT_ID || 'G-XXXXXXXXXX'
const API_SECRET = process.env.GA_API_SECRET || ''

// 匿名用户 ID（不收集真实身份）
let clientId: string | null = null
let sessionId: string | null = null

// Analytics 实例
let analytics: Analytics4 | null = null

/**
 * 初始化 Analytics
 */
export async function initAnalytics(): Promise<void> {
  try {
    // 检查配置
    if (!MEASUREMENT_ID || MEASUREMENT_ID === 'G-XXXXXXXXXX') {
      console.log('[Analytics] Not configured')
      return
    }

    if (!API_SECRET) {
      console.log('[Analytics] API Secret not configured')
      return
    }

    const settingsRepo = getSettingsRepository()
    
    // 检查是否启用统计
    const enabled = settingsRepo.get('analytics.enabled')
    
    if (enabled === false) {
      console.log('[Analytics] Disabled by user')
      return
    }

    // 动态导入 Analytics4
    if (!Analytics4Class) {
      const module = await import('electron-google-analytics4')
      Analytics4Class = module.default
    }

    // 获取或创建匿名客户端 ID
    clientId = settingsRepo.get('analytics.userId') || null
    if (!clientId) {
      clientId = `anon-${randomUUID()}`
      settingsRepo.set('analytics.userId', clientId)
    }

    // 创建会话 ID
    sessionId = randomUUID()

    // 初始化 GA4
    analytics = new Analytics4Class(MEASUREMENT_ID, API_SECRET, clientId, sessionId)

    // 设置全局参数
    analytics.setParams({
      app_version: app.getVersion(),
      app_platform: process.platform,
      app_arch: process.arch,
      app_locale: app.getLocale()
    })

    console.log('[Analytics] Initialized')

    // 发送应用启动事件
    trackEvent('app_started', {
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      locale: app.getLocale()
    })
  } catch (error) {
    console.error('[Analytics] Initialization failed:', error)
  }
}

/**
 * 追踪页面浏览
 */
export function trackPageView(pageName: string, pageTitle?: string): void {
  if (!isEnabled()) return

  try {
    analytics?.set('page_location', pageName)
    analytics?.set('page_title', pageTitle || pageName)
    analytics?.event('page_view')
    console.log(`[Analytics] Page view: ${pageName}`)
  } catch (error) {
    console.error('[Analytics] Track page view failed:', error)
  }
}

/**
 * 追踪事件
 */
export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>
): void {
  if (!isEnabled()) return

  try {
    // 过滤敏感信息
    const sanitizedParams = sanitizeParams(params)

    // 设置事件参数
    if (sanitizedParams && Object.keys(sanitizedParams).length > 0) {
      analytics?.setParams(sanitizedParams)
    }

    // 发送事件
    analytics?.event(eventName)

    console.log(`[Analytics] Event: ${eventName}`, sanitizedParams)
  } catch (error) {
    console.error('[Analytics] Track event failed:', error)
  }
}

/**
 * 设置用户属性
 */
export function setUserProperties(properties: Record<string, string | number>): void {
  if (!isEnabled()) return

  try {
    analytics?.setUserProperties(properties)
    console.log(`[Analytics] User properties set:`, properties)
  } catch (error) {
    console.error('[Analytics] Set user properties failed:', error)
  }
}

/**
 * 启用/禁用统计
 */
export function setAnalyticsEnabled(enabled: boolean): void {
  const settingsRepo = getSettingsRepository()
  settingsRepo.set('analytics.enabled', enabled)
  
  if (enabled && !analytics) {
    initAnalytics()
  }
  
  console.log(`[Analytics] ${enabled ? 'Enabled' : 'Disabled'}`)
}

/**
 * 检查是否启用
 */
function isEnabled(): boolean {
  const settingsRepo = getSettingsRepository()
  const enabled = settingsRepo.get('analytics.enabled')
  return enabled !== false && analytics !== null
}

/**
 * 过滤敏感参数
 */
function sanitizeParams(
  params?: Record<string, string | number | boolean>
): Record<string, string | number | boolean> {
  if (!params) return {}

  const sensitiveKeys = [
    'api_key', 'apiKey', 'apikey',
    'password', 'pwd',
    'token', 'access_token', 'refresh_token',
    'secret', 'private_key',
    'authorization', 'auth'
  ]

  const result: Record<string, string | number | boolean> = {}

  for (const [key, value] of Object.entries(params)) {
    const lowerKey = key.toLowerCase()
    const isSensitive = sensitiveKeys.some(s => lowerKey.includes(s))
    
    if (isSensitive) {
      result[key] = '[REDACTED]'
    } else {
      result[key] = value
    }
  }

  return result
}

/**
 * 导出常用的事件追踪函数
 */

// Provider 事件
export const trackProviderCreated = (adapterType: string, hasApiKey: boolean) => {
  trackEvent('provider_created', {
    adapter_type: adapterType,
    has_api_key: hasApiKey
  })
}

export const trackProviderDeleted = (adapterType: string) => {
  trackEvent('provider_deleted', { adapter_type: adapterType })
}

export const trackProviderTested = (adapterType: string, success: boolean, latency?: number) => {
  trackEvent('provider_tested', {
    adapter_type: adapterType,
    success,
    ...(latency !== undefined && { latency })
  })
}

// Proxy 事件
export const trackProxyCreated = (inboundAdapter: string, outboundType: string) => {
  trackEvent('proxy_created', {
    inbound_adapter: inboundAdapter,
    outbound_type: outboundType
  })
}

export const trackProxyDeleted = () => {
  trackEvent('proxy_deleted')
}

// API 请求事件
export const trackApiRequest = (proxyPath: string, statusCode: number, latency: number) => {
  trackEvent('api_request', {
    proxy_path: proxyPath,
    status_code: statusCode,
    latency_ms: latency,
    success: statusCode >= 200 && statusCode < 300
  })
}

// 功能使用
export const trackFeatureUsed = (featureName: string) => {
  trackEvent('feature_used', { feature: featureName })
}

// 错误追踪
export const trackError = (errorType: string, errorMessage: string) => {
  trackEvent('error_occurred', {
    error_type: errorType,
    error_message: errorMessage.substring(0, 100) // 限制长度
  })
}

// 设置变更
export const trackSettingChanged = (settingKey: string, newValue: unknown) => {
  trackEvent('setting_changed', {
    setting: settingKey,
    value_type: typeof newValue
  })
}

// Tunnel 事件
export const trackTunnelStarted = (providerId?: string, externalUrl?: string) => {
  trackEvent('tunnel_started', {
    has_provider: !!providerId,
    has_external_url: !!externalUrl,
    ...(externalUrl && { external_url: externalUrl })  // 外部代理地址不算隐私
  })
}

export const trackTunnelStopped = (duration?: number) => {
  trackEvent('tunnel_stopped', {
    ...(duration && { duration_seconds: Math.round(duration / 1000) })
  })
}

// OAuth 事件
export const trackOAuthAuthorized = (providerType: string, success: boolean, errorMessage?: string) => {
  trackEvent('oauth_authorized', {
    provider_type: providerType,
    success,
    ...(errorMessage && { error: errorMessage.substring(0, 100) })
  })
}

export const trackOAuthAccountDeleted = (providerType: string) => {
  trackEvent('oauth_account_deleted', {
    provider_type: providerType
  })
}

// Chat 事件
export const trackConversationCreated = (model?: string, providerId?: string, proxyId?: string) => {
  trackEvent('conversation_created', {
    has_model: !!model,
    has_provider: !!providerId,
    has_proxy: !!proxyId,
    ...(model && { model })
  })
}

export const trackConversationDeleted = () => {
  trackEvent('conversation_deleted', {})
}

export const trackMessageSent = (
  model: string,
  proxyType: 'provider' | 'proxy',
  adapterType: string,
  success: boolean,
  latency?: number,
  errorMessage?: string
) => {
  trackEvent('message_sent', {
    model,
    proxy_type: proxyType,
    adapter_type: adapterType,
    success,
    ...(latency !== undefined && { latency_ms: Math.round(latency) }),
    ...(errorMessage && { error: errorMessage.substring(0, 100) })
  })
}

// Proxy Service 事件
export const trackProxyServiceStarted = (port: number) => {
  trackEvent('proxy_service_started', {
    port
  })
}

export const trackProxyServiceStopped = () => {
  trackEvent('proxy_service_stopped', {})
}

// API Key 事件
export const trackApiKeyCreated = (hasName: boolean) => {
  trackEvent('api_key_created', {
    has_name: hasName
  })
}

export const trackApiKeyDeleted = () => {
  trackEvent('api_key_deleted', {})
}

export const trackApiKeyToggled = (enabled: boolean) => {
  trackEvent('api_key_toggled', {
    enabled
  })
}
