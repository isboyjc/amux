/**
 * Updater Store - 管理应用更新状态
 */

import { create } from 'zustand'
import { ipc } from '@/lib/ipc'

interface VersionInfo {
  currentVersion: string
  latestVersion: string
  hasUpdate: boolean
  releaseUrl: string
  releaseNotes: string
  publishedAt: string
}

interface UpdaterState {
  versionInfo: VersionInfo | null
  isChecking: boolean
  lastCheckTime: number | null
  error: string | null

  // Actions
  checkForUpdates: () => Promise<void>
  openReleasePage: () => Promise<void>
  reset: () => void
}

export const useUpdaterStore = create<UpdaterState>((set, get) => ({
  versionInfo: null,
  isChecking: false,
  lastCheckTime: null,
  error: null,

  checkForUpdates: async () => {
    const { isChecking } = get()
    
    // 防止重复检查
    if (isChecking) {
      return
    }

    set({ isChecking: true, error: null })

    try {
      const versionInfo = await ipc.invoke('updater:check')
      set({
        versionInfo,
        lastCheckTime: Date.now(),
        isChecking: false
      })
      
      console.log('[Updater] Version check completed:', versionInfo)
    } catch (error) {
      console.error('[Updater] Failed to check for updates:', error)
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        isChecking: false
      })
    }
  },

  openReleasePage: async () => {
    try {
      await ipc.invoke('updater:open-release-page')
    } catch (error) {
      console.error('[Updater] Failed to open release page:', error)
    }
  },

  reset: () => {
    set({
      versionInfo: null,
      isChecking: false,
      lastCheckTime: null,
      error: null
    })
  }
}))
