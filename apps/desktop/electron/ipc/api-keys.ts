/**
 * API Key IPC handlers
 */

import { ipcMain } from 'electron'
import { getApiKeyRepository } from '../services/database/repositories'
import type { ApiKeyRow } from '../services/database/types'

// Convert DB row to ApiKey object
function toApiKey(row: ApiKeyRow) {
  return {
    id: row.id,
    key: row.key,
    name: row.name ?? undefined,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at ?? undefined
  }
}

export function registerApiKeyHandlers(): void {
  const repo = getApiKeyRepository()

  // List all API keys
  ipcMain.handle('api-key:list', async () => {
    const rows = repo.findAll()
    return rows.map(toApiKey)
  })

  // Create new API key
  ipcMain.handle('api-key:create', async (_event, name?: string) => {
    const row = repo.create({ name })
    return toApiKey(row)
  })

  // Delete API key
  ipcMain.handle('api-key:delete', async (_event, id: string) => {
    return repo.delete(id)
  })

  // Toggle API key enabled
  ipcMain.handle('api-key:toggle', async (_event, id: string, enabled: boolean) => {
    return repo.toggleEnabled(id, enabled)
  })

  // Rename API key
  ipcMain.handle('api-key:rename', async (_event, id: string, name: string) => {
    const row = repo.updateName(id, name)
    return row ? toApiKey(row) : null
  })
}
