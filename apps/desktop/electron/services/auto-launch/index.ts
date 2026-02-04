/**
 * Auto-launch management
 */

import { app } from 'electron'
import { getSettingsRepository } from '../database/repositories'

/**
 * Initialize auto-launch based on settings
 */
export function initializeAutoLaunch(): void {
  const settings = getSettingsRepository()
  const autoLaunch = settings.get('app.launchAtStartup') ?? false
  
  setAutoLaunch(autoLaunch)
  
  console.log(`[AutoLaunch] Initialized, enabled: ${autoLaunch}`)
}

/**
 * Set auto-launch state
 */
export function setAutoLaunch(enabled: boolean): void {
  const appName = 'Amux Desktop'
  
  // Use Electron's built-in login item settings
  app.setLoginItemSettings({
    openAtLogin: enabled,
    name: appName,
    // On macOS, open as hidden
    openAsHidden: process.platform === 'darwin' && enabled
  })
  
  // Save to settings
  const settings = getSettingsRepository()
  settings.set('app.launchAtStartup', enabled)
  
  console.log(`[AutoLaunch] Set to: ${enabled}`)
}

/**
 * Get current auto-launch state
 */
export function getAutoLaunchState(): boolean {
  const loginSettings = app.getLoginItemSettings()
  return loginSettings.openAtLogin
}

/**
 * Check if app was opened at login
 */
export function wasOpenedAtLogin(): boolean {
  const loginSettings = app.getLoginItemSettings()
  return loginSettings.wasOpenedAtLogin
}
