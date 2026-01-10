/**
 * App IPC handlers
 */

import { ipcMain, app, shell } from 'electron'
import { getProviderPresets, refreshPresets } from '../services/presets'

export function registerAppHandlers(): void {
  // Get app version
  ipcMain.handle('app:get-version', async () => {
    return app.getVersion()
  })

  // Get platform
  ipcMain.handle('app:get-platform', async () => {
    return process.platform
  })

  // Open external URL
  ipcMain.handle('app:open-external', async (_event, url: string) => {
    await shell.openExternal(url)
  })

  // Show item in folder
  ipcMain.handle('app:show-item-in-folder', async (_event, path: string) => {
    shell.showItemInFolder(path)
  })

  // Get app path
  ipcMain.handle('app:get-path', async (_event, name: 'userData' | 'logs' | 'temp') => {
    return app.getPath(name)
  })

  // Get provider presets
  ipcMain.handle('presets:get-providers', async () => {
    return getProviderPresets()
  })

  // Refresh presets
  ipcMain.handle('presets:refresh', async () => {
    await refreshPresets()
  })
}
