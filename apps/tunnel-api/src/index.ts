/**
 * Amux Tunnel API - Cloudflare Workers
 * 
 * 提供 Tunnel 管理 API，用于 Amux Desktop 客户端创建和管理 Cloudflare Tunnel
 */

import { handleCreateTunnel } from './handlers/create'
import { handleDeleteTunnel } from './handlers/delete'
import { handleGetTunnelStatus } from './handlers/status'
import { handleListTunnels } from './handlers/list'
import { corsHeaders, jsonResponse } from './utils/response'
import type { Env } from './types'

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    
    // CORS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }
    
    try {
      // 路由分发
      const path = url.pathname
      const method = request.method
      
      // 健康检查
      if (path === '/health' && method === 'GET') {
        return jsonResponse({ status: 'ok', timestamp: Date.now() })
      }
      
      // 创建 Tunnel
      if (path === '/api/tunnel/create' && method === 'POST') {
        return await handleCreateTunnel(request, env)
      }
      
      // 删除 Tunnel
      if (path.match(/^\/api\/tunnel\/[^/]+$/) && method === 'DELETE') {
        const tunnelId = path.split('/').pop()!
        return await handleDeleteTunnel(request, env, tunnelId)
      }
      
      // 查询 Tunnel 状态
      if (path.match(/^\/api\/tunnel\/[^/]+\/status$/) && method === 'GET') {
        const tunnelId = path.split('/')[3]
        return await handleGetTunnelStatus(request, env, tunnelId)
      }
      
      // 列出设备的 Tunnels
      if (path.match(/^\/api\/tunnels\/[^/]+$/) && method === 'GET') {
        const deviceId = path.split('/').pop()!
        return await handleListTunnels(request, env, deviceId)
      }
      
      // 404
      return jsonResponse({ error: 'Not Found' }, 404)
      
    } catch (error) {
      console.error('Error:', error)
      return jsonResponse({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500)
    }
  }
}
