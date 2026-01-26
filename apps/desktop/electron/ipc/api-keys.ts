/**
 * API Key IPC handlers
 */

import { ipcMain } from 'electron'

import { trackApiKeyCreated, trackApiKeyDeleted, trackApiKeyToggled } from '../services/analytics'
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
    
    // 追踪 API Key 创建（异步，不阻塞）
    setImmediate(() => {
      try {
        trackApiKeyCreated(!!name)
      } catch (e) {
        // 静默失败
      }
    })
    
    return toApiKey(row)
  })

  // Delete API key
  ipcMain.handle('api-key:delete', async (_event, id: string) => {
    const result = repo.delete(id)
    
    // 追踪 API Key 删除（异步，不阻塞）
    if (result) {
      setImmediate(() => {
        try {
          trackApiKeyDeleted()
        } catch (e) {
          // 静默失败
        }
      })
    }
    
    return result
  })

  // Toggle API key enabled
  ipcMain.handle('api-key:toggle', async (_event, id: string, enabled: boolean) => {
    const result = repo.toggleEnabled(id, enabled)
    
    // 追踪 API Key 切换（异步，不阻塞）
    if (result) {
      setImmediate(() => {
        try {
          trackApiKeyToggled(enabled)
        } catch (e) {
          // 静默失败
        }
      })
    }
    
    return result
  })

  // Rename API key
  ipcMain.handle('api-key:rename', async (_event, id: string, name: string) => {
    const row = repo.updateName(id, name)
    return row ? toApiKey(row) : null
  })
}
