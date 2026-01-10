/**
 * Initial database schema migration
 */

import type { Migration, DatabaseInstance } from '../types'

export const migration001Initial: Migration = {
  version: 1,
  name: 'initial',
  
  up(db: DatabaseInstance): void {
    // Providers table - LLM provider configurations
    db.exec(`
      CREATE TABLE providers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        adapter_type TEXT NOT NULL,
        api_key TEXT,
        base_url TEXT,
        models TEXT DEFAULT '[]',
        enabled INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (unixepoch() * 1000),
        updated_at INTEGER DEFAULT (unixepoch() * 1000)
      )
    `)

    // Bridge proxies table - Proxy configurations
    db.exec(`
      CREATE TABLE bridge_proxies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL DEFAULT '',
        inbound_adapter TEXT NOT NULL,
        outbound_type TEXT NOT NULL,
        outbound_id TEXT NOT NULL,
        proxy_path TEXT NOT NULL UNIQUE,
        enabled INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (unixepoch() * 1000),
        updated_at INTEGER DEFAULT (unixepoch() * 1000)
      )
    `)

    // Model mappings table - Source to target model mappings
    db.exec(`
      CREATE TABLE model_mappings (
        id TEXT PRIMARY KEY,
        proxy_id TEXT NOT NULL,
        source_model TEXT NOT NULL,
        target_model TEXT NOT NULL,
        is_default INTEGER DEFAULT 0,
        FOREIGN KEY (proxy_id) REFERENCES bridge_proxies(id) ON DELETE CASCADE,
        UNIQUE(proxy_id, source_model)
      )
    `)

    // API keys table - Unified API keys
    db.exec(`
      CREATE TABLE api_keys (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        name TEXT,
        enabled INTEGER DEFAULT 1,
        created_at INTEGER DEFAULT (unixepoch() * 1000),
        last_used_at INTEGER
      )
    `)

    // Settings table - Key-value settings store
    db.exec(`
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER DEFAULT (unixepoch() * 1000)
      )
    `)

    // Request logs table - Request logging
    db.exec(`
      CREATE TABLE request_logs (
        id TEXT PRIMARY KEY,
        proxy_id TEXT,
        proxy_path TEXT,
        source_model TEXT,
        target_model TEXT,
        status_code INTEGER,
        input_tokens INTEGER,
        output_tokens INTEGER,
        latency_ms INTEGER,
        request_body TEXT,
        response_body TEXT,
        error TEXT,
        created_at INTEGER DEFAULT (unixepoch() * 1000),
        FOREIGN KEY (proxy_id) REFERENCES bridge_proxies(id) ON DELETE SET NULL
      )
    `)

    // Chat presets table - Chat configuration presets
    db.exec(`
      CREATE TABLE chat_presets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        system_prompt TEXT,
        temperature REAL DEFAULT 0.7,
        max_tokens INTEGER,
        is_default INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (unixepoch() * 1000)
      )
    `)

    // Conversations table - Chat sessions
    db.exec(`
      CREATE TABLE conversations (
        id TEXT PRIMARY KEY,
        title TEXT,
        provider_id TEXT,
        proxy_id TEXT,
        model TEXT NOT NULL,
        system_prompt TEXT,
        created_at INTEGER DEFAULT (unixepoch() * 1000),
        updated_at INTEGER DEFAULT (unixepoch() * 1000),
        FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE SET NULL,
        FOREIGN KEY (proxy_id) REFERENCES bridge_proxies(id) ON DELETE SET NULL
      )
    `)

    // Messages table - Chat messages
    db.exec(`
      CREATE TABLE messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT,
        reasoning TEXT,
        tool_calls TEXT,
        usage TEXT,
        created_at INTEGER DEFAULT (unixepoch() * 1000),
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      )
    `)

    // Attachments table - Message attachments
    db.exec(`
      CREATE TABLE attachments (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        storage_type TEXT NOT NULL DEFAULT 'local',
        storage_path TEXT NOT NULL,
        mime_type TEXT,
        size INTEGER,
        created_at INTEGER DEFAULT (unixepoch() * 1000),
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
      )
    `)

    // Create indexes for better query performance
    db.exec(`
      CREATE INDEX idx_proxies_path ON bridge_proxies(proxy_path);
      CREATE INDEX idx_proxies_enabled ON bridge_proxies(enabled);
      CREATE INDEX idx_mappings_proxy ON model_mappings(proxy_id);
      CREATE INDEX idx_logs_created ON request_logs(created_at);
      CREATE INDEX idx_logs_proxy ON request_logs(proxy_id);
      CREATE INDEX idx_logs_status ON request_logs(status_code);
      CREATE INDEX idx_messages_conversation ON messages(conversation_id);
      CREATE INDEX idx_attachments_message ON attachments(message_id);
      CREATE INDEX idx_conversations_provider ON conversations(provider_id);
      CREATE INDEX idx_conversations_proxy ON conversations(proxy_id);
      CREATE INDEX idx_conversations_updated ON conversations(updated_at);
      CREATE INDEX idx_providers_enabled ON providers(enabled);
      CREATE INDEX idx_api_keys_key ON api_keys(key);
    `)

    // Insert default settings
    const defaultSettings = [
      { key: 'proxy.port', value: JSON.stringify(9527) },
      { key: 'proxy.host', value: JSON.stringify('127.0.0.1') },
      { key: 'proxy.autoStart', value: JSON.stringify(false) },
      { key: 'proxy.timeout', value: JSON.stringify(60000) },
      { key: 'proxy.retry.enabled', value: JSON.stringify(true) },
      { key: 'proxy.retry.maxRetries', value: JSON.stringify(3) },
      { key: 'proxy.retry.retryDelay', value: JSON.stringify(1000) },
      { key: 'proxy.retry.retryOn', value: JSON.stringify([429, 500, 502, 503, 504]) },
      { key: 'proxy.circuitBreaker.enabled', value: JSON.stringify(true) },
      { key: 'proxy.circuitBreaker.threshold', value: JSON.stringify(5) },
      { key: 'proxy.circuitBreaker.resetTimeout', value: JSON.stringify(30000) },
      { key: 'proxy.cors.enabled', value: JSON.stringify(true) },
      { key: 'proxy.cors.origins', value: JSON.stringify(['*']) },
      { key: 'proxy.sse.heartbeatInterval', value: JSON.stringify(30000) },
      { key: 'proxy.sse.connectionTimeout', value: JSON.stringify(300000) },
      { key: 'appearance.theme', value: JSON.stringify('system') },
      { key: 'appearance.language', value: JSON.stringify('zh-CN') },
      { key: 'chat.streamResponse', value: JSON.stringify(true) },
      { key: 'chat.showReasoning', value: JSON.stringify(true) },
      { key: 'logs.enabled', value: JSON.stringify(true) },
      { key: 'logs.retentionDays', value: JSON.stringify(30) },
      { key: 'logs.maxEntries', value: JSON.stringify(10000) },
      { key: 'logs.saveRequestBody', value: JSON.stringify(false) },
      { key: 'logs.saveResponseBody', value: JSON.stringify(false) },
      { key: 'logs.maxBodySize', value: JSON.stringify(10240) },
      { key: 'presets.autoUpdate', value: JSON.stringify(true) },
      { key: 'app.launchAtStartup', value: JSON.stringify(false) },
      { key: 'app.startMinimized', value: JSON.stringify(false) },
      { key: 'app.minimizeToTray', value: JSON.stringify(true) },
      { key: 'app.showTrayIcon', value: JSON.stringify(true) },
      { key: 'security.masterPassword.enabled', value: JSON.stringify(false) }
    ]

    const insertSetting = db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?)'
    )

    for (const setting of defaultSettings) {
      insertSetting.run(setting.key, setting.value)
    }
  },

  down(db: DatabaseInstance): void {
    // Drop all tables in reverse order of creation
    db.exec(`
      DROP TABLE IF EXISTS attachments;
      DROP TABLE IF EXISTS messages;
      DROP TABLE IF EXISTS conversations;
      DROP TABLE IF EXISTS chat_presets;
      DROP TABLE IF EXISTS request_logs;
      DROP TABLE IF EXISTS settings;
      DROP TABLE IF EXISTS api_keys;
      DROP TABLE IF EXISTS model_mappings;
      DROP TABLE IF EXISTS bridge_proxies;
      DROP TABLE IF EXISTS providers;
    `)
  }
}
