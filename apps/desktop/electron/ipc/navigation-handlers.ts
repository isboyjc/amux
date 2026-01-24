/**
 * Navigation IPC Handlers
 * 
 * Electron IPC handlers for page navigation
 */

import { BrowserWindow } from 'electron'

/**
 * 发送导航事件到渲染进程
 */
export function sendNavigationEvent(route: string, state?: any): void {
  const mainWindow = BrowserWindow.getAllWindows()[0]
  
  if (!mainWindow) {
    console.error('[Navigation] Main window not found')
    return
  }
  
  // 发送事件到渲染进程
  mainWindow.webContents.send('navigate-to', route, state)
  console.log(`[Navigation] Sent navigate-to event: ${route}`, state)
}

/**
 * 注册Navigation相关的IPC handlers
 */
export function registerNavigationHandlers(): void {
  console.log('[IPC] Navigation handlers registered')
}
