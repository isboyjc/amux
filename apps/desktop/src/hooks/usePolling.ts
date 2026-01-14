import { useEffect, useRef } from 'react'

interface UsePollingOptions {
  /**
   * Polling interval in milliseconds
   * @default 5000
   */
  interval?: number
  /**
   * Whether polling is enabled
   * @default true
   */
  enabled?: boolean
  /**
   * Whether to trigger immediately on mount
   * @default true
   */
  immediate?: boolean
}

/**
 * A unified hook for polling data at regular intervals
 * 
 * @param callback - Function to be called at each interval
 * @param options - Polling configuration options
 * 
 * @example
 * ```tsx
 * // Default: 5s interval, auto-start, immediate first call
 * usePolling(() => fetchData())
 * 
 * // Custom: 10s interval, conditional start
 * usePolling(() => fetchData(), {
 *   interval: 10000,
 *   enabled: isActive
 * })
 * 
 * // Tunnel timer: 1s interval (special case)
 * usePolling(() => updateTimer(), {
 *   interval: 1000
 * })
 * ```
 */
export function usePolling(
  callback: () => void | Promise<void>,
  options: UsePollingOptions = {}
): void {
  const { interval = 5000, enabled = true, immediate = true } = options
  const callbackRef = useRef(callback)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    if (!enabled) {
      // Clear timer if disabled
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }

    // Execute immediately if requested
    if (immediate) {
      callbackRef.current()
    }

    // Set up polling interval
    timerRef.current = setInterval(() => {
      callbackRef.current()
    }, interval)

    // Cleanup on unmount or dependency change
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [interval, enabled, immediate])
}
