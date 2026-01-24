/**
 * Migration 007: Fix Gemini adapter type
 * 
 * Changes adapter_type from 'gemini' to 'google' for Google Gemini providers
 * to match the actual adapter name in bridge-manager.ts
 */

import type { DatabaseInstance, Migration } from '../types'

export const migration007FixGeminiAdapter: Migration = {
  version: 7,
  name: 'fix_gemini_adapter',
  
  up: (db: DatabaseInstance) => {
    console.log('[Migration 007] Fixing Gemini adapter type from "gemini" to "google"')
    
    // Update all providers with adapter_type = 'gemini' to 'google'
    const stmt = db.prepare(`
      UPDATE providers 
      SET adapter_type = 'google' 
      WHERE adapter_type = 'gemini'
    `)
    
    const result = stmt.run()
    console.log(`[Migration 007] Updated ${result.changes} provider(s)`)
  },
  
  down: (db: DatabaseInstance) => {
    console.log('[Migration 007] Reverting Gemini adapter type from "google" to "gemini"')
    
    // Revert back to 'gemini' (for rollback purposes)
    const stmt = db.prepare(`
      UPDATE providers 
      SET adapter_type = 'gemini' 
      WHERE adapter_type = 'google' AND name LIKE '%Gemini%'
    `)
    
    const result = stmt.run()
    console.log(`[Migration 007] Reverted ${result.changes} provider(s)`)
  }
}
