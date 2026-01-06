import { defineI18n } from 'fumadocs-core/i18n';

export const i18n = defineI18n({
  // dot or dir, default is dot
  parser: 'dir',
  defaultLanguage: 'en',
  fallbackLanguage: 'en',
  languages: ['en', 'zh'],
  hideLocale: 'default-locale'
});