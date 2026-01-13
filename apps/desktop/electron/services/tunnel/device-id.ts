/**
 * Device ID Management Service
 * Generates and persists a unique device identifier for tunnel creation
 */

import { randomUUID } from 'crypto'
import { getSettingsRepository } from '../database/repositories/settings'

const DEVICE_ID_KEY = 'tunnel.deviceId'

export class DeviceIdService {
  private deviceId: string | null = null
  private get settings() {
    return getSettingsRepository()
  }

  /**
   * Get or generate device ID
   */
  getDeviceId(): string {
    if (this.deviceId) {
      return this.deviceId
    }

    // Try to load from database
    const saved = this.settings.get(DEVICE_ID_KEY)
    if (saved) {
      this.deviceId = saved as string
      return this.deviceId
    }

    // Generate new device ID
    this.deviceId = randomUUID()
    this.settings.set(DEVICE_ID_KEY, this.deviceId)
    
    console.log('[DeviceId] Generated new device ID:', this.deviceId)
    return this.deviceId
  }

  /**
   * Reset device ID (for testing or reset purposes)
   */
  resetDeviceId(): string {
    this.deviceId = randomUUID()
    this.settings.set(DEVICE_ID_KEY, this.deviceId)
    console.log('[DeviceId] Reset device ID:', this.deviceId)
    return this.deviceId
  }
}

// Export singleton instance
export const deviceIdService = new DeviceIdService()
