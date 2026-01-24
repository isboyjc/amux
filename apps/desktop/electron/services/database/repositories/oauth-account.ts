/**
 * OAuth Account Repository
 */

import { BaseRepository } from './base'
import type { OAuthAccountRow } from '../types'

export class OAuthAccountRepository extends BaseRepository<OAuthAccountRow> {
  protected tableName = 'oauth_accounts'

  /**
   * Create a new OAuth account
   */
  create(account: Omit<OAuthAccountRow, 'id' | 'created_at' | 'updated_at'>): OAuthAccountRow {
    const id = this.generateId()
    const now = this.now()

    const stmt = this.db.prepare(`
      INSERT INTO ${this.tableName} (
        id, provider_type, email,
        access_token, refresh_token, expires_at, token_type,
        is_active, health_status, consecutive_failures,
        pool_enabled, pool_weight,
        last_used_at, last_refresh_at,
        provider_metadata, quota_info, usage_stats,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `)

    stmt.run(
      id, account.provider_type, account.email,
      account.access_token, account.refresh_token, account.expires_at, account.token_type,
      account.is_active, account.health_status, account.consecutive_failures,
      account.pool_enabled, account.pool_weight,
      account.last_used_at, account.last_refresh_at,
      account.provider_metadata, account.quota_info, account.usage_stats,
      now, now
    )

    return this.findById(id)!
  }

  /**
   * Update OAuth account
   */
  update(id: string, updates: Partial<Omit<OAuthAccountRow, 'id' | 'created_at'>>): OAuthAccountRow {
    const existing = this.findById(id)
    if (!existing) {
      throw new Error(`OAuth account ${id} not found`)
    }

    const now = this.now()
    const updated = { ...existing, ...updates, updated_at: now }

    const stmt = this.db.prepare(`
      UPDATE ${this.tableName} SET
        provider_type = ?, email = ?,
        access_token = ?, refresh_token = ?, expires_at = ?, token_type = ?,
        is_active = ?, health_status = ?, consecutive_failures = ?,
        pool_enabled = ?, pool_weight = ?,
        last_used_at = ?, last_refresh_at = ?,
        provider_metadata = ?, quota_info = ?, usage_stats = ?,
        updated_at = ?
      WHERE id = ?
    `)

    stmt.run(
      updated.provider_type, updated.email,
      updated.access_token, updated.refresh_token, updated.expires_at, updated.token_type,
      updated.is_active, updated.health_status, updated.consecutive_failures,
      updated.pool_enabled, updated.pool_weight,
      updated.last_used_at, updated.last_refresh_at,
      updated.provider_metadata, updated.quota_info, updated.usage_stats,
      updated.updated_at,
      id
    )

    return this.findById(id)!
  }

  /**
   * Find accounts by provider type
   */
  findByProviderType(providerType: string): OAuthAccountRow[] {
    const stmt = this.db.prepare(`
      SELECT * FROM ${this.tableName}
      WHERE provider_type = ?
      ORDER BY created_at DESC
    `)
    return stmt.all(providerType) as OAuthAccountRow[]
  }

  /**
   * Find account by email and provider type
   */
  findByEmail(email: string, providerType: string): OAuthAccountRow | null {
    const stmt = this.db.prepare(`
      SELECT * FROM ${this.tableName}
      WHERE email = ? AND provider_type = ?
      LIMIT 1
    `)
    const result = stmt.get(email, providerType) as OAuthAccountRow | undefined
    return result ?? null
  }

  /**
   * Find all accounts in pool (enabled and active)
   */
  findPoolAccounts(providerType: string): OAuthAccountRow[] {
    const stmt = this.db.prepare(`
      SELECT * FROM ${this.tableName}
      WHERE provider_type = ?
        AND pool_enabled = 1
        AND is_active = 1
        AND health_status NOT IN ('expired', 'forbidden')
      ORDER BY pool_weight DESC, last_used_at ASC
    `)
    return stmt.all(providerType) as OAuthAccountRow[]
  }

  /**
   * Update last used timestamp
   */
  updateLastUsed(id: string): void {
    const stmt = this.db.prepare(`
      UPDATE ${this.tableName}
      SET last_used_at = ?, updated_at = ?
      WHERE id = ?
    `)
    const now = this.now()
    stmt.run(now, now, id)
  }

  /**
   * Increment consecutive failures
   */
  incrementFailures(id: string): void {
    const stmt = this.db.prepare(`
      UPDATE ${this.tableName}
      SET consecutive_failures = consecutive_failures + 1,
          updated_at = ?
      WHERE id = ?
    `)
    stmt.run(this.now(), id)
  }

  /**
   * Reset consecutive failures
   */
  resetFailures(id: string): void {
    const stmt = this.db.prepare(`
      UPDATE ${this.tableName}
      SET consecutive_failures = 0,
          health_status = 'active',
          updated_at = ?
      WHERE id = ?
    `)
    stmt.run(this.now(), id)
  }

  /**
   * Update health status
   */
  updateHealthStatus(id: string, status: string): void {
    const stmt = this.db.prepare(`
      UPDATE ${this.tableName}
      SET health_status = ?, updated_at = ?
      WHERE id = ?
    `)
    stmt.run(status, this.now(), id)
  }

  /**
   * Override findAll to sort by created_at
   */
  findAll(): OAuthAccountRow[] {
    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} ORDER BY created_at DESC`)
    return stmt.all() as OAuthAccountRow[]
  }
}

// Export singleton instance
let instance: OAuthAccountRepository | null = null

export function getOAuthAccountRepository(): OAuthAccountRepository {
  if (!instance) {
    instance = new OAuthAccountRepository()
  }
  return instance
}
