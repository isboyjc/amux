import { i18n } from '@/lib/i18n';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(locale: string): BaseLayoutProps {
  return {
    i18n,
    // different props based on `locale`
    nav: {
      title: 'LLM Bridge',
    },
  };
}
