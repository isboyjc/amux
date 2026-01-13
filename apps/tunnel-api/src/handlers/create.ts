/**
 * 创建 Tunnel 处理器
 */

import type { Env, CreateTunnelRequest, CreateTunnelResponse } from '../types'
import { jsonResponse } from '../utils/response'
import { getDeviceTunnel, saveTunnel } from '../utils/database'
import { createCloudfareTunnel, configureDNS, deleteCloudfareTunnel } from '../utils/cloudflare'
import { generateRandomSubdomain } from '../utils/subdomain'
import { checkRateLimit } from '../utils/rate-limit'

export async function handleCreateTunnel(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    // 1. 解析请求
    const body = await request.json() as CreateTunnelRequest
    const { deviceId } = body

    if (!deviceId) {
      return jsonResponse({
        success: false,
        error: 'deviceId is required'
      }, 400)
    }

    // 2. 速率限制检查
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
    const rateLimitResult = await checkRateLimit(env.KV, ip, deviceId)
    if (!rateLimitResult.allowed) {
      return jsonResponse({
        success: false,
        error: 'Too many requests. Please try again later.',
        message: `Rate limit exceeded. Retry after ${rateLimitResult.retryAfter}s`
      }, 429)
    }

    // 3. 检查设备是否已有 Tunnel（每设备只能有1个）
    const existingTunnel = await getDeviceTunnel(env.DB, deviceId)
    if (existingTunnel) {
      // 返回现有的 Tunnel
      return jsonResponse<CreateTunnelResponse>({
        success: true,
        data: {
          tunnelId: existingTunnel.tunnel_id,
          subdomain: existingTunnel.subdomain,
          domain: `${existingTunnel.subdomain}.amux.ai`,
          credentials: JSON.parse(existingTunnel.credentials),
          isExisting: true
        }
      })
    }

    // 4. 生成随机子域名
    const subdomain = generateRandomSubdomain()

    // 5. 调用 Cloudflare API 创建 Tunnel
    const tunnel = await createCloudfareTunnel(
      env.CF_API_TOKEN,
      env.CF_ACCOUNT_ID,
      `amux-${subdomain}`
    )

    if (!tunnel) {
      return jsonResponse({
        success: false,
        error: 'Failed to create tunnel'
      }, 500)
    }

    // 6. 配置 DNS 记录
    const dnsSuccess = await configureDNS(
      env.CF_API_TOKEN,
      env.CF_ZONE_ID,
      subdomain,
      tunnel.id
    )

    // 如果 DNS 配置失败，回滚已创建的 Tunnel
    if (!dnsSuccess) {
      console.error('DNS configuration failed, rolling back tunnel:', tunnel.id)
      await deleteCloudfareTunnel(env.CF_API_TOKEN, env.CF_ACCOUNT_ID, tunnel.id)
      return jsonResponse({
        success: false,
        error: 'Failed to configure DNS'
      }, 500)
    }

    // 7. 保存到数据库
    await saveTunnel(env.DB, {
      tunnel_id: tunnel.id,
      device_id: deviceId,
      subdomain,
      credentials: JSON.stringify(tunnel.credentials),
      created_at: Date.now()
    })

    // 8. 返回结果
    return jsonResponse<CreateTunnelResponse>({
      success: true,
      data: {
        tunnelId: tunnel.id,
        subdomain,
        domain: `${subdomain}.amux.ai`,
        credentials: tunnel.credentials,
        isExisting: false
      }
    })

  } catch (error) {
    console.error('Error creating tunnel:', error)
    return jsonResponse({
      success: false,
      error: 'Failed to create tunnel',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
}
