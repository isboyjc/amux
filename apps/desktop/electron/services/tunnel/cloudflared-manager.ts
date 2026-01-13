/**
 * Cloudflared Binary Management Service
 * Handles finding, downloading, and managing the cloudflared binary
 */

import { join } from 'path'
import { existsSync, chmodSync, mkdirSync } from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'
import { app } from 'electron'
import https from 'https'
import http from 'http'
import fs from 'fs'

const execAsync = promisify(exec)

export interface CloudflaredInfo {
  path: string
  version: string
  source: 'bundled' | 'downloaded' | 'system' | 'custom'
}

export class CloudflaredManager {
  private cachedPath: string | null = null
  private downloadInProgress: boolean = false

  /**
   * Find cloudflared binary
   * Search order: bundled → downloaded → system PATH → not found
   */
  async find(): Promise<CloudflaredInfo | null> {
    // 1. Check bundled version (packaged with app)
    const bundled = this.getBundledPath()
    if (bundled && existsSync(bundled)) {
      try {
        const version = await this.getVersion(bundled)
        this.cachedPath = bundled
        return { path: bundled, version, source: 'bundled' }
      } catch (error) {
        console.warn('[Cloudflared] Bundled binary exists but failed to execute:', error)
      }
    }

    // 2. Check downloaded version (in app data directory)
    const downloaded = this.getDownloadedPath()
    if (existsSync(downloaded)) {
      try {
        const version = await this.getVersion(downloaded)
        this.cachedPath = downloaded
        return { path: downloaded, version, source: 'downloaded' }
      } catch (error) {
        console.warn('[Cloudflared] Downloaded binary exists but failed to execute:', error)
      }
    }

    // 3. Check system PATH
    try {
      const systemPath = await this.findInSystemPath()
      if (systemPath) {
        const version = await this.getVersion(systemPath)
        this.cachedPath = systemPath
        return { path: systemPath, version, source: 'system' }
      }
    } catch (error) {
      // Not in system PATH
    }

    // Not found
    return null
  }

  /**
   * Get bundled cloudflared path
   */
  private getBundledPath(): string | null {
    const resourcesPath = process.resourcesPath || app.getAppPath()
    const platform = process.platform
    const fileName = platform === 'win32' ? 'cloudflared.exe' : 'cloudflared'
    
    // In development, try resources/bin
    if (!app.isPackaged) {
      const devPath = join(app.getAppPath(), 'resources', 'bin', `${platform}-${process.arch}`, fileName)
      if (existsSync(devPath)) {
        return devPath
      }
    }
    
    // In production, check resources/bin
    const prodPath = join(resourcesPath, 'bin', fileName)
    if (existsSync(prodPath)) {
      return prodPath
    }
    
    return null
  }

  /**
   * Get downloaded cloudflared path (in app data directory)
   */
  private getDownloadedPath(): string {
    const userDataPath = app.getPath('userData')
    const fileName = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared'
    return join(userDataPath, 'bin', fileName)
  }

  /**
   * Find cloudflared in system PATH
   */
  private async findInSystemPath(): Promise<string | null> {
    const command = process.platform === 'win32' ? 'where cloudflared' : 'which cloudflared'
    
    try {
      const { stdout } = await execAsync(command)
      const path = stdout.trim().split('\n')[0] // Take first result
      return path || null
    } catch {
      return null
    }
  }

