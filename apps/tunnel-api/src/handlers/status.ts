/**
 * 查询 Tunnel 状态处理器
 */

import type { Env } from '../types'
import { jsonResponse } from '../utils/response'
import { getTunnel } from '../utils/database'

export async function handleGetTunnelStatus(
  request: Request,
  env: Env,
  tunnelId: string
): Promise<Response> {
  try {
    // 查询 Tunnel
    const tunnel = await getTunnel(env.DB, tunnelId)
    if (!tunnel) {
      return jsonResponse({
        success: false,
        error: 'Tunnel not found'
      }, 404)
    }
    
    return jsonResponse({
      success: true,
      data: {
        tunnelId: tunnel.tunnel_id,
        deviceId: tunnel.device_id,
        subdomain: tunnel.subdomain,
        domain: `${tunnel.subdomain}.amux.ai`,
        status: tunnel.status,
        createdAt: new Date(tunnel.created_at).toISOString(),
        lastActiveAt: tunnel.last_active_at 
          ? new Date(tunnel.last_active_at).toISOString() 
          : null
      }
    })
    
  } catch (error) {
    console.error('Error getting tunnel status:', error)
    return jsonResponse({
      success: false,
      error: 'Failed to get tunnel status',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
}
