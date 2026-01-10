/**
 * Type-safe IPC wrapper for renderer process
 */

import type { IPCHandlers } from '@/types/ipc'

type Channel = keyof IPCHandlers

// Helper to extract return type
type InvokeResult<C extends Channel> = IPCHandlers[C] extends (...args: unknown[]) => Promise<infer R>
  ? R
  : never

// Helper to extract parameter types
type InvokeArgs<C extends Channel> = IPCHandlers[C] extends (...args: infer P) => unknown
  ? P
  : never

/**
 * Type-safe IPC invoke wrapper
 */
export const ipc = {
  invoke: async <C extends Channel>(
    channel: C,
    ...args: InvokeArgs<C>
  ): Promise<InvokeResult<C>> => {
    if (!window.api) {
      throw new Error('IPC not available. Make sure you are running in Electron.')
    }
    return window.api.invoke(channel, ...args)
  },

  on: <C extends string>(
    channel: C,
    callback: (...args: unknown[]) => void
  ): (() => void) => {
    if (!window.api) {
      console.warn('IPC not available')
      return () => {}
    }
    return window.api.on(channel, callback)
  }
}
