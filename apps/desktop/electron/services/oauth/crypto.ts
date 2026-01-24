/**
 * OAuth Token Encryption/Decryption
 * 
 * 使用Electron的safeStorage API进行Token加密
 */

import { safeStorage } from 'electron'
import crypto from 'crypto'

/**
 * 检查加密是否可用
 */
export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

/**
 * 加密Token
 */
export function encryptToken(token: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    const buffer = safeStorage.encryptString(token)
    return buffer.toString('base64')
  }
  
  // Fallback: 使用AES加密
  return fallbackEncrypt(token)
}

/**
 * 解密Token
 */
export function decryptToken(encryptedToken: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    const buffer = Buffer.from(encryptedToken, 'base64')
    return safeStorage.decryptString(buffer)
  }
  
  // Fallback: 使用AES解密
  return fallbackDecrypt(encryptedToken)
}

/**
 * Fallback加密（使用AES-256-GCM）
 */
function fallbackEncrypt(text: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const authTag = cipher.getAuthTag()
  
  // 格式: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * Fallback解密
 */
function fallbackDecrypt(encrypted: string): string {
  const key = getEncryptionKey()
  const parts = encrypted.split(':')
  
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format')
  }
  
  const iv = Buffer.from(parts[0], 'hex')
  const authTag = Buffer.from(parts[1], 'hex')
  const encryptedText = parts[2]
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

/**
 * 获取加密密钥（从环境变量或生成）
 */
function getEncryptionKey(): Buffer {
  const keyString = process.env.AMUX_ENCRYPTION_KEY || 'amux-default-encryption-key-change-me-in-production'
  return crypto.scryptSync(keyString, 'salt', 32)
}

/**
 * 生成随机state参数
 */
export function generateState(): string {
  return crypto.randomBytes(32).toString('base64url')
}

/**
 * 生成PKCE code verifier
 */
export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url')
}

/**
 * 生成PKCE code challenge
 */
export function generateCodeChallenge(verifier: string): string {
  return crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url')
}

/**
 * 解析JWT Token（不验证签名）
 */
export function parseJWT(token: string): any {
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format')
  }
  
  const payload = Buffer.from(parts[1], 'base64url').toString('utf8')
  return JSON.parse(payload)
}
