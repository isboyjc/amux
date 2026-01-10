import type { LLMAdapter } from './base'
import type { AdapterInfo } from './capabilities'

/**
 * Adapter registry for managing adapters
 */
export class AdapterRegistry {
  private adapters = new Map<string, LLMAdapter>()

  /**
   * Register an adapter
   */
  register(adapter: LLMAdapter): void {
    if (this.adapters.has(adapter.name)) {
      throw new Error(`Adapter "${adapter.name}" is already registered`)
    }
    this.adapters.set(adapter.name, adapter)
  }

  /**
   * Unregister an adapter
   */
  unregister(name: string): boolean {
    return this.adapters.delete(name)
  }

  /**
   * Get an adapter by name
   */
  get(name: string): LLMAdapter | undefined {
    return this.adapters.get(name)
  }

  /**
   * Check if an adapter is registered
   */
  has(name: string): boolean {
    return this.adapters.has(name)
  }

  /**
   * List all registered adapters
   */
  list(): AdapterInfo[] {
    return Array.from(this.adapters.values()).map((adapter) =>
      adapter.getInfo()
    )
  }

  /**
   * Clear all adapters
   */
  clear(): void {
    this.adapters.clear()
  }
}

/**
 * Global adapter registry instance
 */
export const globalRegistry = new AdapterRegistry()
