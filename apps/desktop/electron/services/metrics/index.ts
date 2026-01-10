/**
 * Metrics service for tracking proxy performance
 */

export interface ProxyMetrics {
  totalRequests: number
  successRequests: number
  failedRequests: number
  averageLatency: number
  p50Latency: number
  p95Latency: number
  p99Latency: number
  requestsPerMinute: number
  activeConnections: number
  totalInputTokens: number
  totalOutputTokens: number
  windowStart: number
  windowEnd: number
}

interface MetricsData {
  requests: number
  successes: number
  failures: number
  latencies: number[]
  inputTokens: number
  outputTokens: number
}

// Metrics by proxy
const proxyMetrics = new Map<string, MetricsData>()

// Metrics by provider
const providerMetrics = new Map<string, MetricsData>()

// Global metrics
let globalMetrics: MetricsData = createEmptyMetrics()

// Request timestamps for RPM calculation
const requestTimestamps: number[] = []
const RPM_WINDOW = 60000 // 1 minute

// Active connections count
let activeConnections = 0

// Metrics window
let windowStart = Date.now()

/**
 * Create empty metrics data
 */
function createEmptyMetrics(): MetricsData {
  return {
    requests: 0,
    successes: 0,
    failures: 0,
    latencies: [],
    inputTokens: 0,
    outputTokens: 0
  }
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0
  
  const index = Math.ceil((p / 100) * sortedArr.length) - 1
  return sortedArr[Math.max(0, index)]
}

/**
 * Record a request
 */
export function recordRequest(
  proxyId: string,
  providerId: string,
  success: boolean,
  latencyMs: number,
  inputTokens?: number,
  outputTokens?: number
): void {
  const now = Date.now()
  
  // Update request timestamps for RPM
  requestTimestamps.push(now)
  
  // Clean old timestamps
  const cutoff = now - RPM_WINDOW
  while (requestTimestamps.length > 0 && requestTimestamps[0] < cutoff) {
    requestTimestamps.shift()
  }
  
  // Update global metrics
  updateMetrics(globalMetrics, success, latencyMs, inputTokens, outputTokens)
  
  // Update proxy metrics
  if (!proxyMetrics.has(proxyId)) {
    proxyMetrics.set(proxyId, createEmptyMetrics())
  }
  updateMetrics(proxyMetrics.get(proxyId)!, success, latencyMs, inputTokens, outputTokens)
  
  // Update provider metrics
  if (!providerMetrics.has(providerId)) {
    providerMetrics.set(providerId, createEmptyMetrics())
  }
  updateMetrics(providerMetrics.get(providerId)!, success, latencyMs, inputTokens, outputTokens)
}

/**
 * Update metrics data
 */
function updateMetrics(
  metrics: MetricsData,
  success: boolean,
  latencyMs: number,
  inputTokens?: number,
  outputTokens?: number
): void {
  metrics.requests++
  
  if (success) {
    metrics.successes++
  } else {
    metrics.failures++
  }
  
  // Keep last 1000 latencies for percentile calculation
  metrics.latencies.push(latencyMs)
  if (metrics.latencies.length > 1000) {
    metrics.latencies.shift()
  }
  
  if (inputTokens) {
    metrics.inputTokens += inputTokens
  }
  
  if (outputTokens) {
    metrics.outputTokens += outputTokens
  }
}

/**
 * Increment active connections
 */
export function incrementConnections(): void {
  activeConnections++
}

/**
 * Decrement active connections
 */
export function decrementConnections(): void {
  activeConnections = Math.max(0, activeConnections - 1)
}

/**
 * Get global metrics
 */
export function getMetrics(): ProxyMetrics {
  const sortedLatencies = [...globalMetrics.latencies].sort((a, b) => a - b)
  const now = Date.now()
  
  return {
    totalRequests: globalMetrics.requests,
    successRequests: globalMetrics.successes,
    failedRequests: globalMetrics.failures,
    averageLatency: sortedLatencies.length > 0
      ? Math.round(sortedLatencies.reduce((a, b) => a + b, 0) / sortedLatencies.length)
      : 0,
    p50Latency: Math.round(percentile(sortedLatencies, 50)),
    p95Latency: Math.round(percentile(sortedLatencies, 95)),
    p99Latency: Math.round(percentile(sortedLatencies, 99)),
    requestsPerMinute: requestTimestamps.length,
    activeConnections,
    totalInputTokens: globalMetrics.inputTokens,
    totalOutputTokens: globalMetrics.outputTokens,
    windowStart,
    windowEnd: now
  }
}

/**
 * Get metrics by proxy
 */
export function getProxyMetrics(proxyId: string): MetricsData | null {
  return proxyMetrics.get(proxyId) ?? null
}

/**
 * Get metrics by provider
 */
export function getProviderMetrics(providerId: string): MetricsData | null {
  return providerMetrics.get(providerId) ?? null
}

/**
 * Get all proxy metrics
 */
export function getAllProxyMetrics(): Map<string, MetricsData> {
  return new Map(proxyMetrics)
}

/**
 * Get all provider metrics
 */
export function getAllProviderMetrics(): Map<string, MetricsData> {
  return new Map(providerMetrics)
}

/**
 * Reset all metrics
 */
export function resetMetrics(): void {
  globalMetrics = createEmptyMetrics()
  proxyMetrics.clear()
  providerMetrics.clear()
  requestTimestamps.length = 0
  activeConnections = 0
  windowStart = Date.now()
  
  console.log('[Metrics] Reset')
}

/**
 * Get metrics summary
 */
export function getMetricsSummary(): {
  global: ProxyMetrics
  byProxy: Array<{ proxyId: string; requests: number; errors: number; avgLatency: number }>
  byProvider: Array<{ providerId: string; requests: number; errors: number; avgLatency: number }>
} {
  const byProxy = Array.from(proxyMetrics.entries()).map(([proxyId, m]) => ({
    proxyId,
    requests: m.requests,
    errors: m.failures,
    avgLatency: m.latencies.length > 0
      ? Math.round(m.latencies.reduce((a, b) => a + b, 0) / m.latencies.length)
      : 0
  }))
  
  const byProvider = Array.from(providerMetrics.entries()).map(([providerId, m]) => ({
    providerId,
    requests: m.requests,
    errors: m.failures,
    avgLatency: m.latencies.length > 0
      ? Math.round(m.latencies.reduce((a, b) => a + b, 0) / m.latencies.length)
      : 0
  }))
  
  return {
    global: getMetrics(),
    byProxy,
    byProvider
  }
}
