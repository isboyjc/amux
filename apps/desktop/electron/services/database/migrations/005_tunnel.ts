/**
 * Tunnel feature database schema migration
 */

import type { Migration, DatabaseInstance } from '../types'

export const migration005Tunnel: Migration = {
  version: 5,
  name: 'tunnel',
  
  up(db: DatabaseInstance): void {
    // Tunnel configurations table
    db.exec(`
      CREATE TABLE tunnel_config (
        id TEXT PRIMARY KEY,
        device_id TEXT UNIQUE NOT NULL,
        tunnel_id TEXT UNIQUE NOT NULL,
        subdomain TEXT NOT NULL,
        domain TEXT NOT NULL,
        credentials TEXT NOT NULL,
        status TEXT DEFAULT 'inactive',
        created_at INTEGER DEFAULT (unixepoch() * 1000),
        updated_at INTEGER DEFAULT (unixepoch() * 1000),
        last_started_at INTEGER,
        last_stopped_at INTEGER
      )
    `)

    // Tunnel statistics table - Daily aggregated stats
    db.exec(`
      CREATE TABLE tunnel_stats (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        requests INTEGER DEFAULT 0,
        traffic_up INTEGER DEFAULT 0,
        traffic_down INTEGER DEFAULT 0,
        errors INTEGER DEFAULT 0,
        avg_latency_ms INTEGER DEFAULT 0,
        unique_ips INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (unixepoch() * 1000),
        UNIQUE(date)
      )
    `)

    // Tunnel access logs table
    db.exec(`
      CREATE TABLE tunnel_access_logs (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        client_ip TEXT,
        user_agent TEXT,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        status_code INTEGER,
        latency_ms INTEGER,
        api_key_used TEXT,
        auth_success INTEGER DEFAULT 1,
        error TEXT,
        created_at INTEGER DEFAULT (unixepoch() * 1000)
      )
    `)

    // Tunnel system logs table
    db.exec(`
      CREATE TABLE tunnel_logs (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        details TEXT,
        created_at INTEGER DEFAULT (unixepoch() * 1000)
      )
    `)

    // Create indexes for performance
    db.exec(`
      CREATE INDEX idx_tunnel_config_device ON tunnel_config(device_id);
      CREATE INDEX idx_tunnel_config_status ON tunnel_config(status);
      CREATE INDEX idx_tunnel_stats_date ON tunnel_stats(date);
      CREATE INDEX idx_tunnel_access_timestamp ON tunnel_access_logs(timestamp);
      CREATE INDEX idx_tunnel_access_ip ON tunnel_access_logs(client_ip);
      CREATE INDEX idx_tunnel_access_status ON tunnel_access_logs(status_code);
      CREATE INDEX idx_tunnel_logs_level ON tunnel_logs(level);
      CREATE INDEX idx_tunnel_logs_timestamp ON tunnel_logs(timestamp);
    `)

    // Insert default tunnel settings
    const defaultTunnelSettings = [
      { key: 'tunnel.autoStart', value: JSON.stringify(false) },
      { key: 'tunnel.requireApiKey', value: JSON.stringify(true) },
      { key: 'tunnel.rateLimit.enabled', value: JSON.stringify(true) },
      { key: 'tunnel.rateLimit.requestsPerMinute', value: JSON.stringify(60) },
      { key: 'tunnel.logs.retentionDays', value: JSON.stringify(7) },
      { key: 'tunnel.logs.maxEntries', value: JSON.stringify(10000) },
      { key: 'tunnel.stats.retentionDays', value: JSON.stringify(30) },
      { key: 'tunnel.health.checkInterval', value: JSON.stringify(30000) },
      { key: 'tunnel.health.maxRetries', value: JSON.stringify(3) },
      { key: 'tunnel.api.baseUrl', value: JSON.stringify('https://tunnel-api.amux.ai') },
    ]

    const insertSetting = db.prepare(
      'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
    )

    for (const setting of defaultTunnelSettings) {
      insertSetting.run(setting.key, setting.value)
    }
  },

  down(db: DatabaseInstance): void {
    // Remove tunnel settings
    db.exec(`
      DELETE FROM settings WHERE key LIKE 'tunnel.%';
    `)

    // Drop all tunnel tables
    db.exec(`
      DROP TABLE IF EXISTS tunnel_logs;
      DROP TABLE IF EXISTS tunnel_access_logs;
      DROP TABLE IF EXISTS tunnel_stats;
      DROP TABLE IF EXISTS tunnel_config;
    `)
  }
}
