/**
 * App IPC handlers
 */

import { ipcMain, app, shell } from 'electron'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { getProviderPresets, refreshPresets } from '../services/presets'

// Adapter presets cache
let cachedAdapters: Array<{
  id: string
  name: string
  description: string
  provider: string
}> | null = null

/**
 * Get the path to adapter presets JSON file
 */
function getAdaptersFilePath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'presets', 'adapters.json')
  }
  // __dirname is out/main/ipc/, so go up to out/main/ then to apps/desktop/
  return join(__dirname, '../../../resources/presets/adapters.json')
}

/**
 * Load adapter presets from JSON file
 */
function getAdapterPresets(): Array<{
  id: string
  name: string
  description: string
  provider: string
}> {
  if (cachedAdapters) {
    return cachedAdapters
  }

  const adaptersPath = getAdaptersFilePath()
  
  console.log('[Presets] Loading adapter presets from:', adaptersPath)
  console.log('[Presets] File exists:', existsSync(adaptersPath))
  console.log('[Presets] __dirname:', __dirname)

  try {
    if (existsSync(adaptersPath)) {
      const content = readFileSync(adaptersPath, 'utf-8')
      const data = JSON.parse(content) as {
        version: string
        updatedAt: string
        adapters: Array<{
          id: string
          name: string
          description: string
          provider: string
        }>
      }
      cachedAdapters = data.adapters
      console.log(`[Presets] Loaded ${cachedAdapters.length} adapter presets from ${adaptersPath}`)
      return cachedAdapters
    } else {
      console.error('[Presets] Adapter presets file not found at:', adaptersPath)
    }
  } catch (error) {
    console.error('[Presets] Failed to load adapter presets:', error)
  }

  console.warn('[Presets] No adapters file found, returning empty array')
  return []
}

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

  // Get adapter presets
  ipcMain.handle('presets:get-adapters', async () => {
    return getAdapterPresets()
  })

  // Refresh presets
  ipcMain.handle('presets:refresh', async () => {
    await refreshPresets()
    // Clear adapters cache to force reload
    cachedAdapters = null
  })
}
