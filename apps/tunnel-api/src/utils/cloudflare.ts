/**
 * Cloudflare API 工具
 */

import type { TunnelCredentials, CloudflareTunnelResponse } from '../types'

/**
 * 创建 Cloudflare Tunnel
 */
export async function createCloudfareTunnel(
  apiToken: string,
  accountId: string,
  tunnelName: string
): Promise<{ id: string; credentials: TunnelCredentials } | null> {
  try {
    // 生成 Tunnel Secret
    const tunnelSecret = generateTunnelSecret()
    
    // 调用 Cloudflare API
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/cfd_tunnel`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: tunnelName,
          tunnel_secret: tunnelSecret
        })
      }
    )
    
    const data = await response.json() as CloudflareTunnelResponse
    
    if (!data.success || !data.result) {
      console.error('Failed to create tunnel:', data.errors)
      return null
    }
    
    // 返回 Tunnel 信息和凭证
    return {
      id: data.result.id,
      credentials: {
        AccountTag: accountId,
        TunnelSecret: tunnelSecret,
        TunnelID: data.result.id,
        TunnelName: tunnelName
      }
    }
  } catch (error) {
    console.error('Error creating Cloudflare tunnel:', error)
    return null
  }
}

/**
 * 删除 Cloudflare Tunnel
 */
export async function deleteCloudfareTunnel(
  apiToken: string,
  accountId: string,
  tunnelId: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/cfd_tunnel/${tunnelId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      }
    )
    
    const data = await response.json() as CloudflareTunnelResponse
    return data.success
  } catch (error) {
    console.error('Error deleting Cloudflare tunnel:', error)
    return false
  }
}

/**
 * 配置 DNS 记录
 */
export async function configureDNS(
  apiToken: string,
  zoneId: string,
  subdomain: string,
  tunnelId: string
): Promise<boolean> {
  try {
    // 创建 CNAME 记录指向 tunnel
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'CNAME',
          name: subdomain,
          content: `${tunnelId}.cfargotunnel.com`,
          ttl: 1,  // 自动
          proxied: true
        })
      }
    )
    
    const data = await response.json() as any
    return data.success
  } catch (error) {
    console.error('Error configuring DNS:', error)
    return false
  }
}

/**
 * 删除 DNS 记录
 */
export async function deleteDNS(
  apiToken: string,
  zoneId: string,
  subdomain: string
): Promise<boolean> {
  try {
    // 1. 查找 DNS 记录
    const listResponse = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?name=${subdomain}.amux.ai`,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      }
    )
    
    const listData = await listResponse.json() as any
    if (!listData.success || !listData.result || listData.result.length === 0) {
      return false
    }
    
    const recordId = listData.result[0].id
    
    // 2. 删除 DNS 记录
    const deleteResponse = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      }
    )
    
    const deleteData = await deleteResponse.json() as any
    return deleteData.success
  } catch (error) {
    console.error('Error deleting DNS:', error)
    return false
  }
}

/**
 * 生成 Tunnel Secret（Base64 编码的 32 字节随机数）
 */
function generateTunnelSecret(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}
