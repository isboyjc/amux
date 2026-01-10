/**
 * Config import/export IPC handlers
 */

import { ipcMain } from 'electron'
import { exportConfig, importConfig } from '../services/config'
import type { ExportOptions, ConflictStrategy } from '../../src/types/ipc'

export function registerConfigHandlers(): void {
  // Export configuration
  ipcMain.handle('config:export', async (_event, options: ExportOptions) => {
    return exportConfig(options)
  })

  // Import configuration
  ipcMain.handle('config:import', async (_event, filePath: string, strategy: ConflictStrategy) => {
    return importConfig(filePath, strategy)
  })
}
