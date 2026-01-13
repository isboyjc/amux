/**
 * 数据库操作工具
 */

import type { Tunnel } from '../types'

/**
 * 查询设备的 Tunnel
 */
export async function getDeviceTunnel(
  db: D1Database,
  deviceId: string
): Promise<Tunnel | null> {
  const result = await db
    .prepare('SELECT * FROM tunnels WHERE device_id = ? AND deleted_at IS NULL')
    .bind(deviceId)
    .first<Tunnel>()
  
  return result || null
}

/**
 * 根据 ID 查询 Tunnel
 */
export async function getTunnel(
  db: D1Database,
  tunnelId: string
): Promise<Tunnel | null> {
  const result = await db
    .prepare('SELECT * FROM tunnels WHERE tunnel_id = ? AND deleted_at IS NULL')
    .bind(tunnelId)
    .first<Tunnel>()
  
  return result || null
}

/**
 * 保存 Tunnel
 */
export async function saveTunnel(
  db: D1Database,
  data: {
    tunnel_id: string
    device_id: string
    subdomain: string
    credentials: string
    created_at: number
  }
): Promise<void> {
  await db
    .prepare(`
      INSERT INTO tunnels (
        id, tunnel_id, device_id, subdomain, credentials, 
        status, created_at, last_active_at
      ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
    `)
    .bind(
      crypto.randomUUID(),
      data.tunnel_id,
      data.device_id,
      data.subdomain,
      data.credentials,
      data.created_at,
      data.created_at
    )
    .run()
}

/**
 * 删除 Tunnel（软删除）
 */
export async function deleteTunnel(
  db: D1Database,
  tunnelId: string
): Promise<void> {
  await db
    .prepare('UPDATE tunnels SET deleted_at = ?, status = ? WHERE tunnel_id = ?')
    .bind(Date.now(), 'inactive', tunnelId)
    .run()
}

/**
 * 更新最后活跃时间
 */
export async function updateLastActive(
  db: D1Database,
  tunnelId: string
): Promise<void> {
  await db
    .prepare('UPDATE tunnels SET last_active_at = ? WHERE tunnel_id = ?')
    .bind(Date.now(), tunnelId)
    .run()
}
