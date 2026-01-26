/**
 * Analytics IPC handlers
 */

import { ipcMain } from 'electron'

import { trackError } from '../services/analytics'

export function registerAnalyticsHandlers(): void {
  // Track error
  ipcMain.handle('analytics:trackError', async (_event, errorType: string, errorMessage: string) => {
    // 异步追踪，不阻塞
    setImmediate(() => {
      try {
        trackError(errorType, errorMessage)
      } catch (e) {
        // 静默失败，不影响功能
      }
    })
  })
}
