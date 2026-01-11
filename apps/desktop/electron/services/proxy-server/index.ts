/**
 * Proxy server - Fastify-based HTTP proxy server
 */

import Fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import { getSettingsRepository } from '../database/repositories'
import type { ProxyServerConfig, ProxyServerState, ProxyServerMetrics } from './types'

// Singleton server instance
let server: FastifyInstance | null = null
let serverState: ProxyServerState = {
  running: false,
  port: 9527,
  host: '127.0.0.1'
}

// Metrics
let metrics: ProxyServerMetrics = {
  totalRequests: 0,
  successRequests: 0,
  failedRequests: 0,
  activeConnections: 0,
  averageLatency: 0,
  requestsPerMinute: 0,
  uptime: 0
}

// Latency tracking for average calculation
const latencyWindow: number[] = []
const MAX_LATENCY_SAMPLES = 1000

// Request tracking for RPM calculation
const requestTimestamps: number[] = []
const RPM_WINDOW = 60000 // 1 minute

/**
 * Get default server configuration from settings
 */
function getDefaultConfig(): ProxyServerConfig {
  const settings = getSettingsRepository()
  
  return {
    port: settings.get('proxy.port') ?? 9527,
    host: settings.get('proxy.host') ?? '127.0.0.1',
    timeout: settings.get('proxy.timeout') ?? 60000,
    cors: {
      enabled: settings.get('proxy.cors.enabled') ?? true,
      origins: settings.get('proxy.cors.origins') ?? ['*']
    }
  }
}

/**
 * Create Fastify server instance
 */
function createServer(config: ProxyServerConfig): FastifyInstance {
  const app = Fastify({
    logger: false,
    requestTimeout: config.timeout,
    bodyLimit: 10 * 1024 * 1024 // 10MB
  })

  // Register CORS if enabled
  if (config.cors?.enabled) {
    app.register(cors, {
      origin: config.cors.origins.includes('*') ? true : config.cors.origins,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
      credentials: config.cors.credentials ?? false
    })
  }

  // Health check endpoint
  app.get('/health', async () => {
    return {
      status: 'ok',
      uptime: serverState.startedAt ? Date.now() - serverState.startedAt : 0,
      metrics: getMetrics()
    }
  })

  // Request tracking hook
  app.addHook('onRequest', async () => {
    metrics.activeConnections++
    
    // Track request timestamp for RPM
    const now = Date.now()
    requestTimestamps.push(now)
    
    // Clean old timestamps
    const cutoff = now - RPM_WINDOW
    while (requestTimestamps.length > 0 && requestTimestamps[0] < cutoff) {
      requestTimestamps.shift()
    }
  })

  // Response tracking hook
  app.addHook('onResponse', async (request, reply) => {
    metrics.activeConnections = Math.max(0, metrics.activeConnections - 1)
    metrics.totalRequests++
    
    // Track success/failure
    if (reply.statusCode >= 200 && reply.statusCode < 300) {
      metrics.successRequests++
    } else {
      metrics.failedRequests++
    }
    
    // Track latency (responseTime is added by Fastify)
    const latency = reply.elapsedTime
    if (latency) {
      latencyWindow.push(latency)
      if (latencyWindow.length > MAX_LATENCY_SAMPLES) {
        latencyWindow.shift()
      }
      
      // Calculate average
      metrics.averageLatency = latencyWindow.reduce((a, b) => a + b, 0) / latencyWindow.length
    }
    
    // Calculate RPM
    metrics.requestsPerMinute = requestTimestamps.length
  })

  // Error handler
  app.setErrorHandler((error, request, reply) => {
    console.error('[ProxyServer] Error:', error)
    
    reply.status(error.statusCode ?? 500).send({
      error: {
        message: error.message,
        type: 'internal_error',
        code: 'INTERNAL_ERROR'
      }
    })
  })

  return app
}

/**
 * Start the proxy server
 * @param config - Server configuration
 * @param routeRegistrar - Optional function to register routes before listening
 */
export async function startServer(
  config?: Partial<ProxyServerConfig>,
  routeRegistrar?: (app: FastifyInstance) => void
): Promise<void> {
  if (server) {
    throw new Error('Server is already running')
  }

  const fullConfig = {
    ...getDefaultConfig(),
    ...config
  }

  // Clear bridge cache on server start to ensure fresh API keys
  const { invalidateCache } = await import('./bridge-manager')
  invalidateCache()
  console.log('[ProxyServer] Bridge cache cleared')

  server = createServer(fullConfig)

  // Register routes BEFORE listening (Fastify requirement)
  if (routeRegistrar) {
    routeRegistrar(server)
  }

  try {
    await server.listen({
      port: fullConfig.port,
      host: fullConfig.host
    })

    serverState = {
      running: true,
      port: fullConfig.port,
      host: fullConfig.host,
      startedAt: Date.now()
    }

    // Reset metrics
    metrics = {
      totalRequests: 0,
      successRequests: 0,
      failedRequests: 0,
      activeConnections: 0,
      averageLatency: 0,
      requestsPerMinute: 0,
      uptime: 0
    }

    console.log(`[ProxyServer] Started on http://${fullConfig.host}:${fullConfig.port}`)
  } catch (error) {
    server = null
    serverState = {
      running: false,
      port: fullConfig.port,
      host: fullConfig.host,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
    throw error
  }
}

/**
 * Stop the proxy server
 */
export async function stopServer(): Promise<void> {
  if (!server) {
    return
  }

  try {
    await server.close()
    console.log('[ProxyServer] Stopped')
  } catch (error) {
    console.error('[ProxyServer] Error stopping:', error)
  } finally {
    server = null
    serverState = {
      running: false,
      port: serverState.port,
      host: serverState.host
    }
  }
}

/**
 * Restart the proxy server
 */
export async function restartServer(
  config?: Partial<ProxyServerConfig>,
  routeRegistrar?: (app: FastifyInstance) => void
): Promise<void> {
  await stopServer()
  await startServer(config, routeRegistrar)
}

/**
 * Get server state
 */
export function getServerState(): ProxyServerState {
  return { ...serverState }
}

/**
 * Get server metrics
 */
export function getMetrics(): ProxyServerMetrics {
  return {
    ...metrics,
    uptime: serverState.startedAt ? Date.now() - serverState.startedAt : 0
  }
}

/**
 * Check if server is running
 */
export function isServerRunning(): boolean {
  return serverState.running && server !== null
}

/**
 * Get Fastify instance (for route registration)
 */
export function getServerInstance(): FastifyInstance | null {
  return server
}

/**
 * Record request metrics externally
 */
export function recordRequest(success: boolean, latencyMs: number): void {
  metrics.totalRequests++
  if (success) {
    metrics.successRequests++
  } else {
    metrics.failedRequests++
  }
  
  latencyWindow.push(latencyMs)
  if (latencyWindow.length > MAX_LATENCY_SAMPLES) {
    latencyWindow.shift()
  }
  metrics.averageLatency = latencyWindow.reduce((a, b) => a + b, 0) / latencyWindow.length
}

// Export types
export * from './types'
