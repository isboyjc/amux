/**
 * Proxy service IPC handlers
 */

import { ipcMain, BrowserWindow } from 'electron'
import {
  startServer,
  stopServer,
  restartServer,
  getServerState
} from '../services/proxy-server'
import { registerRoutes } from '../services/proxy-server/routes'
import { getMetrics } from '../services/metrics'

export function registerProxyServiceHandlers(): void {
  // Start proxy service
  ipcMain.handle('proxy-service:start', async (_event, config?: { port?: number; host?: string }) => {
    try {
      // Pass route registrar to startServer - routes must be registered BEFORE listen()
      await startServer(config, registerRoutes)

      // Notify renderer of state change
      notifyStateChange()
    } catch (error) {
      // If server is already running, treat as success and just return current state
      if (error instanceof Error && error.message.includes('already running')) {
        console.log('[Proxy Service] Server already running, returning current state')
        notifyStateChange()
        return
      }
      // Re-throw other errors
      throw error
    }
  })

  // Stop proxy service
  ipcMain.handle('proxy-service:stop', async () => {
    await stopServer()
    notifyStateChange()
  })

  // Restart proxy service
  ipcMain.handle('proxy-service:restart', async (_event, config?: { port?: number; host?: string }) => {
    // Pass route registrar to restartServer - routes must be registered BEFORE listen()
    await restartServer(config, registerRoutes)
    
    notifyStateChange()
  })

  // Get proxy service status
  ipcMain.handle('proxy-service:status', async () => {
    const state = getServerState()
    // Convert backend format to frontend format
    return {
      status: state.running ? 'running' as const : (state.error ? 'error' as const : 'stopped' as const),
      port: state.running ? state.port : null,
      host: state.running ? state.host : null,
      error: state.error || null
    }
  })

  // Get proxy metrics
  ipcMain.handle('proxy-service:metrics', async () => {
    return getMetrics()
  })
}

// Notify renderer of state change
function notifyStateChange(): void {
  const state = getServerState()
  const windows = BrowserWindow.getAllWindows()
  
  for (const window of windows) {
    window.webContents.send('proxy-service:state-changed', state)
  }
}
