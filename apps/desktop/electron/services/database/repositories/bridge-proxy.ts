/**
 * Bridge proxy repository - CRUD operations for proxies with circular dependency detection
 */

import { BaseRepository } from './base'
import type { BridgeProxyRow } from '../types'

export interface CreateProxyDTO {
  name?: string
  inboundAdapter: string
  outboundType: 'provider' | 'proxy'
  outboundId: string
  proxyPath: string
  enabled?: boolean
}

export interface UpdateProxyDTO {
  name?: string
  inboundAdapter?: string
  outboundType?: 'provider' | 'proxy'
  outboundId?: string
  proxyPath?: string
  enabled?: boolean
  sortOrder?: number
}

export class BridgeProxyRepository extends BaseRepository<BridgeProxyRow> {
  protected tableName = 'bridge_proxies'

  /**
   * Find all enabled proxies
   */
  findAllEnabled(): BridgeProxyRow[] {
    const stmt = this.db.prepare(
      'SELECT * FROM bridge_proxies WHERE enabled = 1 ORDER BY sort_order ASC, created_at DESC'
    )
    return stmt.all() as BridgeProxyRow[]
  }

  /**
   * Find proxy by path
   */
  findByPath(proxyPath: string): BridgeProxyRow | null {
    const stmt = this.db.prepare('SELECT * FROM bridge_proxies WHERE proxy_path = ?')
    const result = stmt.get(proxyPath) as BridgeProxyRow | undefined
    return result ?? null
  }

  /**
   * Check if path is unique (optionally excluding a specific proxy)
   */
  isPathUnique(proxyPath: string, excludeId?: string): boolean {
    const stmt = excludeId
      ? this.db.prepare('SELECT 1 FROM bridge_proxies WHERE proxy_path = ? AND id != ? LIMIT 1')
      : this.db.prepare('SELECT 1 FROM bridge_proxies WHERE proxy_path = ? LIMIT 1')
    
    const result = excludeId ? stmt.get(proxyPath, excludeId) : stmt.get(proxyPath)
    return result === undefined
  }

  /**
   * Generate a unique proxy path based on inbound and outbound
   */
  generateUniquePath(inboundAdapter: string, outboundName: string): string {
    const basePath = `${inboundAdapter}-${outboundName}`.toLowerCase()
    
    if (this.isPathUnique(basePath)) {
      return basePath
    }
    
    // Find next available suffix
    let suffix = 2
    while (!this.isPathUnique(`${basePath}-${suffix}`)) {
      suffix++
    }
    
    return `${basePath}-${suffix}`
  }

  /**
   * Check for circular dependency in proxy chain
   * Returns the cycle path if found, null otherwise
   */
  checkCircularDependency(proxyId: string, outboundId: string): string[] | null {
    // If outbound is a provider, no cycle possible
    const outboundProxy = this.findById(outboundId)
    if (!outboundProxy) {
      // outboundId is a provider ID, not a proxy
      return null
    }

    const visited = new Set<string>([proxyId])
    const path = [proxyId]
    
    let currentId = outboundId
    
    while (currentId) {
      // Check if we've seen this proxy before
      if (visited.has(currentId)) {
        path.push(currentId)
        return path
      }
      
      visited.add(currentId)
      path.push(currentId)
      
      const proxy = this.findById(currentId)
      if (!proxy || proxy.outbound_type !== 'proxy') {
        // Reached a provider or end of chain
        break
      }
      
      currentId = proxy.outbound_id
    }
    
    return null
  }

  /**
   * Get the full proxy chain for a given proxy
   */
  getProxyChain(proxyId: string): BridgeProxyRow[] {
    const chain: BridgeProxyRow[] = []
    let currentId: string | null = proxyId
    const visited = new Set<string>()
    
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId)
      const proxy = this.findById(currentId)
      
      if (!proxy) break
      
      chain.push(proxy)
      
      if (proxy.outbound_type !== 'proxy') break
      
