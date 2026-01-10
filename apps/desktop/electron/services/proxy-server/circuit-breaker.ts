/**
 * Circuit breaker pattern implementation
 */

import { getSettingsRepository } from '../database/repositories'

// Circuit breaker states
export enum CircuitState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',         // Rejecting requests
  HALF_OPEN = 'half_open' // Testing if service recovered
}

export interface CircuitBreakerConfig {
  enabled: boolean
  threshold: number      // Consecutive failures before opening
  resetTimeout: number   // Time in ms before trying again
}

interface CircuitData {
  state: CircuitState
  failures: number
  lastFailure: number
  lastSuccess: number
}

// Circuit breaker state per provider
const circuits = new Map<string, CircuitData>()

/**
 * Get circuit breaker config from settings
 */
export function getCircuitBreakerConfig(): CircuitBreakerConfig {
  const settings = getSettingsRepository()
  
  return {
    enabled: settings.get('proxy.circuitBreaker.enabled') ?? true,
    threshold: settings.get('proxy.circuitBreaker.threshold') ?? 5,
    resetTimeout: settings.get('proxy.circuitBreaker.resetTimeout') ?? 30000
  }
}

/**
 * Get or initialize circuit for a provider
 */
function getCircuit(providerId: string): CircuitData {
  let circuit = circuits.get(providerId)
  
  if (!circuit) {
    circuit = {
      state: CircuitState.CLOSED,
      failures: 0,
      lastFailure: 0,
      lastSuccess: Date.now()
    }
    circuits.set(providerId, circuit)
  }
  
  return circuit
}

/**
 * Check if circuit allows requests
 */
export function canRequest(providerId: string): boolean {
  const config = getCircuitBreakerConfig()
  
  if (!config.enabled) {
    return true
  }
  
  const circuit = getCircuit(providerId)
  const now = Date.now()
  
  switch (circuit.state) {
    case CircuitState.CLOSED:
      return true
      
    case CircuitState.OPEN:
      // Check if reset timeout has passed
      if (now - circuit.lastFailure >= config.resetTimeout) {
        // Transition to half-open
        circuit.state = CircuitState.HALF_OPEN
        console.log(`[CircuitBreaker] ${providerId}: OPEN -> HALF_OPEN`)
        return true
      }
      return false
      
    case CircuitState.HALF_OPEN:
      // Allow one request to test
      return true
      
    default:
      return true
  }
}

/**
 * Record a successful request
 */
export function recordSuccess(providerId: string): void {
  const circuit = getCircuit(providerId)
  
  circuit.lastSuccess = Date.now()
  circuit.failures = 0
  
  if (circuit.state === CircuitState.HALF_OPEN) {
    // Service recovered, close circuit
    circuit.state = CircuitState.CLOSED
    console.log(`[CircuitBreaker] ${providerId}: HALF_OPEN -> CLOSED`)
  }
}

/**
 * Record a failed request
 */
export function recordFailure(providerId: string): void {
  const config = getCircuitBreakerConfig()
  
  if (!config.enabled) {
    return
  }
  
  const circuit = getCircuit(providerId)
  const now = Date.now()
  
  circuit.failures++
  circuit.lastFailure = now
  
  if (circuit.state === CircuitState.HALF_OPEN) {
    // Failed during test, reopen circuit
    circuit.state = CircuitState.OPEN
    console.log(`[CircuitBreaker] ${providerId}: HALF_OPEN -> OPEN`)
  } else if (
    circuit.state === CircuitState.CLOSED &&
    circuit.failures >= config.threshold
  ) {
    // Threshold reached, open circuit
    circuit.state = CircuitState.OPEN
    console.log(`[CircuitBreaker] ${providerId}: CLOSED -> OPEN (${circuit.failures} failures)`)
  }
}

/**
 * Get circuit state for a provider
 */
export function getCircuitState(providerId: string): CircuitState {
  return getCircuit(providerId).state
}

/**
 * Get all circuit states
 */
export function getAllCircuitStates(): Map<string, CircuitState> {
  const states = new Map<string, CircuitState>()
  
  for (const [providerId, circuit] of circuits) {
    states.set(providerId, circuit.state)
  }
  
  return states
}

/**
 * Get circuit statistics for a provider
 */
export function getCircuitStats(providerId: string): {
  state: CircuitState
  failures: number
  lastFailure: number | null
  lastSuccess: number | null
} {
  const circuit = getCircuit(providerId)
  
  return {
    state: circuit.state,
    failures: circuit.failures,
    lastFailure: circuit.lastFailure || null,
    lastSuccess: circuit.lastSuccess || null
  }
}

/**
 * Reset circuit for a provider
 */
export function resetCircuit(providerId: string): void {
  circuits.delete(providerId)
  console.log(`[CircuitBreaker] ${providerId}: Reset`)
}

/**
 * Reset all circuits
 */
export function resetAllCircuits(): void {
  circuits.clear()
  console.log('[CircuitBreaker] All circuits reset')
}

/**
 * Execute a function with circuit breaker protection
 */
export async function withCircuitBreaker<T>(
  providerId: string,
  fn: () => Promise<T>
): Promise<T> {
  const config = getCircuitBreakerConfig()
  
  if (!config.enabled) {
    return fn()
  }
  
  if (!canRequest(providerId)) {
    throw new Error(`Circuit breaker is open for provider: ${providerId}`)
  }
  
  try {
    const result = await fn()
    recordSuccess(providerId)
    return result
  } catch (error) {
    recordFailure(providerId)
    throw error
  }
}
