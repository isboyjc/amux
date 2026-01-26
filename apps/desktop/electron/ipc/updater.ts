/**
 * IPC handlers for version updates
 */

import { shell } from 'electron'
import { handle } from './index'
import { checkForUpdates, getReleasePageUrl } from '../services/updater'

export function registerUpdaterHandlers(): void {
  // 检查更新
  handle('updater:check', async () => {
    return await checkForUpdates()
  })

  // 获取发布页面 URL
  handle('updater:get-release-url', () => {
    return getReleasePageUrl()
  })

  // 打开发布页面
  handle('updater:open-release-page', async () => {
    const url = getReleasePageUrl()
    await shell.openExternal(url)
  })

  console.log('[IPC] Updater handlers registered')
}
