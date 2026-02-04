/**
 * Proxy server - Fastify-based HTTP proxy server
 */

import { readFileSync } from 'fs'
import { join } from 'path'

import cors from '@fastify/cors'
import Fastify, { FastifyInstance } from 'fastify'

import { getSettingsRepository } from '../database/repositories'

import type { ProxyServerConfig, ProxyServerState, ProxyServerMetrics } from './types'

// Read version from package.json
let appVersion = '0.0.0'
try {
  // Try desktop package.json first (apps/desktop/package.json)
  const packageJsonPath = join(__dirname, '../../../package.json')
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
  appVersion = packageJson.version || '0.0.0'
} catch (error) {
  // Fallback: try root package.json
  try {
    const rootPackageJsonPath = join(__dirname, '../../../../package.json')
    const packageJson = JSON.parse(readFileSync(rootPackageJsonPath, 'utf-8'))
    appVersion = packageJson.version || '0.0.0'
  } catch {
    console.warn('[ProxyServer] Failed to read version, using default:', appVersion)
  }
}

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

  // Root status page (HTML)
  app.get('/', async (_request, reply) => {
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Amux</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    /* Light theme */
    :root {
      --background: hsl(220, 14%, 96%);
      --foreground: hsl(222.2, 84%, 4.9%);
      --primary: hsl(222.2, 47.4%, 11.2%);
      --muted-foreground: hsl(215.4, 16.3%, 46.9%);
    }
    
    /* Dark theme */
    @media (prefers-color-scheme: dark) {
      :root {
        --background: hsl(224, 28%, 8%);
        --foreground: hsl(210, 40%, 98%);
        --primary: hsl(210, 40%, 98%);
        --muted-foreground: hsl(215, 20.2%, 65.1%);
      }
    }
    
    body {
      font-family: 'Ubuntu', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--background);
      color: var(--foreground);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      transition: background-color 0.2s ease, color 0.2s ease;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    
    .container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
    }
    
    .logo-link {
      display: flex;
      align-items: center;
      gap: 16px;
      text-decoration: none;
      color: inherit;
      transition: opacity 0.2s ease;
    }
    
    .logo-link:hover {
      opacity: 0.8;
    }
    
    .logo {
      width: 64px;
      height: 64px;
      flex-shrink: 0;
    }
    
    .logo-path {
      fill: var(--primary);
      transition: fill 0.2s ease;
    }
    
    h1 {
      font-size: 56px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--foreground);
      transition: color 0.2s ease;
    }
    
    .links {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    
    .link {
      color: var(--muted-foreground);
      text-decoration: none;
      font-size: 14px;
      font-weight: 400;
    }
    
    .link:hover {
      text-decoration: underline;
    }
    
    .github-icon-link {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--muted-foreground);
      text-decoration: none;
      font-size: 14px;
      font-weight: 400;
      transition: opacity 0.2s ease;
      opacity: 0.6;
    }
    
    .github-icon-link:hover {
      opacity: 1;
    }
    
    .github-icon {
      width: 20px;
      height: 20px;
    }
    
    .version {
      color: var(--muted-foreground);
      font-size: 13px;
      font-weight: 400;
      opacity: 0.6;
      margin-top: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <a href="https://amux.ai" target="_blank" rel="noopener noreferrer" class="logo-link">
      <svg class="logo" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          class="logo-path"
          d="M4 96 
             C4 96, 24 12, 64 12
             C104 12, 124 96, 124 96
             Q124 102, 118 102
             C94 102, 92 64, 64 64
             C36 64, 34 102, 10 102
             Q4 102, 4 96
             Z"
        />
      </svg>
      <h1>Amux.ai</h1>
    </a>
    
    <div class="links">
      <a href="https://github.com/isboyjc/amux" target="_blank" rel="noopener noreferrer" class="github-icon-link">
        <svg class="github-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
        </svg>
        <span>GitHub</span>
      </a>
      <div class="version">v${appVersion}</div>
    </div>
  </div>
</body>
</html>`
    
    return reply.type('text/html').send(html)
  })

  // Health check endpoint (JSON)
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
    while (requestTimestamps.length > 0 && (requestTimestamps[0] || 0) < cutoff) {
      requestTimestamps.shift()
    }
  })

  // Response tracking hook
  app.addHook('onResponse', async (_request, reply) => {
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
  app.setErrorHandler((error, _request, reply) => {
    console.error('[ProxyServer] Error:', error)
    
    const statusCode = (error as any).statusCode ?? 500
    const message = error instanceof Error ? error.message : String(error)
    
    reply.status(statusCode).send({
      error: {
        message,
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

  // 🔒 重置 OAuth 路由标志（在创建新服务器之前）
  try {
    const { resetOAuthRoutes } = await import('./oauth')
    resetOAuthRoutes()
  } catch (error) {
    // Ignore errors
  }

  server = createServer(fullConfig)

  // 🆕 Register OAuth translation routes FIRST (higher priority)
  try {
    const { registerOAuthRoutes } = await import('./oauth')
    registerOAuthRoutes(server)
  } catch (error) {
    console.error('[ProxyServer] Failed to register OAuth routes:', error)
    // OAuth routes are optional, don't fail server start
  }

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
    
    // 🔒 重置 OAuth 路由注册标志，允许下次重新注册
    try {
      const { resetOAuthRoutes } = await import('./oauth')
      resetOAuthRoutes()
    } catch (error) {
      // OAuth routes are optional, ignore errors
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

// Export Codex unified endpoint utilities
export { invalidateModelListCache } from './codex-unified-handler'
