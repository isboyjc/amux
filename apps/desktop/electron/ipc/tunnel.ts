/**
 * Tunnel IPC handlers
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron'

import { trackTunnelStarted, trackTunnelStopped } from '../services/analytics'
import { tunnelRepository } from '../services/database/repositories'
import { tunnelService, cloudflaredManager } from '../services/tunnel'

// 追踪 tunnel 启动时间
let tunnelStartTime: number | null = null

export function registerTunnelIpcHandlers(): void {
  // Start tunnel
  ipcMain.handle('tunnel:start', async (_event: IpcMainInvokeEvent) => {
    try {
      const config = await tunnelService.start()
      
      // 记录启动时间
      tunnelStartTime = Date.now()
      
      // 追踪 Tunnel 启动（异步，不阻塞）
      setImmediate(() => {
        try {
          // 从 config 中提取可用信息
          const providerId = (config as any).providerId || undefined
          const externalUrl = (config as any).url || (config as any).externalUrl || undefined
          trackTunnelStarted(providerId, externalUrl)
        } catch (e) {
          // 静默失败
        }
      })
      
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
      
      // 追踪 Tunnel 停止（异步，不阻塞）
      setImmediate(() => {
        try {
          const duration = tunnelStartTime ? Date.now() - tunnelStartTime : undefined
          trackTunnelStopped(duration)
          tunnelStartTime = null
        } catch (e) {
          // 静默失败
        }
      })
      
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
        const today = new Date().toISOString().split('T')[0] ?? ''
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
      const logs = tunnelRepository.getRecentAccessLogs(limit ?? 100)
      return { success: true, data: logs }
    } catch (error: any) {
      console.error('[IPC] tunnel:get-logs error:', error)
      return { success: false, error: error.message }
    }
  })

  // Get system logs
  ipcMain.handle('tunnel:get-system-logs', async (_event: IpcMainInvokeEvent, limit?: number) => {
    try {
      const logs = tunnelRepository.getRecentSystemLogs(limit ?? 100)
      return { success: true, data: logs }
    } catch (error: any) {
      console.error('[IPC] tunnel:get-system-logs error:', error)
      return { success: false, error: error.message }
    }
  })

  console.log('[IPC] Tunnel handlers registered')
}
