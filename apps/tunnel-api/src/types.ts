/**
 * 环境变量类型定义
 */
export interface Env {
  // Cloudflare 配置
  CF_API_TOKEN: string
  CF_ZONE_ID: string
  CF_ACCOUNT_ID: string
  
  // 数据存储
  KV: KVNamespace
  DB: D1Database
}

/**
 * Tunnel 信息
 */
export interface Tunnel {
  id: string
  tunnel_id: string
  device_id: string
  subdomain: string
  credentials: string  // JSON string
  status: 'active' | 'inactive'
  created_at: number
  last_active_at: number | null
  deleted_at: number | null
}

/**
 * 创建 Tunnel 请求
 */
export interface CreateTunnelRequest {
  deviceId: string
}

/**
 * 创建 Tunnel 响应
 */
export interface CreateTunnelResponse {
  success: boolean
  data?: {
    tunnelId: string
    subdomain: string
    domain: string
    credentials: TunnelCredentials
    isExisting?: boolean
  }
  error?: string
}

/**
 * Tunnel 凭证
 */
export interface TunnelCredentials {
  AccountTag: string
  TunnelSecret: string
  TunnelID: string
  TunnelName: string
}

/**
 * Cloudflare Tunnel API 响应
 */
export interface CloudflareTunnelResponse {
  success: boolean
  result?: {
    id: string
    name: string
    created_at: string
    credentials_file?: {
      AccountTag: string
      TunnelSecret: string
      TunnelID: string
    }
  }
  errors?: Array<{
    code: number
    message: string
  }>
}

/**
 * API 响应
 */
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}
