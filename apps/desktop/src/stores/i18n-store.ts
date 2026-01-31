import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import enUS from '@/locales/en-US.json'
import zhCN from '@/locales/zh-CN.json'

export type Locale = 'en-US' | 'zh-CN'

const messages: Record<Locale, typeof enUS> = {
  'en-US': enUS,
  'zh-CN': zhCN,
}

interface I18nState {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set, get) => ({
      locale: 'en-US', // Default to English
      
      setLocale: (locale: Locale) => {
        set({ locale })
      },
      
      t: (key: string, params?: Record<string, string | number>) => {
        const { locale } = get()
        const keys = key.split('.')
        let value: unknown = messages[locale]
        
        for (const k of keys) {
          if (value && typeof value === 'object' && k in value) {
            value = (value as Record<string, unknown>)[k]
          } else {
            return key // Return key if translation not found
          }
        }
        
        let result = typeof value === 'string' ? value : key
        
        // Replace placeholders like {cliType} with actual values
        if (params) {
          Object.entries(params).forEach(([paramKey, paramValue]) => {
            result = result.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue))
          })
        }
        
        return result
      },
    }),
    {
      name: 'amux-i18n',
      partialize: (state) => ({ locale: state.locale }),
    }
  )
)

// Hook for easy access
export function useI18n() {
  const { locale, setLocale, t } = useI18nStore()
  return { locale, setLocale, t }
}
