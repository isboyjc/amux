/**
 * 速率限制工具
 */

interface RateLimitResult {
  allowed: boolean
  retryAfter?: number
}

/**
 * 检查速率限制
 * - 每个 IP: 60 次请求/小时
 * - 每个设备: 10 次创建/小时
 */
export async function checkRateLimit(
  kv: KVNamespace,
  ip: string,
  deviceId: string
): Promise<RateLimitResult> {
  const hour = Math.floor(Date.now() / 3600000) // 当前小时
  
  // 检查 IP 限制
  const ipKey = `rate:ip:${ip}:${hour}`
  const ipCount = parseInt(await kv.get(ipKey) || '0')
  
  if (ipCount >= 60) {
    const retryAfter = 3600 - (Math.floor(Date.now() / 1000) % 3600)
    return { allowed: false, retryAfter }
  }
  
  // 检查设备限制
  const deviceKey = `rate:device:${deviceId}:${hour}`
  const deviceCount = parseInt(await kv.get(deviceKey) || '0')
  
  if (deviceCount >= 10) {
    const retryAfter = 3600 - (Math.floor(Date.now() / 1000) % 3600)
    return { allowed: false, retryAfter }
  }
  
  // 更新计数器
  await Promise.all([
    kv.put(ipKey, (ipCount + 1).toString(), { expirationTtl: 3600 }),
    kv.put(deviceKey, (deviceCount + 1).toString(), { expirationTtl: 3600 })
  ])
  
  return { allowed: true }
}
