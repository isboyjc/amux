/**
 * Settings state management
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ipc } from '@/lib/ipc'
import type { SettingsSchema } from '@/types'

type Theme = 'light' | 'dark'

interface SettingsState {
  settings: Partial<SettingsSchema>
  loading: boolean
  theme: Theme
}

interface SettingsActions {
  fetch: () => Promise<void>
  get: <K extends keyof SettingsSchema>(key: K) => Promise<SettingsSchema[K] | undefined>
  set: <K extends keyof SettingsSchema>(key: K, value: SettingsSchema[K]) => Promise<void>
  setMany: (settings: Partial<SettingsSchema>) => Promise<void>
  setTheme: (theme: Theme) => void
}

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set, get) => ({
      settings: {},
      loading: false,
      theme: 'dark',

      fetch: async () => {
        set({ loading: true })
        try {
          const settings = await ipc.invoke('settings:getAll')
          set({ settings, loading: false })
        } catch (error) {
          console.error('Failed to fetch settings:', error)
          set({ loading: false })
        }
      },

      get: async (key) => {
        const cached = get().settings[key]
        if (cached !== undefined) {
          return cached as SettingsSchema[typeof key]
        }
        return ipc.invoke('settings:get', key)
      },

      set: async (key, value) => {
        await ipc.invoke('settings:set', key, value)
        set({
          settings: { ...get().settings, [key]: value }
        })
      },

      setMany: async (settings) => {
        await ipc.invoke('settings:setMany', settings)
        set({
          settings: { ...get().settings, ...settings }
        })
      },

      setTheme: (theme) => {
        set({ theme })
      }
    }),
    {
      name: 'amux-settings',
      partialize: (state) => ({ theme: state.theme }),
    }
  )
)
