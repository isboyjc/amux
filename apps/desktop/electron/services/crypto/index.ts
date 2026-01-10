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
  
  if (existsSync(keyPath)) {
    // Load existing master key
    try {
      const encryptedKey = readFileSync(keyPath)
      
      if (safeStorage.isEncryptionAvailable()) {
        // Decrypt using safeStorage
        masterKey = safeStorage.decryptString(encryptedKey)
          ? Buffer.from(safeStorage.decryptString(encryptedKey), 'base64')
          : encryptedKey
      } else {
        // Fallback: use the key directly (less secure)
        masterKey = encryptedKey
      }
      
      isUnlocked = true
      console.log('[Crypto] Master key loaded')
    } catch (error) {
      console.error('[Crypto] Failed to load master key:', error)
      throw new Error('Failed to initialize encryption')
    }
  } else {
    // Generate new master key
    masterKey = generateMasterKey()
    
    // Ensure directory exists
    const dir = app.getPath('userData')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    
    try {
      if (safeStorage.isEncryptionAvailable()) {
        // Encrypt using safeStorage
        const encryptedKey = safeStorage.encryptString(masterKey.toString('base64'))
        writeFileSync(keyPath, encryptedKey)
      } else {
        // Fallback: store directly (less secure)
        writeFileSync(keyPath, masterKey)
      }
      
      isUnlocked = true
      console.log('[Crypto] New master key generated and saved')
    } catch (error) {
      console.error('[Crypto] Failed to save master key:', error)
      throw new Error('Failed to initialize encryption')
    }
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
 * Encrypt a plaintext string using AES-256-GCM
 * @param plaintext The string to encrypt
 * @returns Base64-encoded encrypted string (iv + ciphertext + authTag)
 */
export function encrypt(plaintext: string): string {
  if (!masterKey) {
    throw new Error('Crypto service not initialized')
  }
  
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
    result |= hash[i] ^ computedHash[i]
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
