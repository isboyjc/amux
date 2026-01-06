import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';

export const { GET } = createFromSource(source, {
  localeMap: {
    en: 'english',
    zh: 'english', // Orama doesn't support Chinese, use english for Chinese content
  },
});
