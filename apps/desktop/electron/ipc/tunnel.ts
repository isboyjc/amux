/**
 * Tunnel IPC handlers
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { tunnelService, cloudflaredManager } from '../services/tunnel'
import { tunnelRepository } from '../services/database/repositories'

export function registerTunnelIpcHandlers(): void {
  // Start tunnel
  ipcMain.handle('tunnel:start', async (_event: IpcMainInvokeEvent) => {
    try {
      const config = await tunnelService.start()
      return { success: true, data: config }
    } catch (error: any) {
      console.error('[IPC] tunnel:start error:', error)
      return { success: false, error: error.message }
    }
  })

  // Stop tunnel
  ipcMain.handle('tunnel:stop', async (_event: IpcMainInvokeEvent) => {
    try {
      await tunnelService.stop()
      return { success: true }
    } catch (error: any) {
      console.error('[IPC] tunnel:stop error:', error)
      return { success: false, error: error.message }
    }
  })

  // Get tunnel status
  ipcMain.handle('tunnel:get-status', async (_event: IpcMainInvokeEvent) => {
    try {
      const status = tunnelService.getStatus()
      return { success: true, data: status }
    } catch (error: any) {
      console.error('[IPC] tunnel:get-status error:', error)
      return { success: false, error: error.message }
    }
  })

  // Check cloudflared installation
  ipcMain.handle('tunnel:check-cloudflared', async (_event: IpcMainInvokeEvent) => {
    try {
      const info = await cloudflaredManager.find()
      return { success: true, data: info }
    } catch (error: any) {
      console.error('[IPC] tunnel:check-cloudflared error:', error)
      return { success: false, error: error.message }
    }
  })

  // Download cloudflared
  ipcMain.handle('tunnel:download-cloudflared', async (_event: IpcMainInvokeEvent) => {
    try {
      const path = await cloudflaredManager.download((percent) => {
        _event.sender.send('tunnel:download-progress', percent)
      })
      return { success: true, data: { path } }
    } catch (error: any) {
      console.error('[IPC] tunnel:download-cloudflared error:', error)
      return { success: false, error: error.message }
    }
  })

  // Get stats
  ipcMain.handle('tunnel:get-stats', async (_event: IpcMainInvokeEvent, dateRange?: { start: string; end: string }) => {
    try {
      let stats
      if (dateRange) {
        stats = tunnelRepository.getStatsInRange(dateRange.start, dateRange.end)
      } else {
        // Get today's stats
        const today = new Date().toISOString().split('T')[0]
        stats = tunnelRepository.getStatsByDate(today)
      }
      return { success: true, data: stats }
    } catch (error: any) {
      console.error('[IPC] tunnel:get-stats error:', error)
      return { success: false, error: error.message }
    }
  })

  // Get access logs
  ipcMain.handle('tunnel:get-logs', async (_event: IpcMainInvokeEvent, limit?: number) => {
    try {
      const logs = tunnelRepository.getRecentAccessLogs(limit || 100)
      return { success: true, data: logs }
    } catch (error: any) {
      console.error('[IPC] tunnel:get-logs error:', error)
      return { success: false, error: error.message }
    }
  })

  // Get system logs
  ipcMain.handle('tunnel:get-system-logs', async (_event: IpcMainInvokeEvent, limit?: number) => {
    try {
      const logs = tunnelRepository.getRecentSystemLogs(limit || 100)
      return { success: true, data: logs }
    } catch (error: any) {
      console.error('[IPC] tunnel:get-system-logs error:', error)
      return { success: false, error: error.message }
    }
  })

  console.log('[IPC] Tunnel handlers registered')
}
