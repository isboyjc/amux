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
  t: (key: string) => string
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set, get) => ({
      locale: 'en-US', // Default to English
      
      setLocale: (locale: Locale) => {
        set({ locale })
      },
      
      t: (key: string) => {
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
        
        return typeof value === 'string' ? value : key
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
