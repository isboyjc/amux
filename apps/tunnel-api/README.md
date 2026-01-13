# Amux Tunnel API

Cloudflare Workers API service for managing Amux Tunnel instances.

## Overview

This service provides a lightweight API for Amux Desktop clients to create and manage Cloudflare Tunnels without requiring users to have their own Cloudflare accounts.

## Features

- ✅ Create Cloudflare Tunnels (1 per device)
- ✅ Automatic DNS configuration
- ✅ Device-based tunnel management
- ✅ Rate limiting and abuse prevention
- ✅ Zero cost (Cloudflare Workers Free Tier)

## API Endpoints

### 1. Create Tunnel

```http
POST /api/tunnel/create
Content-Type: application/json

{
  "deviceId": "device-uuid-1234"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tunnelId": "abc-123-def-456",
    "subdomain": "h3k9n2x5",
    "domain": "h3k9n2x5.amux.ai",
    "credentials": {
      "AccountTag": "...",
      "TunnelSecret": "...",
      "TunnelID": "...",
      "TunnelName": "..."
    },
    "isExisting": false
  }
}
```

### 2. Delete Tunnel

```http
DELETE /api/tunnel/:tunnelId
Content-Type: application/json

{
  "deviceId": "device-uuid-1234"
}
```

### 3. Get Tunnel Status

```http
GET /api/tunnel/:tunnelId/status
```

### 4. List Device Tunnels

```http
GET /api/tunnels/:deviceId
```

## Development

### Prerequisites

- Node.js 18+
- Cloudflare account
- Wrangler CLI

### Setup

1. Install dependencies:
```bash
pnpm install
```

2. Configure `wrangler.toml`:
   - Update `CF_ZONE_ID` and `CF_ACCOUNT_ID`
   - Create KV namespace and D1 database
   - Update namespace/database IDs

3. Set secrets:
```bash
wrangler secret put CF_API_TOKEN
```

4. Create D1 database:
```bash
wrangler d1 create amux_tunnels
wrangler d1 execute amux_tunnels --file=./schema.sql
```

### Local Development

```bash
pnpm dev
```

### Deploy

```bash
# Development
wrangler deploy --env development

# Production
wrangler deploy --env production
```

## Database Schema

```sql
CREATE TABLE tunnels (
  id TEXT PRIMARY KEY,
  tunnel_id TEXT UNIQUE NOT NULL,
  device_id TEXT UNIQUE NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  credentials TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at INTEGER NOT NULL,
  last_active_at INTEGER,
  deleted_at INTEGER
);

CREATE INDEX idx_status ON tunnels(status);
CREATE INDEX idx_created_at ON tunnels(created_at);
```

## Security

- ✅ Rate limiting (60 req/hour per IP, 10 req/hour per device)
- ✅ Device-based access control
- ✅ API token secured in Workers secrets
- ✅ CORS enabled for Amux Desktop clients

## Cost

- **Cloudflare Workers**: Free (100k requests/day)
- **KV Storage**: Free (100k reads, 1k writes per day)
- **D1 Database**: Free (5M reads, 100k writes per day)

## License

MIT
