/**
 * Message repository for chat messages
 */

import { randomUUID } from 'crypto'
import { getDatabase } from '../index'
import type { DatabaseInstance } from '../types'

// Message row from database
export interface MessageRow {
  id: string
  conversation_id: string
  role: string
  content: string | null
  reasoning: string | null
  tool_calls: string | null
  usage: string | null
  created_at: number
}

// Message entity
export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string | null
  reasoning: string | null
  toolCalls: string | null
  usage: string | null
  createdAt: number
}

// Create message DTO
export interface CreateMessageDTO {
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content?: string
  reasoning?: string
  toolCalls?: string
  usage?: string
}

// Update message DTO
export interface UpdateMessageDTO {
  content?: string
  reasoning?: string
  toolCalls?: string
  usage?: string
}

/**
 * Convert database row to entity
 */
function rowToEntity(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role as 'user' | 'assistant' | 'system',
    content: row.content,
    reasoning: row.reasoning,
    toolCalls: row.tool_calls,
    usage: row.usage,
    createdAt: row.created_at
  }
}

export class MessageRepository {
  private get db(): DatabaseInstance {
    return getDatabase()
  }

  /**
   * Find all messages for a conversation
   */
  findByConversationId(conversationId: string): Message[] {
    const stmt = this.db.prepare(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
    )
    const rows = stmt.all(conversationId) as MessageRow[]
    return rows.map(rowToEntity)
  }

  /**
   * Find message by ID
   */
  findById(id: string): Message | null {
    const stmt = this.db.prepare('SELECT * FROM messages WHERE id = ?')
    const row = stmt.get(id) as MessageRow | undefined
    return row ? rowToEntity(row) : null
  }

  /**
   * Create a new message
   */
  create(data: CreateMessageDTO): Message {
    const id = randomUUID()
    const now = Date.now()

    const stmt = this.db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, reasoning, tool_calls, usage, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      id,
      data.conversationId,
      data.role,
      data.content || null,
      data.reasoning || null,
      data.toolCalls || null,
      data.usage || null,
      now
    )

    return this.findById(id)!
  }

  /**
   * Update a message
   */
  update(id: string, data: UpdateMessageDTO): Message | null {
    const existing = this.findById(id)
    if (!existing) return null

    const updates: string[] = []
    const values: (string | null)[] = []

    if (data.content !== undefined) {
      updates.push('content = ?')
      values.push(data.content || null)
    }
    if (data.reasoning !== undefined) {
      updates.push('reasoning = ?')
      values.push(data.reasoning || null)
    }
    if (data.toolCalls !== undefined) {
      updates.push('tool_calls = ?')
      values.push(data.toolCalls || null)
    }
    if (data.usage !== undefined) {
      updates.push('usage = ?')
      values.push(data.usage || null)
    }

    if (updates.length === 0) return existing

    values.push(id)

    const stmt = this.db.prepare(`
      UPDATE messages SET ${updates.join(', ')} WHERE id = ?
    `)
    stmt.run(...values)

    return this.findById(id)
  }

  /**
   * Delete a message
   */
  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM messages WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }

  /**
   * Delete all messages for a conversation
   */
  deleteByConversationId(conversationId: string): number {
    const stmt = this.db.prepare('DELETE FROM messages WHERE conversation_id = ?')
    const result = stmt.run(conversationId)
    return result.changes
  }

  /**
   * Count messages for a conversation
   */
  countByConversationId(conversationId: string): number {
    const stmt = this.db.prepare(
      'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?'
    )
    const result = stmt.get(conversationId) as { count: number }
    return result.count
  }

  /**
   * Get the last message for a conversation
   */
  getLastMessage(conversationId: string): Message | null {
    const stmt = this.db.prepare(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1'
    )
    const row = stmt.get(conversationId) as MessageRow | undefined
    return row ? rowToEntity(row) : null
  }
}

// Singleton instance
let instance: MessageRepository | null = null

export function getMessageRepository(): MessageRepository {
  if (!instance) {
    instance = new MessageRepository()
  }
  return instance
}
