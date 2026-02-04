/**
 * Crypto service - API Key encryption using AES-256-GCM
 * Uses Electron safeStorage for secure master key storage
 */

import { app, safeStorage } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from 'crypto'

// Encryption constants
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const SALT_LENGTH = 16
const KEY_LENGTH = 32
const PBKDF2_ITERATIONS = 100000

// Master key file name
const MASTER_KEY_FILE = 'master.key'

// Singleton state
let masterKey: Buffer | null = null
let isUnlocked = false

/**
 * Get the path to the master key file
 */
function getMasterKeyPath(): string {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, MASTER_KEY_FILE)
}

/**
 * Generate a random master key
 */
function generateMasterKey(): Buffer {
  return randomBytes(KEY_LENGTH)
}

/**
 * Initialize the crypto service
 * This should be called during app startup
 */
export async function initCrypto(): Promise<void> {
  const keyPath = getMasterKeyPath()
  
  // Check if safeStorage is available
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('[Crypto] safeStorage not available, using fallback')
  }
  
  // Helper to generate and save new master key
  const generateAndSaveKey = (): void => {
    masterKey = generateMasterKey()
    
    // Ensure directory exists
    const dir = app.getPath('userData')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    
    // Save as plain base64 with a marker prefix for format detection
    // Format: "AMUX_KEY_V1:" + base64(key)
    const keyData = 'AMUX_KEY_V1:' + masterKey.toString('base64')
    writeFileSync(keyPath, keyData, 'utf8')
    isUnlocked = true
    console.log(`[Crypto] New master key generated and saved, fingerprint: ${masterKey.toString('base64').slice(0, 8)}...`)
  }

  // Helper to check if string is valid base64
  const isValidBase64 = (str: string): boolean => {
    return /^[A-Za-z0-9+/]+=*$/.test(str) && str.length > 0
  }

  if (existsSync(keyPath)) {
    // Load existing master key
    try {
      const keyContent = readFileSync(keyPath, 'utf8')
      
      // Check for new format marker
      if (keyContent.startsWith('AMUX_KEY_V1:')) {
        const base64Key = keyContent.slice('AMUX_KEY_V1:'.length)
        masterKey = Buffer.from(base64Key, 'base64')
        if (masterKey.length === KEY_LENGTH) {
          isUnlocked = true
          console.log(`[Crypto] Master key loaded successfully (v1 format), fingerprint: ${masterKey.toString('base64').slice(0, 8)}...`)
        } else {
          throw new Error('Invalid key length')
        }
      } else if (isValidBase64(keyContent.trim()) && keyContent.length < 100) {
        // Try legacy base64 format (without marker)
        masterKey = Buffer.from(keyContent.trim(), 'base64')
        if (masterKey.length === KEY_LENGTH) {
          isUnlocked = true
          console.log('[Crypto] Master key loaded (legacy base64 format)')
          // Upgrade to new format
          const keyData = 'AMUX_KEY_V1:' + masterKey.toString('base64')
          writeFileSync(keyPath, keyData, 'utf8')
          console.log('[Crypto] Upgraded to v1 format')
        } else {
          throw new Error('Invalid key length')
        }
      } else {
        // Old safeStorage format or corrupted, regenerate
        console.warn('[Crypto] Old format detected, regenerating master key...')
        generateAndSaveKey()
      }
    } catch (error) {
      console.error('[Crypto] Failed to load master key:', error)
      console.log('[Crypto] Regenerating master key...')
      generateAndSaveKey()
    }
  } else {
    // Generate new master key
    generateAndSaveKey()
  }
}

/**
 * Check if crypto service is available
 */
export function isCryptoAvailable(): boolean {
  return masterKey !== null && isUnlocked
}

/**
 * Check if safeStorage is available
 */
export function isSafeStorageAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

/**
 * Get master key fingerprint for debugging (first 8 chars of base64)
 */
function getMasterKeyFingerprint(): string {
  if (!masterKey) return 'null'
  return masterKey.toString('base64').slice(0, 8) + '...'
}

/**
 * Encrypt a plaintext string using AES-256-GCM
 * @param plaintext The string to encrypt
 * @returns Base64-encoded encrypted string (iv + ciphertext + authTag)
 */
export function encrypt(plaintext: string): string {
  if (!masterKey) {
    throw new Error('Crypto service not initialized')
  }
  
  console.log(`[Crypto] encrypt() using key: ${getMasterKeyFingerprint()}`)
  
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, masterKey, iv)
  
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ])
  
  const authTag = cipher.getAuthTag()
  
  // Combine: iv + encrypted + authTag
  const combined = Buffer.concat([iv, encrypted, authTag])
  
  return combined.toString('base64')
}

/**
 * Decrypt a base64-encoded encrypted string
 * @param ciphertext Base64-encoded encrypted string
 * @returns Decrypted plaintext string
 */
export function decrypt(ciphertext: string): string {
  if (!masterKey) {
    throw new Error('Crypto service not initialized')
  }
  
  console.log(`[Crypto] decrypt() using key: ${getMasterKeyFingerprint()}, data length: ${ciphertext.length}`)
  
  const combined = Buffer.from(ciphertext, 'base64')
  
  // Extract components
  const iv = combined.subarray(0, IV_LENGTH)
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH)
  const encrypted = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH)
  
  const decipher = createDecipheriv(ALGORITHM, masterKey, iv)
  decipher.setAuthTag(authTag)
  
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ])
  
  return decrypted.toString('utf8')
}

/**
 * Encrypt with a user-provided password (for export/import)
 */
export function encryptWithPassword(plaintext: string, password: string): string {
  const salt = randomBytes(SALT_LENGTH)
  const key = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256')
  
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ])
  
  const authTag = cipher.getAuthTag()
  
  // Combine: salt + iv + encrypted + authTag
  const combined = Buffer.concat([salt, iv, encrypted, authTag])
  
  return combined.toString('base64')
}

/**
 * Decrypt with a user-provided password
 */
export function decryptWithPassword(ciphertext: string, password: string): string {
  const combined = Buffer.from(ciphertext, 'base64')
  
  // Extract components
  const salt = combined.subarray(0, SALT_LENGTH)
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH)
  const encrypted = combined.subarray(
    SALT_LENGTH + IV_LENGTH,
    combined.length - AUTH_TAG_LENGTH
  )
  
  const key = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256')
  
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ])
  
  return decrypted.toString('utf8')
}

/**
 * Hash a password for storage (master password feature)
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH)
  const hash = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256')
  
  // Store salt + hash
  return Buffer.concat([salt, hash]).toString('base64')
}

/**
 * Verify a password against a stored hash
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const combined = Buffer.from(storedHash, 'base64')
  const salt = combined.subarray(0, SALT_LENGTH)
  const hash = combined.subarray(SALT_LENGTH)
  
  const computedHash = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256')
  
  // Constant-time comparison
  if (hash.length !== computedHash.length) {
    return false
  }
  
  let result = 0
  for (let i = 0; i < hash.length; i++) {
    result |= (hash[i] || 0) ^ (computedHash[i] || 0)
  }
  
  return result === 0
}

/**
 * Encrypt API key for storage
 */
export function encryptApiKey(apiKey: string): string {
  if (!apiKey) return ''
  return encrypt(apiKey)
}

/**
 * Decrypt API key from storage
 */
export function decryptApiKey(encryptedKey: string): string {
  if (!encryptedKey) return ''
  try {
    return decrypt(encryptedKey)
  } catch (error) {
    console.error('[Crypto] Failed to decrypt API key:', error)
    return ''
  }
}
