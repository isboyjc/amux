/**
 * Proxy server type definitions
 */

// Server configuration
export interface ProxyServerConfig {
  port: number
  host: string
  cors?: CorsConfig
  timeout?: number
}

// CORS configuration
export interface CorsConfig {
  enabled: boolean
  origins: string[]
  methods?: string[]
  allowedHeaders?: string[]
  credentials?: boolean
}

// Server state
export interface ProxyServerState {
  running: boolean
  port: number
  host: string
  startedAt?: number
  error?: string
}

// Server metrics
export interface ProxyServerMetrics {
  totalRequests: number
  successRequests: number
  failedRequests: number
  activeConnections: number
  averageLatency: number
  requestsPerMinute: number
  uptime: number
}

// Request context
export interface ProxyRequestContext {
  requestId: string
  proxyPath: string
  sourceModel: string
  targetModel: string
  providerId: string
  startTime: number
}

// Proxy error
export interface ProxyError {
  code: string
  message: string
  details?: unknown
  retryable: boolean
  retryAfter?: number
}

// Error codes
export enum ProxyErrorCode {
  INVALID_API_KEY = 'INVALID_API_KEY',
  MISSING_API_KEY = 'MISSING_API_KEY',
  PROXY_NOT_FOUND = 'PROXY_NOT_FOUND',
  PROVIDER_NOT_FOUND = 'PROVIDER_NOT_FOUND',
  PROVIDER_DISABLED = 'PROVIDER_DISABLED',
  PROXY_DISABLED = 'PROXY_DISABLED',
  CIRCULAR_PROXY = 'CIRCULAR_PROXY',
  MODEL_NOT_SUPPORTED = 'MODEL_NOT_SUPPORTED',
  PROVIDER_UNREACHABLE = 'PROVIDER_UNREACHABLE',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',
  CIRCUIT_OPEN = 'CIRCUIT_OPEN',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  ADAPTER_ERROR = 'ADAPTER_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST'
}
