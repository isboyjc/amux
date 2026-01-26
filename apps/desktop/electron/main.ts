import { join } from 'path'

import { electronApp, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, shell } from 'electron'

// Database imports
import { initDatabase, closeDatabase } from './services/database'
import { runMigrations } from './services/database/migrator'
import { getProviderRepository } from './services/database/repositories/provider'
// Presets imports
import { initPresets, getProviderPresets } from './services/presets'
// Analytics imports
import { initAnalytics } from './services/analytics'

// Main window instance
let mainWindow: BrowserWindow | null = null

// Initialize default providers from presets (only if database is empty)
function initializeDefaultProviders(): void {
  const providerRepo = getProviderRepository()
  const existingProviders = providerRepo.findAll()
  
  if (existingProviders.length > 0) {
    console.log(`[Init] Found ${existingProviders.length} existing providers, skipping initialization`)
    return
  }
  
  const presets = getProviderPresets()
  
  if (presets.length === 0) {
    console.warn('[Init] No presets available, skipping provider initialization')
    return
  }
  
  console.log('[Init] Database empty, initializing default providers from presets...')
  
  for (const preset of presets) {
    providerRepo.create({
      name: preset.name,
      adapterType: preset.adapterType,
      apiKey: '',
      baseUrl: preset.baseUrl,
      chatPath: preset.chatPath || '',
      modelsPath: preset.modelsPath || '',
      models: preset.models.map(m => m.id),
      enabled: false,
      logo: preset.logo || '',
      color: preset.color || ''
    })
  }
  
  console.log(`[Init] Created ${presets.length} default providers`)
}

// Get the icon path based on platform
function getIconPath(): string | undefined {
  if (process.platform === 'linux') {
    return join(__dirname, '../../resources/icons/icon.png')
  }
  return undefined // macOS and Windows use their own icon formats
}

function createWindow(): void {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    // Traffic lights position: y=12 so button center (~18px) aligns with header content center (38px/2=19px)
    ...(process.platform === 'darwin' && {
      trafficLightPosition: { x: 14, y: 12 }
    }),
    icon: getIconPath(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    
    // Open DevTools in development
    if (!app.isPackaged) {
      mainWindow?.webContents.openDevTools()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Load the remote URL for development or the local html file for production
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Get main window instance
export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

// Show main window
export function showMainWindow(): void {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }
    mainWindow.focus()
  } else {
    createWindow()
  }
}

// Set app name to control userData directory location
// This must be called before app.whenReady()
app.name = 'Amux'

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.amux.desktop')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize crypto service (must be before database for API key encryption)
  console.log('[App] Initializing crypto service...')
  try {
    const { initCrypto } = await import('./services/crypto')
    await initCrypto()
    console.log('[App] Crypto service initialized')
  } catch (error) {
    console.error('[App] Failed to initialize crypto service:', error)
  }

  // Initialize database
  console.log('[App] Initializing database...')
  const db = initDatabase()
  
  // Run migrations
  console.log('[App] Running database migrations...')
  runMigrations(db)
  
  // Initialize presets service
  console.log('[App] Initializing presets...')
  await initPresets()
  
  // Initialize default providers if database is empty
  initializeDefaultProviders()

  // Initialize Analytics
  console.log('[App] Initializing analytics...')
  await initAnalytics()

  // Initialize OAuth Manager
  console.log('[App] Initializing OAuth manager...')
  try {
    const { getOAuthManager } = await import('./services/oauth/oauth-manager')
    const oauthManager = getOAuthManager()
    await oauthManager.initialize()
    console.log('[App] OAuth manager initialized')
  } catch (error) {
    console.error('[App] Failed to initialize OAuth manager:', error)
  }

  // Initialize logger service
  import('./services/logger').then(({ initLogger }) => {
    initLogger()
  })

  // Register IPC handlers (after database is ready)
  const { registerAllHandlers } = await import('./ipc')
  registerAllHandlers()

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Handle app before quit
app.on('before-quit', async () => {
  // Cleanup OAuth Manager
  try {
    const { getOAuthManager } = await import('./services/oauth/oauth-manager')
    const { getCallbackServer } = await import('./services/oauth/callback-server')
    const oauthManager = getOAuthManager()
    const callbackServer = getCallbackServer()
    await oauthManager.cleanup()
    await callbackServer.cleanup()
  } catch (e) {
    // Ignore errors during shutdown
  }

  // Shutdown logger (flush remaining logs)
  try {
    const { shutdownLogger } = await import('./services/logger')
    shutdownLogger()
  } catch (e) {
    // Ignore errors during shutdown
  }
  
  // Close database connection
  closeDatabase()
  console.log('[App] Cleanup completed')
})