  /**
   * Get cloudflared version
   */
  private async getVersion(binaryPath: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`"${binaryPath}" --version`)
      // Output format: "cloudflared version 2024.1.5 (built ...)"
      const match = stdout.match(/cloudflared version ([\d.]+)/)
      return match ? match[1] : 'unknown'
    } catch (error) {
      throw new Error(`Failed to get version: ${error}`)
    }
  }

  /**
   * Download cloudflared
   */
  async download(onProgress?: (percent: number) => void): Promise<string> {
    if (this.downloadInProgress) {
      throw new Error('Download already in progress')
    }

    this.downloadInProgress = true

    try {
      const destPath = this.getDownloadedPath()
      const destDir = join(destPath, '..')
      
      // Ensure directory exists
      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true })
      }

      // Get download URL for current platform
      const url = this.getDownloadUrl()
      if (!url) {
        throw new Error(`No download URL available for platform: ${process.platform}-${process.arch}`)
      }

      console.log('[Cloudflared] Downloading from:', url)

      // For macOS, download tar.gz and extract
      if (process.platform === 'darwin' && url.endsWith('.tgz')) {
        const tarPath = join(destDir, 'cloudflared.tgz')
        
        // Download tar.gz
        await this.downloadFile(url, tarPath, onProgress)
        
        // Extract
        console.log('[Cloudflared] Extracting archive...')
        await this.extractTarGz(tarPath, destDir)

        // The extracted file name depends on architecture
        const archName = process.arch === 'arm64' ? 'arm64' : 'amd64'
        const extractedName = `cloudflared-darwin-${archName}`
        const extractedPath = join(destDir, extractedName)
        
        if (existsSync(extractedPath)) {
          // Rename to final name
          const fs = require('fs')
          if (existsSync(destPath)) {
            fs.unlinkSync(destPath)
          }
          fs.renameSync(extractedPath, destPath)
        }
        
        // Clean up tar file
        const fs = require('fs')
        if (existsSync(tarPath)) {
          fs.unlinkSync(tarPath)
        }
      } else {
        // Direct download for Windows/Linux
        await this.downloadFile(url, destPath, onProgress)
      }

      // Make executable on Unix-like systems
      if (process.platform !== 'win32') {
        chmodSync(destPath, 0o755)
      }

      // Verify download
      const version = await this.getVersion(destPath)
      console.log('[Cloudflared] Download complete. Version:', version)

      this.cachedPath = destPath
      return destPath

    } finally {
      this.downloadInProgress = false
    }
  }

  /**
   * Extract tar.gz file
   */
  private async extractTarGz(tarPath: string, destDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const { exec } = require('child_process')
      exec(`tar -xzf "${tarPath}" -C "${destDir}"`, (error: any) => {
        if (error) {
          reject(new Error(`Failed to extract: ${error.message}`))
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * Get download URL for current platform
   * Note: Windows ARM64 uses AMD64 version (runs via emulation) as Cloudflare
   * does not provide a native ARM64 build for Windows.
   */
  private getDownloadUrl(): string | null {
    const { platform, arch } = process

    const urlMap: Record<string, string> = {
      'darwin-x64': 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz',
      'darwin-arm64': 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz',
      'win32-x64': 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe',
      // Windows ARM64 uses AMD64 version (runs via x64 emulation)
      'win32-arm64': 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe',
      'linux-x64': 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64',
      'linux-arm64': 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64',
    }

    return urlMap[`${platform}-${arch}`] || null
  }

  /**
   * Download file from URL
   */
  private downloadFile(
    url: string,
    destPath: string,
    onProgress?: (percent: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http
      const file = fs.createWriteStream(destPath)

      protocol.get(url, {
        headers: {
          'User-Agent': 'amux-desktop'
        }
      }, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          file.close()
          fs.unlinkSync(destPath)
          return this.downloadFile(response.headers.location!, destPath, onProgress)
            .then(resolve)
            .catch(reject)
        }

        if (response.statusCode !== 200) {
          file.close()
          fs.unlinkSync(destPath)
          return reject(new Error(`Failed to download: ${response.statusCode}`))
        }

        const totalSize = parseInt(response.headers['content-length'] || '0', 10)
        let downloadedSize = 0

        response.on('data', (chunk) => {
          downloadedSize += chunk.length
          if (onProgress && totalSize > 0) {
            const percent = (downloadedSize / totalSize) * 100
            onProgress(Math.round(percent))
          }
        })

        response.pipe(file)

        file.on('finish', () => {
          file.close()
          resolve()
        })
      }).on('error', (err) => {
        file.close()
        if (existsSync(destPath)) {
          fs.unlinkSync(destPath)
        }
        reject(err)
      })
    })
  }

  /**
   * Get cached path (if already found)
   */
  getCachedPath(): string | null {
    return this.cachedPath
  }

  /**
   * Clear cache (force re-search on next find())
   */
  clearCache(): void {
    this.cachedPath = null
  }
}

// Export singleton instance
export const cloudflaredManager = new CloudflaredManager()
