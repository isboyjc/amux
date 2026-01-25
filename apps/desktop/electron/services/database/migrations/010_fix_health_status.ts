/**
 * Migration 010: Fix health_status constraint and clean up invalid values
 * 
 * 问题：之前的代码尝试设置 health_status = 'error'，但这个值不在约束列表中
 * 解决：
 * 1. 修复任何现有的无效 health_status 值
 * 2. 添加更多有效状态到约束中，包括 'error' 和 'unhealthy'
 */

import type { Migration, DatabaseInstance } from '../types'

export const migration010FixHealthStatus: Migration = {
  version: 10,
  name: 'Fix OAuth account health_status constraint',
  
  up: (db: DatabaseInstance) => {
    // 1. 先修复任何现有的无效 health_status 值
    // 将 'error' 状态改为 'expired'
    const fixStmt = db.prepare(`
      UPDATE oauth_accounts 
      SET health_status = 'expired'
      WHERE health_status NOT IN ('active', 'rate_limited', 'expired', 'forbidden')
    `)
    const result = fixStmt.run()
    
    if (result.changes > 0) {
      console.log(`[Migration 010] Fixed ${result.changes} invalid health_status values`)
    }
    
    // 2. 重建表以添加新的约束（包含更多状态）
    // SQLite 不支持修改 CHECK 约束，需要重建表
    
    // 创建新表
    db.exec(`
      CREATE TABLE oauth_accounts_new (
        id TEXT PRIMARY KEY,
        provider_type TEXT NOT NULL CHECK(provider_type IN ('codex', 'antigravity')),
        email TEXT NOT NULL,
        
        -- OAuth Token
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        token_type TEXT DEFAULT 'Bearer',
        
        -- 账号状态
        is_active INTEGER DEFAULT 1,
        health_status TEXT DEFAULT 'active' CHECK(health_status IN ('active', 'rate_limited', 'expired', 'forbidden', 'unhealthy')),
        consecutive_failures INTEGER DEFAULT 0,
        error_message TEXT,
        
        -- Pool 相关
        pool_enabled INTEGER DEFAULT 1,
        pool_weight INTEGER DEFAULT 1,
        
        -- 时间戳
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_used_at INTEGER,
        last_refresh_at INTEGER,
        
        -- 厂商特定数据
        provider_metadata TEXT,
        quota_info TEXT,
        usage_stats TEXT,
        
        UNIQUE(provider_type, email)
      )
    `)
    
    // 复制数据（明确指定列，error_message 默认为 NULL）
    db.exec(`
      INSERT INTO oauth_accounts_new (
        id, provider_type, email,
        access_token, refresh_token, expires_at, token_type,
        is_active, health_status, consecutive_failures,
        pool_enabled, pool_weight,
        created_at, updated_at, last_used_at, last_refresh_at,
        provider_metadata, quota_info, usage_stats
      )
      SELECT 
        id, provider_type, email,
        access_token, refresh_token, expires_at, token_type,
        is_active, health_status, consecutive_failures,
        pool_enabled, pool_weight,
        created_at, updated_at, last_used_at, last_refresh_at,
        provider_metadata, quota_info, usage_stats
      FROM oauth_accounts
    `)
    
    // 删除旧表
    db.exec('DROP TABLE oauth_accounts')
    
    // 重命名新表
    db.exec('ALTER TABLE oauth_accounts_new RENAME TO oauth_accounts')
    
    // 重建索引
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_oauth_accounts_provider_email 
      ON oauth_accounts(provider_type, email)
    `)
    
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_oauth_accounts_pool_enabled 
      ON oauth_accounts(pool_enabled, is_active)
    `)
    
    console.log('[Migration 010] OAuth account health_status constraint updated')
  },
  
  down: (db: DatabaseInstance) => {
    // 回滚：恢复到旧的约束
    db.exec(`
      CREATE TABLE oauth_accounts_new (
        id TEXT PRIMARY KEY,
        provider_type TEXT NOT NULL CHECK(provider_type IN ('codex', 'antigravity')),
        email TEXT NOT NULL,
        
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        token_type TEXT DEFAULT 'Bearer',
        
        is_active INTEGER DEFAULT 1,
        health_status TEXT DEFAULT 'active' CHECK(health_status IN ('active', 'rate_limited', 'expired', 'forbidden')),
        consecutive_failures INTEGER DEFAULT 0,
        
        pool_enabled INTEGER DEFAULT 1,
        pool_weight INTEGER DEFAULT 1,
        
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_used_at INTEGER,
        last_refresh_at INTEGER,
        
        provider_metadata TEXT,
        quota_info TEXT,
        usage_stats TEXT,
        
        UNIQUE(provider_type, email)
      )
    `)
    
    db.exec(`
      INSERT INTO oauth_accounts_new (
        id, provider_type, email,
        access_token, refresh_token, expires_at, token_type,
        is_active, health_status, consecutive_failures,
        pool_enabled, pool_weight,
        created_at, updated_at, last_used_at, last_refresh_at,
        provider_metadata, quota_info, usage_stats
      )
      SELECT 
        id, provider_type, email,
        access_token, refresh_token, expires_at, token_type,
        is_active, health_status, consecutive_failures,
        pool_enabled, pool_weight,
        created_at, updated_at, last_used_at, last_refresh_at,
        provider_metadata, quota_info, usage_stats
      FROM oauth_accounts
    `)
    
    db.exec('DROP TABLE oauth_accounts')
    db.exec('ALTER TABLE oauth_accounts_new RENAME TO oauth_accounts')
    
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_oauth_accounts_provider_email 
      ON oauth_accounts(provider_type, email)
    `)
    
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_oauth_accounts_pool_enabled 
      ON oauth_accounts(pool_enabled, is_active)
    `)
    
    console.log('[Migration 010] Reverted health_status constraint')
  }
}
