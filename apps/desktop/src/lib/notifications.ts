/**
 * Unified notification utilities using sonner toast
 */
import { toast } from 'sonner'

interface NotificationOptions {
  /**
   * Optional description text
   */
  description?: string
  /**
   * Duration in milliseconds
   * @default 2000 for success/info, 3000 for error/warning
   */
  duration?: number
  /**
   * Action button configuration
   */
  action?: {
    label: string
    onClick: () => void
  }
}

/**
 * Show a success notification
 */
export function showSuccess(message: string, options?: NotificationOptions): void {
  toast.success(message, {
    description: options?.description,
    duration: options?.duration ?? 2000,
    action: options?.action,
  })
}

/**
 * Show an error notification
 */
export function showError(message: string, options?: NotificationOptions): void {
  toast.error(message, {
    description: options?.description,
    duration: options?.duration ?? 3000,
    action: options?.action,
  })
}

/**
 * Show a warning notification
 */
export function showWarning(message: string, options?: NotificationOptions): void {
  toast.warning(message, {
    description: options?.description,
    duration: options?.duration ?? 3000,
    action: options?.action,
  })
}

/**
 * Show an info notification
 */
export function showInfo(message: string, options?: NotificationOptions): void {
  toast.info(message, {
    description: options?.description,
    duration: options?.duration ?? 2000,
    action: options?.action,
  })
}

/**
 * Show a loading notification
 * Returns a function to dismiss the loading toast
 */
export function showLoading(message: string, description?: string): () => void {
  const id = toast.loading(message, { description })
  return () => toast.dismiss(id)
}

/**
 * Show a promise-based notification
 * Automatically shows loading/success/error states
 */
export function showPromise<T>(
  promise: Promise<T>,
  messages: {
    loading: string
    success: string | ((data: T) => string)
    error: string | ((error: unknown) => string)
  }
): Promise<T> {
  return toast.promise(promise, messages)
}

/**
 * Dismiss all notifications
 */
export function dismissAll(): void {
  toast.dismiss()
}

/**
 * Common error handler with notification
 */
export function handleError(error: unknown, context: string): void {
  console.error(`Error in ${context}:`, error)
  
  const message = error instanceof Error ? error.message : String(error)
  showError(`${context} failed`, {
    description: message,
  })
}
