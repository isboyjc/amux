/**
 * 列出设备 Tunnels 处理器
 */

import type { Env } from '../types'
import { getDeviceTunnel } from '../utils/database'
import { jsonResponse } from '../utils/response'

export async function handleListTunnels(
  request: Request,
  env: Env,
  deviceId: string
): Promise<Response> {
  try {
    // 查询设备的 Tunnel（每设备只有1个）
    const tunnel = await getDeviceTunnel(env.DB, deviceId)
    
    if (!tunnel) {
      return jsonResponse({
        success: true,
        data: {
          tunnels: []
        }
      })
    }
    
    return jsonResponse({
      success: true,
      data: {
        tunnels: [{
          tunnelId: tunnel.tunnel_id,
          subdomain: tunnel.subdomain,
          domain: `${tunnel.subdomain}.amux.ai`,
          status: tunnel.status,
          createdAt: new Date(tunnel.created_at).toISOString(),
          lastActiveAt: tunnel.last_active_at 
            ? new Date(tunnel.last_active_at).toISOString() 
            : null
        }]
      }
    })
    
  } catch (error) {
    console.error('Error listing tunnels:', error)
    return jsonResponse({
      success: false,
      error: 'Failed to list tunnels',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
}
