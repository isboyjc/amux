/**
 * Version Check Service
 * 检查 GitHub Releases 是否有新版本
 */

import { app } from 'electron'

export interface VersionInfo {
  currentVersion: string
  latestVersion: string
  hasUpdate: boolean
  releaseUrl: string
  releaseNotes: string
  publishedAt: string
}

interface GitHubRelease {
  tag_name: string
  name: string
  body: string
  html_url: string
  published_at: string
  prerelease: boolean
  draft: boolean
}

const GITHUB_API_URL = 'https://api.github.com/repos/isboyjc/amux/releases/latest'
const RELEASE_PAGE_URL = 'https://github.com/isboyjc/amux/releases'

/**
 * 比较版本号 (semver)
 * @returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.replace(/^v/, '').split('.').map(Number)
  const parts2 = v2.replace(/^v/, '').split('.').map(Number)

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const num1 = parts1[i] || 0
    const num2 = parts2[i] || 0
    
    if (num1 > num2) return 1
    if (num1 < num2) return -1
  }
  
  return 0
}

/**
 * 获取当前应用版本
 */
export function getCurrentVersion(): string {
  return app.getVersion()
}

/**
 * 检查是否有更新
 */
export async function checkForUpdates(): Promise<VersionInfo> {
  const currentVersion = getCurrentVersion()
  
  try {
    console.log('[Updater] Checking for updates...')
    console.log('[Updater] Current version:', currentVersion)

    const response = await fetch(GITHUB_API_URL, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': `Amux Desktop/${currentVersion}`
      }
    })

    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}`)
    }

    const release: GitHubRelease = await response.json()
    
    // 跳过草稿和预发布版本
    if (release.draft || release.prerelease) {
      console.log('[Updater] Latest release is draft or prerelease, skipping')
      return {
        currentVersion,
        latestVersion: currentVersion,
        hasUpdate: false,
        releaseUrl: RELEASE_PAGE_URL,
        releaseNotes: '',
        publishedAt: ''
      }
    }

    const latestVersion = release.tag_name.replace(/^desktop-v/, '')
    console.log('[Updater] Latest version:', latestVersion)

    const hasUpdate = compareVersions(latestVersion, currentVersion) > 0

    console.log('[Updater] Has update:', hasUpdate)

    return {
      currentVersion,
      latestVersion,
      hasUpdate,
      releaseUrl: release.html_url,
      releaseNotes: release.body || '',
      publishedAt: release.published_at
    }
  } catch (error) {
    console.error('[Updater] Failed to check for updates:', error)
    throw error
  }
}

/**
 * 获取发布页面 URL
 */
export function getReleasePageUrl(): string {
  return RELEASE_PAGE_URL
}
