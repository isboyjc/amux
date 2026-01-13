/**
 * 删除 Tunnel 处理器
 */

import type { Env } from '../types'
import { jsonResponse } from '../utils/response'
import { getTunnel, deleteTunnel } from '../utils/database'
import { deleteCloudfareTunnel, deleteDNS } from '../utils/cloudflare'

export async function handleDeleteTunnel(
  request: Request,
  env: Env,
  tunnelId: string
): Promise<Response> {
  try {
    // 1. 解析请求
    const body = await request.json() as { deviceId: string }
    const { deviceId } = body
    
    if (!deviceId) {
      return jsonResponse({ 
        success: false,
        error: 'deviceId is required' 
      }, 400)
    }
    
    // 2. 查询 Tunnel
    const tunnel = await getTunnel(env.DB, tunnelId)
    if (!tunnel) {
      return jsonResponse({
        success: false,
        error: 'Tunnel not found'
      }, 404)
    }
    
    // 3. 验证设备 ID
    if (tunnel.device_id !== deviceId) {
      return jsonResponse({
        success: false,
        error: 'Unauthorized. Device ID mismatch.'
      }, 403)
    }
    
    // 4. 删除 Cloudflare Tunnel
    await deleteCloudfareTunnel(
      env.CF_API_TOKEN,
      env.CF_ACCOUNT_ID,
      tunnelId
    )
    
    // 5. 删除 DNS 记录
    await deleteDNS(
      env.CF_API_TOKEN,
      env.CF_ZONE_ID,
      tunnel.subdomain
    )
    
    // 6. 从数据库删除（软删除）
    await deleteTunnel(env.DB, tunnelId)
    
    return jsonResponse({
      success: true,
      message: 'Tunnel deleted successfully'
    })
    
  } catch (error) {
    console.error('Error deleting tunnel:', error)
    return jsonResponse({
      success: false,
      error: 'Failed to delete tunnel',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
}
