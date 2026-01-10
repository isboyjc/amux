import { contextBridge, ipcRenderer } from 'electron'

// Custom APIs for renderer
const api = {
  // Invoke IPC handler and return result
  invoke: <T>(channel: string, ...args: unknown[]): Promise<T> => {
    return ipcRenderer.invoke(channel, ...args)
  },
  
  // Send one-way message to main process
  send: (channel: string, ...args: unknown[]): void => {
    ipcRenderer.send(channel, ...args)
  },
  
  // Listen for messages from main process
  on: (channel: string, callback: (...args: unknown[]) => void): (() => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args)
    ipcRenderer.on(channel, subscription)
    return () => {
      ipcRenderer.removeListener(channel, subscription)
    }
  },
  
  // Listen for a single message from main process
  once: (channel: string, callback: (...args: unknown[]) => void): void => {
    ipcRenderer.once(channel, (_event, ...args) => callback(...args))
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}
