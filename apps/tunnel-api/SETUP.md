# Cloudflare 配置指南

## 配置检查清单

将以下信息填入 `wrangler.toml`：

### 1. Account ID
```bash
# 获取方式
wrangler whoami
```
填入位置：`wrangler.toml` → `CF_ACCOUNT_ID`

### 2. Zone ID (amux.ai)
```bash
# 获取方式
wrangler zones list
```
填入位置：`wrangler.toml` → `CF_ZONE_ID`

### 3. KV 命名空间
```bash
# 创建生产环境 KV
wrangler kv:namespace create "KV"

# 创建预览环境 KV
wrangler kv:namespace create "KV" --preview
```
填入位置：
- `wrangler.toml` → `kv_namespaces.id` (生产环境)
- `wrangler.toml` → `kv_namespaces.preview_id` (预览环境)

### 4. D1 数据库
```bash
# 创建数据库
wrangler d1 create amux_tunnels

# 初始化表结构
wrangler d1 execute amux_tunnels --file=./schema.sql --remote
```
填入位置：`wrangler.toml` → `d1_databases.database_id`

### 5. API Token
```bash
# 设置 Secret（不在配置文件中）
wrangler secret put CF_API_TOKEN
```

## 配置模板

将以下内容更新到 `wrangler.toml`：

```toml
[vars]
CF_ZONE_ID = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
CF_ACCOUNT_ID = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

[[kv_namespaces]]
binding = "KV"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
preview_id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

[[d1_databases]]
binding = "DB"
database_name = "amux_tunnels"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

## 测试验证

```bash
# 1. 本地测试
pnpm dev

# 2. 测试健康检查
curl http://localhost:8787/health

# 3. 测试创建 tunnel
curl -X POST http://localhost:8787/api/tunnel/create \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"test-123"}'

# 4. 部署
pnpm deploy
```
