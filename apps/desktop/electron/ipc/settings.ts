/**
 * Settings IPC handlers
 */

import { ipcMain, BrowserWindow } from 'electron'

import { trackSettingChanged } from '../services/analytics'
import { getSettingsRepository, type SettingsSchema } from '../services/database/repositories'

export function registerSettingsHandlers(): void {
  const repo = getSettingsRepository()

  // Get setting value
  ipcMain.handle('settings:get', async (_event, key: keyof SettingsSchema) => {
    return repo.get(key)
  })

  // Set setting value
  ipcMain.handle('settings:set', async (_event, key: keyof SettingsSchema, value: unknown) => {
    repo.set(key, value as SettingsSchema[typeof key])
    
    // Notify renderer of change
    const windows = BrowserWindow.getAllWindows()
    for (const window of windows) {
      window.webContents.send('settings:changed', key, value)
    }

    // 追踪设置变更（异步，不阻塞）
    // 排除 analytics 相关设置，避免循环追踪
    if (!key.startsWith('analytics.')) {
      setImmediate(() => {
        try {
          trackSettingChanged(key, value)
        } catch (e) {
          // 静默失败，不影响功能
        }
      })
    }
  })

  // Get all settings
  ipcMain.handle('settings:getAll', async () => {
    return repo.getAll()
  })

  // Set multiple settings
  ipcMain.handle('settings:setMany', async (_event, settings: Partial<SettingsSchema>) => {
    repo.setMany(settings)
    
    // Notify renderer of changes
    const windows = BrowserWindow.getAllWindows()
    for (const [key, value] of Object.entries(settings)) {
      for (const window of windows) {
        window.webContents.send('settings:changed', key, value)
      }
    }
  })
}
