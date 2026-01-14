/**
 * Centralized error handling utilities
 */

import { toast } from 'sonner'

export interface ErrorOptions {
  showToast?: boolean
  fallbackMessage?: string
  logToConsole?: boolean
}

/**
 * Handle and format error messages
 */
export function handleError(
  error: unknown,
  context: string,
  options: ErrorOptions = {}
): string {
  const {
    showToast = true,
    fallbackMessage = 'An unexpected error occurred',
    logToConsole = true
  } = options

  let message: string

  if (error instanceof Error) {
    message = error.message
  } else if (typeof error === 'string') {
    message = error
  } else {
    message = fallbackMessage
  }

  // Log to console for debugging
  if (logToConsole) {
    console.error(`[${context}]`, error)
  }

  // Show toast notification
  if (showToast) {
    toast.error(message)
  }

  return message
}

/**
 * Wrapper for async operations with error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string,
  options?: ErrorOptions
): Promise<T | null> {
  try {
    return await operation()
  } catch (error) {
    handleError(error, context, options)
    return null
  }
}

/**
 * IPC call wrapper with error handling
 */
export async function safeIpcCall<T>(
  ipcFn: () => Promise<T>,
  context: string,
  options?: ErrorOptions
): Promise<T | null> {
  return withErrorHandling(ipcFn, context, options)
}
