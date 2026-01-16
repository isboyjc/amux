/**
 * IPC handlers registration
 */

import { ipcMain } from 'electron'
import { registerProviderHandlers } from './providers'
import { registerProxyHandlers } from './proxies'
import { registerProxyServiceHandlers } from './proxy-service'
import { registerSettingsHandlers } from './settings'
import { registerApiKeyHandlers } from './api-keys'
import { registerLogHandlers } from './logs'
import { registerAppHandlers } from './app'
import { registerConfigHandlers } from './config'
import { registerTunnelIpcHandlers } from './tunnel'
import { registerChatHandlers } from './chat'

/**
 * Register all IPC handlers
 */
export function registerAllHandlers(): void {
  registerProviderHandlers()
  registerProxyHandlers()
  registerProxyServiceHandlers()
  registerSettingsHandlers()
  registerApiKeyHandlers()
  registerLogHandlers()
  registerAppHandlers()
  registerConfigHandlers()
  registerTunnelIpcHandlers()
  registerChatHandlers()

  console.log('[IPC] All handlers registered')
}

/**
 * Helper to create typed IPC handler
 */
export function handle<T>(
  channel: string,
  handler: (...args: unknown[]) => Promise<T> | T
): void {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return await handler(...args)
    } catch (error) {
      console.error(`[IPC] Error in ${channel}:`, error)
      throw error
    }
  })
}
