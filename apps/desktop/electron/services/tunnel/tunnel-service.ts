/**
 * Tunnel Service - Core tunnel management service
 */

import { spawn, ChildProcess } from 'child_process'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { deviceIdService } from './device-id'
import { cloudflaredManager } from './cloudflared-manager'
import { tunnelRepository } from '../database/repositories/tunnel'
import { getSettingsRepository } from '../database/repositories/settings'

export interface TunnelConfig {
  tunnelId: string
  subdomain: string
  domain: string
  credentials: {
    AccountTag: string
    TunnelSecret: string
    TunnelID: string
    TunnelName: string
  }
}

export interface TunnelStatus {
  isRunning: boolean
  status: 'active' | 'inactive' | 'starting' | 'stopping' | 'error'
  config?: TunnelConfig
  error?: string
  pid?: number
  uptime?: number
}

export class TunnelService {
  private process: ChildProcess | null = null
  private status: TunnelStatus['status'] = 'inactive'
  private startTime: number | null = null
  private restartAttempts = 0
  private maxRestartAttempts = 3
  
  private get settings() {
    return getSettingsRepository()
  }

  /**
   * Start tunnel
   */
  async start(): Promise<TunnelConfig> {
    if (this.process) {
      throw new Error('Tunnel already running')
    }

    this.status = 'starting'
    this.restartAttempts = 0

    try {
      // 1. Get device ID
      const deviceId = deviceIdService.getDeviceId()
      
      // 2. Find or download cloudflared
      let cloudflaredInfo = await cloudflaredManager.find()
      if (!cloudflaredInfo) {
        console.log('[Tunnel] cloudflared not found, downloading...')
        const path = await cloudflaredManager.download()
        cloudflaredInfo = await cloudflaredManager.find()
        if (!cloudflaredInfo) {
          throw new Error('Failed to download cloudflared')
        }
      }

      console.log('[Tunnel] Using cloudflared:', cloudflaredInfo)

      // 3. Check if tunnel already exists
      let config = tunnelRepository.findByDeviceId(deviceId)
      
      if (!config) {
        // Create new tunnel via API
        console.log('[Tunnel] Creating new tunnel for device:', deviceId)
        const apiBaseUrl = this.settings.get('tunnel.api.baseUrl') as string || 'https://tunnel-api.amux.ai'
        
        const response = await fetch(`${apiBaseUrl}/api/tunnel/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.message || 'Failed to create tunnel')
        }

        const result = await response.json()
        if (!result.success) {
          throw new Error(result.error || 'Failed to create tunnel')
        }

        const { tunnelId, subdomain, domain, credentials } = result.data

        // Save to database
        config = tunnelRepository.upsert({
          device_id: deviceId,
          tunnel_id: tunnelId,
          subdomain,
          domain,
          credentials: JSON.stringify(credentials),
          status: 'active'
        })

        console.log('[Tunnel] Tunnel created:', domain)
      } else {
        console.log('[Tunnel] Using existing tunnel:', config.domain)
      }

      // 4. Write credentials file
      const credentials = JSON.parse(config.credentials)
      const credentialsPath = this.getCredentialsPath(credentials.TunnelID)
      this.writeCredentialsFile(credentialsPath, credentials)

      // 5. Write config file
      const configPath = this.getConfigPath()
      this.writeConfigFile(configPath, {
        tunnelId: credentials.TunnelID,
        credentialsPath,
        domain: config.domain,
        localUrl: this.getLocalProxyUrl()
      })

      // 6. Start cloudflared process
      await this.startProcess(cloudflaredInfo.path, configPath, credentials.TunnelID)

      // 7. Update database
      tunnelRepository.recordStart(deviceId)
      this.status = 'active'
      this.startTime = Date.now()

      // 8. Add log
      tunnelRepository.addSystemLog('info', `Tunnel started: ${config.domain}`)

      return {
        tunnelId: config.tunnel_id,
        subdomain: config.subdomain,
        domain: config.domain,
        credentials
      }

    } catch (error: any) {
      this.status = 'error'
      const errorMsg = error.message || 'Unknown error'
      tunnelRepository.addSystemLog('error', `Failed to start tunnel: ${errorMsg}`)
      throw error
    }
  }

  /**
   * Stop tunnel
   */
  async stop(): Promise<void> {
    if (!this.process) {
      return
    }

    this.status = 'stopping'

    try {
      // Send SIGTERM for graceful shutdown
      this.process.kill('SIGTERM')

      // Wait for process to exit
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          // Force kill if not exited after 5 seconds
          if (this.process) {
            this.process.kill('SIGKILL')
          }
          resolve()
        }, 5000)

        this.process?.once('exit', () => {
          clearTimeout(timeout)
          resolve()
        })
      })

      this.process = null
      this.status = 'inactive'
      this.startTime = null

      // Update database
      const deviceId = deviceIdService.getDeviceId()
      tunnelRepository.recordStop(deviceId)
      tunnelRepository.addSystemLog('info', 'Tunnel stopped')

      console.log('[Tunnel] Stopped')

    } catch (error: any) {
      this.status = 'error'
      tunnelRepository.addSystemLog('error', `Failed to stop tunnel: ${error.message}`)
      throw error
    }
  }

  /**
   * Restart tunnel (internal use, preserves restart attempts counter)
   */
  private async restartTunnel(): Promise<void> {
    try {
      // 1. Get device ID
      const deviceId = deviceIdService.getDeviceId()

      // 2. Find cloudflared
      const cloudflaredInfo = await cloudflaredManager.find()
      if (!cloudflaredInfo) {
        throw new Error('cloudflared not found')
      }

      // 3. Get existing config
      const config = tunnelRepository.findByDeviceId(deviceId)
      if (!config) {
        throw new Error('No tunnel config found')
      }

      // 4. Write credentials and config files
      const credentials = JSON.parse(config.credentials)
      const credentialsPath = this.getCredentialsPath(credentials.TunnelID)
      this.writeCredentialsFile(credentialsPath, credentials)

      const configPath = this.getConfigPath()
      this.writeConfigFile(configPath, {
        tunnelId: credentials.TunnelID,
        credentialsPath,
        domain: config.domain,
        localUrl: this.getLocalProxyUrl()
      })

      // 5. Start cloudflared process
      await this.startProcess(cloudflaredInfo.path, configPath, credentials.TunnelID)

      this.status = 'active'
      this.startTime = Date.now()

      tunnelRepository.addSystemLog('info', `Tunnel restarted: ${config.domain}`)
      console.log('[Tunnel] Restarted successfully')

    } catch (error: any) {
      this.status = 'error'
      tunnelRepository.addSystemLog('error', `Failed to restart tunnel: ${error.message}`)
      throw error
    }
  }

  /**
   * Get tunnel status
   */
  getStatus(): TunnelStatus {
    const deviceId = deviceIdService.getDeviceId()
    const config = tunnelRepository.findByDeviceId(deviceId)

    return {
      isRunning: this.process !== null && this.status === 'active',
      status: this.status,
      config: config ? {
        tunnelId: config.tunnel_id,
        subdomain: config.subdomain,
        domain: config.domain,
        credentials: JSON.parse(config.credentials)
      } : undefined,
      pid: this.process?.pid,
      uptime: this.startTime ? Date.now() - this.startTime : undefined
    }
  }

  /**
   * Start cloudflared process
   */
  private startProcess(binaryPath: string, configPath: string, tunnelId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('[Tunnel] Starting cloudflared process...')

      // --config is a TUNNEL COMMAND OPTION, must come after 'tunnel' but before 'run'
      const args = ['tunnel', '--config', configPath, 'run', tunnelId]
      console.log('[Tunnel] Command:', binaryPath, args)

      this.process = spawn(binaryPath, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      })

      let hasStarted = false

      // Helper to check output for successful connection
      const checkOutput = (output: string) => {
        // Check for successful connection (cloudflared outputs to stderr)
        if (!hasStarted && output.includes('Registered tunnel connection')) {
          hasStarted = true
          resolve()
        }
      }

      // Handle stdout
      this.process.stdout?.on('data', (data) => {
        const output = data.toString()
        console.log('[Cloudflared]', output)
        checkOutput(output)
      })

      // Handle stderr - cloudflared outputs all logs (including INFO) to stderr
      this.process.stderr?.on('data', (data) => {
        const output = data.toString()

        // Determine log level from output
        if (output.includes(' ERR ')) {
          console.error('[Cloudflared]', output)
          tunnelRepository.addSystemLog('error', output)
        } else if (output.includes(' WRN ')) {
          console.warn('[Cloudflared]', output)
          tunnelRepository.addSystemLog('warn', output)
        } else {
          console.log('[Cloudflared]', output)
        }

        checkOutput(output)
      })

      // Handle process exit
      this.process.on('exit', (code, signal) => {
        console.log(`[Tunnel] Process exited with code ${code}, signal ${signal}`)

        if (!hasStarted) {
          reject(new Error(`Process exited before starting (code: ${code})`))
        }

        // Clear process reference immediately
        this.process = null

        // Auto-restart on unexpected exit
        if (this.status === 'active' && this.restartAttempts < this.maxRestartAttempts) {
          this.restartAttempts++
          console.log(`[Tunnel] Auto-restarting (attempt ${this.restartAttempts}/${this.maxRestartAttempts})...`)

          setTimeout(() => {
            this.restartTunnel().catch(console.error)
          }, 5000)
        } else {
          this.status = 'inactive'
          this.startTime = null
        }
      })

      // Handle errors
      this.process.on('error', (error) => {
        console.error('[Tunnel] Process error:', error)
        if (!hasStarted) {
          reject(error)
        }
      })

      // Timeout if not started within 30 seconds
      setTimeout(() => {
        if (!hasStarted) {
          this.process?.kill()
          reject(new Error('Tunnel start timeout'))
        }
      }, 30000)
    })
  }

  /**
   * Get credentials file path
   */
  private getCredentialsPath(tunnelId: string): string {
    const dir = join(app.getPath('userData'), '.cloudflared')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    return join(dir, `${tunnelId}.json`)
  }

  /**
   * Get config file path
   */
  private getConfigPath(): string {
    const dir = join(app.getPath('userData'), '.cloudflared')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    return join(dir, 'config.yml')
  }

  /**
   * Write credentials file
   */
  private writeCredentialsFile(path: string, credentials: any): void {
    writeFileSync(path, JSON.stringify(credentials, null, 2))
  }

  /**
   * Write config file
   */
  private writeConfigFile(path: string, config: { tunnelId: string; credentialsPath: string; domain: string; localUrl: string }): void {
    const yaml = `
tunnel: ${config.tunnelId}
credentials-file: ${config.credentialsPath}

ingress:
  - hostname: ${config.domain}
    service: ${config.localUrl}
  - service: http_status:404
`.trim()

    writeFileSync(path, yaml)
  }

  /**
   * Get local proxy URL
   */
  private getLocalProxyUrl(): string {
    const host = this.settings.get('proxy.host') as string || '127.0.0.1'
    const port = this.settings.get('proxy.port') as number || 9527
    return `http://${host}:${port}`
  }
}

// Export singleton instance
export const tunnelService = new TunnelService()
