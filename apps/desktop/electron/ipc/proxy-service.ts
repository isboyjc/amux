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
import { getMetrics as getDetailedMetrics } from '../services/metrics'

export function registerProxyServiceHandlers(): void {
  // Start proxy service
  ipcMain.handle('proxy-service:start', async (_event, config?: { port?: number; host?: string }) => {
    // Pass route registrar to startServer - routes must be registered BEFORE listen()
    await startServer(config, registerRoutes)
    
    // Notify renderer of state change
    notifyStateChange()
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
    return getServerState()
  })

  // Get proxy metrics
  ipcMain.handle('proxy-service:metrics', async () => {
    return getDetailedMetrics()
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
