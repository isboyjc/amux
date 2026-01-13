-- Amux Tunnel Database Schema
-- Cloudflare D1 Database

-- Tunnels 表：存储所有 tunnel 信息
CREATE TABLE IF NOT EXISTS tunnels (
  id TEXT PRIMARY KEY,
  tunnel_id TEXT UNIQUE NOT NULL,
  device_id TEXT UNIQUE NOT NULL,   -- 每个设备只能有一个 tunnel
  subdomain TEXT UNIQUE NOT NULL,    -- 子域名（如：h3k9n2x5）
  credentials TEXT NOT NULL,         -- JSON 格式的 tunnel credentials
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
  created_at INTEGER NOT NULL,
  last_active_at INTEGER,
  deleted_at INTEGER
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_status ON tunnels(status);
CREATE INDEX IF NOT EXISTS idx_created_at ON tunnels(created_at);

-- 查询示例
-- 1. 查找设备的 tunnel
-- SELECT * FROM tunnels WHERE device_id = ? AND deleted_at IS NULL;

-- 2. 查找所有活跃的 tunnels
-- SELECT * FROM tunnels WHERE status = 'active' AND deleted_at IS NULL;

-- 3. 清理超过 30 天未活跃的 tunnels
-- UPDATE tunnels SET status = 'inactive' 
-- WHERE last_active_at < ? AND status = 'active';
