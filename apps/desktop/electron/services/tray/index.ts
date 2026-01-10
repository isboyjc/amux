/**
 * System tray management
 */

import { app, Tray, Menu, nativeImage, BrowserWindow } from 'electron'
import path from 'path'
import { getServerState, startServer, stopServer } from '../proxy-server'
import { getSettingsRepository } from '../database/repositories'

let tray: Tray | null = null

/**
 * Initialize system tray
 */
export function initializeTray(mainWindow: BrowserWindow): void {
  // Create tray icon
  const iconPath = path.join(__dirname, '../../resources/icon.png')
  const icon = nativeImage.createFromPath(iconPath)
  
  // Resize for tray (16x16 on macOS, 16x16 or 32x32 on Windows)
  const trayIcon = icon.resize({ width: 16, height: 16 })
  
  tray = new Tray(trayIcon)
  tray.setToolTip('Amux Desktop')
  
  // Update context menu
  updateTrayMenu(mainWindow)
  
  // Handle tray click
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.focus()
    } else {
      mainWindow.show()
    }
  })
  
  // Handle double click (Windows)
  tray.on('double-click', () => {
    mainWindow.show()
    mainWindow.focus()
  })
  
  console.log('[Tray] Initialized')
}

/**
 * Update tray context menu
 */
export function updateTrayMenu(mainWindow: BrowserWindow): void {
  if (!tray) return
  
  const serverState = getServerState()
  const isRunning = serverState.status === 'running'
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Amux Desktop',
      enabled: false
    },
    { type: 'separator' },
    {
      label: isRunning ? `服务运行中 (${serverState.host}:${serverState.port})` : '服务已停止',
      enabled: false
    },
    { type: 'separator' },
    {
      label: isRunning ? '停止服务' : '启动服务',
      click: async () => {
        if (isRunning) {
          await stopServer()
        } else {
          await startServer()
        }
        updateTrayMenu(mainWindow)
      }
    },
    { type: 'separator' },
    {
      label: '显示窗口',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
      }
    },
    {
      label: '隐藏窗口',
      click: () => {
        mainWindow.hide()
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit()
      }
    }
  ])
  
  tray.setContextMenu(contextMenu)
}

/**
 * Destroy tray
 */
export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}

/**
 * Set up window close behavior
 */
export function setupWindowCloseBehavior(mainWindow: BrowserWindow): void {
  mainWindow.on('close', async (event) => {
    const settings = getSettingsRepository()
    const minimizeToTray = settings.get('app.minimizeToTray') ?? true
    
    if (minimizeToTray && !app.isQuitting) {
      event.preventDefault()
      mainWindow.hide()
      
      // Show notification on first hide
      const hasShownNotification = settings.get('app.hasShownTrayNotification')
      if (!hasShownNotification) {
        tray?.displayBalloon({
          title: 'Amux Desktop',
          content: '应用已最小化到系统托盘',
          iconType: 'info'
        })
        settings.set('app.hasShownTrayNotification', true)
      }
    }
  })
}

// Extend app with isQuitting flag
declare module 'electron' {
  interface App {
    isQuitting?: boolean
  }
}

// Set isQuitting flag before quit
app.on('before-quit', () => {
  app.isQuitting = true
})
