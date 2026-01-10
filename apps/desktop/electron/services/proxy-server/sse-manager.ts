/**
 * SSE (Server-Sent Events) connection manager
 */

import { getSettingsRepository } from '../database/repositories'

export interface SSEConfig {
  heartbeatInterval: number
  connectionTimeout: number
}

interface SSEConnection {
  id: string
  startTime: number
  lastActivity: number
  heartbeatTimer?: NodeJS.Timeout
  response: {
    write: (data: string) => void
    end: () => void
  }
}

// Active connections
const connections = new Map<string, SSEConnection>()

// Cleanup interval
let cleanupInterval: NodeJS.Timeout | null = null

/**
 * Get SSE config from settings
 */
export function getSSEConfig(): SSEConfig {
  const settings = getSettingsRepository()
  
  return {
    heartbeatInterval: settings.get('proxy.sse.heartbeatInterval') ?? 30000,
    connectionTimeout: settings.get('proxy.sse.connectionTimeout') ?? 300000
  }
}

/**
 * Start the cleanup interval
 */
function startCleanupInterval(): void {
  if (cleanupInterval) {
    return
  }
  
  cleanupInterval = setInterval(() => {
    cleanupStaleConnections()
  }, 60000) // Check every minute
}

/**
 * Stop the cleanup interval
 */
function stopCleanupInterval(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval)
    cleanupInterval = null
  }
}

/**
 * Create a new SSE connection
 */
export function createConnection(
  connectionId: string,
  response: SSEConnection['response']
): SSEConnection {
  const config = getSSEConfig()
  const now = Date.now()
  
  const connection: SSEConnection = {
    id: connectionId,
    startTime: now,
    lastActivity: now,
    response
  }
  
  // Start heartbeat
  if (config.heartbeatInterval > 0) {
    connection.heartbeatTimer = setInterval(() => {
      sendHeartbeat(connectionId)
    }, config.heartbeatInterval)
  }
  
  connections.set(connectionId, connection)
  
  // Start cleanup if this is the first connection
  if (connections.size === 1) {
    startCleanupInterval()
  }
  
  console.log(`[SSEManager] Connection created: ${connectionId}`)
  
  return connection
}

/**
 * Send heartbeat to keep connection alive
 */
export function sendHeartbeat(connectionId: string): void {
  const connection = connections.get(connectionId)
  
  if (!connection) {
    return
  }
  
  try {
    // Send SSE comment (heartbeat)
    connection.response.write(': heartbeat\n\n')
    connection.lastActivity = Date.now()
  } catch (error) {
    console.error(`[SSEManager] Heartbeat failed for ${connectionId}:`, error)
    closeConnection(connectionId)
  }
}

/**
 * Update connection activity timestamp
 */
export function updateActivity(connectionId: string): void {
  const connection = connections.get(connectionId)
  
  if (connection) {
    connection.lastActivity = Date.now()
  }
}

/**
 * Close a connection
 */
export function closeConnection(connectionId: string): void {
  const connection = connections.get(connectionId)
  
  if (!connection) {
    return
  }
  
  // Clear heartbeat timer
  if (connection.heartbeatTimer) {
    clearInterval(connection.heartbeatTimer)
  }
  
  // Try to end the response
  try {
    connection.response.end()
  } catch {
    // Ignore errors when closing
  }
  
  connections.delete(connectionId)
  
  console.log(`[SSEManager] Connection closed: ${connectionId}`)
  
  // Stop cleanup if no more connections
  if (connections.size === 0) {
    stopCleanupInterval()
  }
}

/**
 * Clean up stale connections
 */
export function cleanupStaleConnections(): void {
  const config = getSSEConfig()
  const now = Date.now()
  const stale: string[] = []
  
  for (const [id, connection] of connections) {
    const age = now - connection.lastActivity
    
    if (age > config.connectionTimeout) {
      stale.push(id)
    }
  }
  
  for (const id of stale) {
    console.log(`[SSEManager] Cleaning up stale connection: ${id}`)
    closeConnection(id)
  }
  
  if (stale.length > 0) {
    console.log(`[SSEManager] Cleaned up ${stale.length} stale connections`)
  }
}

/**
 * Get connection count
 */
export function getConnectionCount(): number {
  return connections.size
}

/**
 * Get all connection IDs
 */
export function getConnectionIds(): string[] {
  return Array.from(connections.keys())
}

/**
 * Get connection statistics
 */
export function getConnectionStats(): {
  total: number
  connections: Array<{
    id: string
    duration: number
    lastActivity: number
  }>
} {
  const now = Date.now()
  
  return {
    total: connections.size,
    connections: Array.from(connections.values()).map(conn => ({
      id: conn.id,
      duration: now - conn.startTime,
      lastActivity: now - conn.lastActivity
    }))
  }
}

/**
 * Close all connections
 */
export function closeAllConnections(): void {
  const ids = Array.from(connections.keys())
  
  for (const id of ids) {
    closeConnection(id)
  }
  
  console.log('[SSEManager] All connections closed')
}
