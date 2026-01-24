import type { DatabaseInstance, Migration } from '../types'

export const migration008FixGeminiStreamEndpoint: Migration = {
  version: 8,
  name: 'fix_gemini_stream_endpoint',
  up: (db: DatabaseInstance) => {
    console.log('[Migration 008] Fixing Gemini chat_path to use streaming endpoint')
    
    // Update Google/Gemini provider to use streamGenerateContent
    const result = db.prepare(`
      UPDATE providers
      SET chat_path = '/v1beta/models/{model}:streamGenerateContent'
      WHERE adapter_type = 'google'
        AND chat_path = '/v1beta/models/{model}:generateContent'
    `).run()
    
    console.log(`[Migration 008] Updated ${result.changes} provider(s)`)
  },
  
  down: (db: DatabaseInstance) => {
    console.log('[Migration 008] Reverting Gemini chat_path to non-streaming endpoint')
    
    const result = db.prepare(`
      UPDATE providers
      SET chat_path = '/v1beta/models/{model}:generateContent'
      WHERE adapter_type = 'google'
        AND chat_path = '/v1beta/models/{model}:streamGenerateContent'
    `).run()
    
    console.log(`[Migration 008] Reverted ${result.changes} provider(s)`)
  },
}
