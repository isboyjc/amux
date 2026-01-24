/**
 * Migration 009: OAuth Accounts and Pool Provider Support
 * 
 * 1. Create oauth_accounts table for OAuth 2.0 account management
 * 2. Extend providers table with pool-related fields
 */

import type { Migration, DatabaseInstance } from '../types'

export const migration009: Migration = {
  version: 9,
  name: 'oauth_accounts',

  up: (db: DatabaseInstance) => {
    // 1. Create oauth_accounts table
    db.exec(`
      CREATE TABLE IF NOT EXISTS oauth_accounts (
        -- ========== 公用字段（所有 provider 共享） ==========
        -- 基础信息
        id TEXT PRIMARY KEY,
        provider_type TEXT NOT NULL CHECK(provider_type IN ('codex', 'antigravity')),
        email TEXT NOT NULL,
        
        -- OAuth Token（公用）
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        token_type TEXT DEFAULT 'Bearer',
        
        -- 账号状态（公用）
        is_active INTEGER DEFAULT 1,
        health_status TEXT DEFAULT 'active' CHECK(health_status IN ('active', 'rate_limited', 'expired', 'forbidden')),
        consecutive_failures INTEGER DEFAULT 0,
        
        -- Pool 相关（公用）
        pool_enabled INTEGER DEFAULT 1,
        pool_weight INTEGER DEFAULT 1,
        
        -- 时间戳（公用）
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_used_at INTEGER,
        last_refresh_at INTEGER,
        
        -- ========== 厂商特定数据（JSON 字段） ==========
        provider_metadata TEXT,  -- JSON: 厂商特定元数据
        quota_info TEXT,          -- JSON: 配额信息（结构不同）
        usage_stats TEXT,         -- JSON: 使用统计（结构不同）
        
        -- 约束
        UNIQUE(provider_type, email)
      );
    `)

    // 2. Create indexes for oauth_accounts
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_oauth_accounts_provider_type 
        ON oauth_accounts(provider_type);
      
      CREATE INDEX IF NOT EXISTS idx_oauth_accounts_health_status 
        ON oauth_accounts(health_status);
      
      CREATE INDEX IF NOT EXISTS idx_oauth_accounts_pool_enabled 
        ON oauth_accounts(pool_enabled);
      
      CREATE INDEX IF NOT EXISTS idx_oauth_accounts_email 
        ON oauth_accounts(email);
      
      CREATE INDEX IF NOT EXISTS idx_oauth_accounts_last_used_at 
        ON oauth_accounts(last_used_at);
    `)

    // 3. Extend providers table with pool-related fields
    db.exec(`
      -- 是否为账号池 Provider
      ALTER TABLE providers ADD COLUMN is_pool INTEGER DEFAULT 0;
      
      -- 池策略：'round_robin' | 'least_used' | 'quota_aware'
      ALTER TABLE providers ADD COLUMN pool_strategy TEXT;
      
      -- 独立 Provider 绑定的账号ID
      ALTER TABLE providers ADD COLUMN oauth_account_id TEXT;
      
      -- OAuth provider 类型（用于 Pool Provider）
      ALTER TABLE providers ADD COLUMN oauth_provider_type TEXT;
    `)

    // 4. Create index for oauth_account_id
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_providers_oauth_account_id 
        ON providers(oauth_account_id);
      
      CREATE INDEX IF NOT EXISTS idx_providers_is_pool 
        ON providers(is_pool);
    `)

    console.log('[Migration 009] OAuth accounts and pool provider support created')
  },

  down: (db: DatabaseInstance) => {
    // Drop indexes first
    db.exec(`
      DROP INDEX IF EXISTS idx_oauth_accounts_provider_type;
      DROP INDEX IF EXISTS idx_oauth_accounts_health_status;
      DROP INDEX IF EXISTS idx_oauth_accounts_pool_enabled;
      DROP INDEX IF EXISTS idx_oauth_accounts_email;
      DROP INDEX IF EXISTS idx_oauth_accounts_last_used_at;
      DROP INDEX IF EXISTS idx_providers_oauth_account_id;
      DROP INDEX IF EXISTS idx_providers_is_pool;
    `)

    // Drop table
    db.exec(`DROP TABLE IF EXISTS oauth_accounts;`)

    // Remove added columns from providers table
    // Note: SQLite doesn't support DROP COLUMN easily, 
    // but since this is a rollback, we can leave them
    
    console.log('[Migration 009] OAuth accounts rolled back')
  }
}
