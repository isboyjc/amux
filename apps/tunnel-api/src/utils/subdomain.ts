/**
 * 子域名生成工具
 */

/**
 * 生成随机子域名（8位小写字母+数字）
 */
export function generateRandomSubdomain(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  
  // 使用 crypto.getRandomValues 生成更安全的随机数
  const randomValues = new Uint8Array(8)
  crypto.getRandomValues(randomValues)
  
  for (let i = 0; i < 8; i++) {
    result += chars[randomValues[i] % chars.length]
  }
  
  return result
}

/**
 * 验证子域名格式
 */
export function isValidSubdomain(subdomain: string): boolean {
  return /^[a-z0-9]{8}$/.test(subdomain)
}