      currentId = proxy.outbound_id
    }
    
    return chain
  }

  /**
   * Create a new proxy
   */
  create(data: CreateProxyDTO): BridgeProxyRow {
    // Validate path uniqueness
    if (!this.isPathUnique(data.proxyPath)) {
      throw new Error(`Proxy path "${data.proxyPath}" already exists`)
    }
    
    // Check for circular dependency if outbound is a proxy
    if (data.outboundType === 'proxy') {
      const tempId = '__new__'
      const cycle = this.checkCircularDependency(tempId, data.outboundId)
      if (cycle) {
        throw new Error(`Circular dependency detected`)
      }
    }
    
    const id = this.generateId()
    const now = this.now()
    
    const stmt = this.db.prepare(`
      INSERT INTO bridge_proxies (id, name, inbound_adapter, outbound_type, outbound_id, proxy_path, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    stmt.run(
      id,
      data.name ?? '',
      data.inboundAdapter,
      data.outboundType,
      data.outboundId,
      data.proxyPath,
      data.enabled !== false ? 1 : 0,
      now,
      now
    )
    
    return this.findById(id)!
  }

  /**
   * Update an existing proxy
   */
  update(id: string, data: UpdateProxyDTO): BridgeProxyRow | null {
    const existing = this.findById(id)
    if (!existing) {
      return null
    }
    
    // Validate path uniqueness if path is being updated
    if (data.proxyPath !== undefined && data.proxyPath !== existing.proxy_path) {
      if (!this.isPathUnique(data.proxyPath, id)) {
        throw new Error(`Proxy path "${data.proxyPath}" already exists`)
      }
    }
    
    // Check for circular dependency if outbound is being updated
    const newOutboundType = data.outboundType ?? existing.outbound_type
    const newOutboundId = data.outboundId ?? existing.outbound_id
    
    if (newOutboundType === 'proxy' && newOutboundId !== existing.outbound_id) {
      const cycle = this.checkCircularDependency(id, newOutboundId)
      if (cycle) {
        throw new Error(`Circular dependency detected: ${cycle.join(' → ')}`)
      }
    }
    
    const updates: string[] = []
    const values: unknown[] = []
    
    if (data.name !== undefined) {
      updates.push('name = ?')
      values.push(data.name)
    }
    if (data.inboundAdapter !== undefined) {
      updates.push('inbound_adapter = ?')
      values.push(data.inboundAdapter)
    }
    if (data.outboundType !== undefined) {
      updates.push('outbound_type = ?')
      values.push(data.outboundType)
    }
    if (data.outboundId !== undefined) {
      updates.push('outbound_id = ?')
      values.push(data.outboundId)
    }
    if (data.proxyPath !== undefined) {
      updates.push('proxy_path = ?')
      values.push(data.proxyPath)
    }
    if (data.enabled !== undefined) {
      updates.push('enabled = ?')
      values.push(data.enabled ? 1 : 0)
    }
    if (data.sortOrder !== undefined) {
      updates.push('sort_order = ?')
      values.push(data.sortOrder)
    }
    
    if (updates.length === 0) {
      return existing
    }
    
    updates.push('updated_at = ?')
    values.push(this.now())
    values.push(id)
    
    const stmt = this.db.prepare(`
      UPDATE bridge_proxies SET ${updates.join(', ')} WHERE id = ?
    `)
    stmt.run(...values)
    
    return this.findById(id)
  }

  /**
   * Toggle proxy enabled status
   */
  toggleEnabled(id: string, enabled: boolean): boolean {
    const stmt = this.db.prepare(`
      UPDATE bridge_proxies SET enabled = ?, updated_at = ? WHERE id = ?
    `)
    const result = stmt.run(enabled ? 1 : 0, this.now(), id)
    return result.changes > 0
  }

  /**
   * Find proxies by outbound ID
   */
  findByOutboundId(outboundId: string): BridgeProxyRow[] {
    const stmt = this.db.prepare(
      'SELECT * FROM bridge_proxies WHERE outbound_id = ?'
    )
    return stmt.all(outboundId) as BridgeProxyRow[]
  }
}

// Singleton instance
let instance: BridgeProxyRepository | null = null

export function getBridgeProxyRepository(): BridgeProxyRepository {
  if (!instance) {
    instance = new BridgeProxyRepository()
  }
  return instance
}
