/**
 * Application-wide constants
 */

// Polling & Intervals
export const POLLING_INTERVAL = 10000 // 10 seconds
export const METRICS_REFRESH_INTERVAL = 10000 // 10 seconds
export const TUNNEL_STATUS_POLL_INTERVAL = 1000 // 1 second (for uptime counter)

// Pagination
export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

// API Keys
export const API_KEY_PREFIX = 'sk-amux.'
export const API_KEY_MASK_LENGTH = 16
export const API_KEY_VISIBLE_PREFIX = 9
export const API_KEY_VISIBLE_SUFFIX = 4

// Timeouts & Feedback Durations
export const TOAST_AUTO_DISMISS = 2000 // 2 seconds
export const COPY_FEEDBACK_DURATION = 1500 // 1.5 seconds
export const COPY_FEEDBACK_DURATION_SHORT = 600 // 0.6 seconds
export const RESET_FEEDBACK_DURATION = 600 // 0.6 seconds

// Proxy Settings
export const DEFAULT_PROXY_PORT = 9527
export const DEFAULT_PROXY_HOST = '127.0.0.1'

// Chart & Visualization
export const CHART_ANIMATION_DURATION = 300
export const TIME_SERIES_HOURS = 24

// Success Rate Thresholds
export const SUCCESS_RATE_EXCELLENT = 95
export const SUCCESS_RATE_GOOD = 80

// File Export
export const LOG_EXPORT_DATE_FORMAT = 'YYYY-MM-DD'
export const CONFIG_EXPORT_DATE_FORMAT = 'YYYY-MM-DD'
