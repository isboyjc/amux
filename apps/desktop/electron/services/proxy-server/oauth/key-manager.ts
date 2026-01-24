import type { Database } from 'better-sqlite3'
import { randomBytes } from 'crypto'
import { getDatabase } from '../../database'
import type { OAuthProviderType } from '../../types/oauth'

/**
 * 生成安全的随机 ID
 */
function generateId(length: number = 32): string {
  return randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length)
}

/**
 * OAuth 服务 API Key 管理器
 * 为每个 OAuth 厂商生成和验证专用 API Key
 */
export class OAuthKeyManager {
  private db: Database
  
  constructor() {
    this.db = getDatabase()
    this.initTable()
  }
  
  private initTable() {
    // 创建 OAuth 服务 Key 表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS oauth_service_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_type TEXT NOT NULL UNIQUE,
        api_key TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    // 创建索引
    this.db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_service_keys_provider 
        ON oauth_service_keys(provider_type)
    `)
    this.db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_service_keys_api_key 
        ON oauth_service_keys(api_key)
    `)
  }
  
  /**
   * 获取或创建 OAuth 服务 API Key
   */
  async getOrCreateKey(providerType: OAuthProviderType): Promise<string> {
    // 查询是否已存在
    const existing = this.db.prepare(`
      SELECT api_key FROM oauth_service_keys WHERE provider_type = ?
    `).get(providerType) as { api_key: string } | undefined
    
    if (existing) {
      return existing.api_key
    }
    
    // 生成新的 API Key (格式: sk-amux.oauth.{providerType}-{randomId})
    const apiKey = `sk-amux.oauth.${providerType}-${generateId(32)}`
    
    this.db.prepare(`
      INSERT INTO oauth_service_keys (provider_type, api_key, description)
      VALUES (?, ?, ?)
    `).run(
      providerType,
      apiKey,
      `Auto-generated API key for ${providerType} OAuth translation service`
    )
    
    return apiKey
  }
  
  /**
   * 验证 API Key 是否有效
   */
  async validateKey(apiKey: string, providerType?: OAuthProviderType): Promise<boolean> {
    if (!apiKey) return false
    
    const query = providerType
      ? `SELECT id FROM oauth_service_keys WHERE api_key = ? AND provider_type = ?`
      : `SELECT id FROM oauth_service_keys WHERE api_key = ?`
    
    const params = providerType ? [apiKey, providerType] : [apiKey]
    const result = this.db.prepare(query).get(...params)
    
    return !!result
  }
  
  /**
   * 获取 API Key 对应的 Provider Type
   */
  async getProviderType(apiKey: string): Promise<OAuthProviderType | null> {
    const result = this.db.prepare(`
      SELECT provider_type FROM oauth_service_keys WHERE api_key = ?
    `).get(apiKey) as { provider_type: OAuthProviderType } | undefined
    
    return result?.provider_type || null
  }
  
  /**
   * 轮换 API Key（安全需要）
   */
  async rotateKey(providerType: OAuthProviderType): Promise<string> {
    const newKey = `sk-amux.oauth.${providerType}-${generateId(32)}`
    
    this.db.prepare(`
      UPDATE oauth_service_keys 
      SET api_key = ?, updated_at = CURRENT_TIMESTAMP
      WHERE provider_type = ?
    `).run(newKey, providerType)
    
    return newKey
  }
  
  /**
   * 删除 API Key
   */
  async deleteKey(providerType: OAuthProviderType): Promise<void> {
    this.db.prepare(`
      DELETE FROM oauth_service_keys WHERE provider_type = ?
    `).run(providerType)
    
  }
}

// 单例
let keyManager: OAuthKeyManager | null = null

export function getOAuthKeyManager(): OAuthKeyManager {
  if (!keyManager) {
    keyManager = new OAuthKeyManager()
  }
  return keyManager
}
