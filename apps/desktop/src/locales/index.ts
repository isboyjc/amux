import zhCN from './zh-CN.json'
import enUS from './en-US.json'

export const locales = {
  'zh-CN': zhCN,
  'en-US': enUS
}

export type LocaleKey = keyof typeof locales
export type Messages = typeof zhCN

let currentLocale: LocaleKey = 'zh-CN'
let currentMessages: Messages = zhCN

/**
 * Set current locale
 */
export function setLocale(locale: LocaleKey): void {
  if (locales[locale]) {
    currentLocale = locale
    currentMessages = locales[locale] as Messages
  }
}

/**
 * Get current locale
 */
export function getLocale(): LocaleKey {
  return currentLocale
}

/**
 * Get translation by key path
 */
export function t(keyPath: string): string {
  const keys = keyPath.split('.')
  let value: unknown = currentMessages
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = (value as Record<string, unknown>)[key]
    } else {
      return keyPath
    }
  }
  
  return typeof value === 'string' ? value : keyPath
}

/**
 * Initialize locale based on system language
 */
export function initLocale(): void {
  const systemLang = navigator.language
  
  if (systemLang.startsWith('zh')) {
    setLocale('zh-CN')
  } else {
    setLocale('en-US')
  }
}
