/**
 * Conversation repository for chat sessions
 */

import { randomUUID } from 'crypto'
import { getDatabase } from '../index'
import type { DatabaseInstance } from '../types'

// Conversation row from database
export interface ConversationRow {
  id: string
  title: string | null
  provider_id: string | null
  proxy_id: string | null
  model: string
  system_prompt: string | null
  created_at: number
  updated_at: number
}

// Conversation entity
export interface Conversation {
  id: string
  title: string | null
  providerId: string | null
  proxyId: string | null
  model: string
  systemPrompt: string | null
  createdAt: number
  updatedAt: number
}

// Create conversation DTO
export interface CreateConversationDTO {
  title?: string
  providerId?: string
  proxyId?: string
  model: string
  systemPrompt?: string
}

// Update conversation DTO
export interface UpdateConversationDTO {
  title?: string
  providerId?: string
  proxyId?: string
  model?: string
  systemPrompt?: string
}

/**
 * Convert database row to entity
 */
function rowToEntity(row: ConversationRow): Conversation {
  return {
    id: row.id,
    title: row.title,
    providerId: row.provider_id,
    proxyId: row.proxy_id,
    model: row.model,
    systemPrompt: row.system_prompt,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class ConversationRepository {
  private get db(): DatabaseInstance {
    return getDatabase()
  }

  /**
   * Find all conversations ordered by updated_at desc
   */
  findAll(): Conversation[] {
    const stmt = this.db.prepare(
      'SELECT * FROM conversations ORDER BY updated_at DESC'
    )
    const rows = stmt.all() as ConversationRow[]
    return rows.map(rowToEntity)
  }

  /**
   * Find conversation by ID
   */
  findById(id: string): Conversation | null {
    const stmt = this.db.prepare('SELECT * FROM conversations WHERE id = ?')
    const row = stmt.get(id) as ConversationRow | undefined
    return row ? rowToEntity(row) : null
  }

  /**
   * Create a new conversation
   */
  create(data: CreateConversationDTO): Conversation {
    const id = randomUUID()
    const now = Date.now()

    const stmt = this.db.prepare(`
      INSERT INTO conversations (id, title, provider_id, proxy_id, model, system_prompt, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      id,
      data.title || null,
      data.providerId || null,
      data.proxyId || null,
      data.model,
      data.systemPrompt || null,
      now,
      now
    )

    return this.findById(id)!
  }

  /**
   * Update a conversation
   */
  update(id: string, data: UpdateConversationDTO): Conversation | null {
    const existing = this.findById(id)
    if (!existing) return null

    const now = Date.now()
    const updates: string[] = ['updated_at = ?']
    const values: (string | number | null)[] = [now]

    if (data.title !== undefined) {
      updates.push('title = ?')
      values.push(data.title || null)
    }
    if (data.providerId !== undefined) {
      updates.push('provider_id = ?')
      values.push(data.providerId || null)
    }
    if (data.proxyId !== undefined) {
      updates.push('proxy_id = ?')
      values.push(data.proxyId || null)
    }
    if (data.model !== undefined) {
      updates.push('model = ?')
      values.push(data.model)
    }
    if (data.systemPrompt !== undefined) {
      updates.push('system_prompt = ?')
      values.push(data.systemPrompt || null)
    }

    values.push(id)

    const stmt = this.db.prepare(`
      UPDATE conversations SET ${updates.join(', ')} WHERE id = ?
    `)
    stmt.run(...values)

    return this.findById(id)
  }

  /**
   * Delete a conversation
   */
  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM conversations WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }

  /**
   * Update the updated_at timestamp
   */
  touch(id: string): void {
    const stmt = this.db.prepare(
      'UPDATE conversations SET updated_at = ? WHERE id = ?'
    )
    stmt.run(Date.now(), id)
  }

  /**
   * Count all conversations
   */
  count(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM conversations')
    const result = stmt.get() as { count: number }
    return result.count
  }
}

// Singleton instance
let instance: ConversationRepository | null = null

export function getConversationRepository(): ConversationRepository {
  if (!instance) {
    instance = new ConversationRepository()
  }
  return instance
}
