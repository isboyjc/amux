'use client';

import Link from 'next/link';
import { content, type Locale } from '@/lib/i18n-content';

interface FooterSectionProps {
  lang: string;
}

export function FooterSection({ lang }: FooterSectionProps) {
  const locale = (lang === 'zh' ? 'zh' : 'en') as Locale;
  const t = content[locale];

  return (
    <footer className="border-t border-fd-border bg-fd-card">
      <div className="container mx-auto px-4 py-12">
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="sm:col-span-2 md:col-span-1">
            <Link href={`/${lang}`} className="flex items-center gap-2 mb-4 hover:opacity-80 transition-opacity">
              <svg
                className="w-8 h-8"
                viewBox="0 0 128 128"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4 96 C4 96, 24 12, 64 12 C104 12, 124 96, 124 96 Q124 102, 118 102 C94 102, 92 64, 64 64 C36 64, 34 102, 10 102 Q4 102, 4 96 Z"
                  fill="currentColor"
                />
              </svg>
              <span className="text-xl font-bold">Amux</span>
            </Link>
            <p className="text-fd-muted-foreground text-sm leading-relaxed mb-4">
              {locale === 'zh' ? '双向 LLM API 适配器' : 'Bidirectional LLM API adapter'}
            </p>
            <p className="text-fd-muted-foreground text-xs">
              {locale === 'zh' ? '自由转换任意大模型 API' : 'Convert any LLM API freely'}
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold mb-4">{t.footer.product}</h4>
            <ul className="space-y-2 text-sm text-fd-muted-foreground">
              <li>
                <Link
                  href={`/${lang}/docs`}
                  className="hover:text-fd-foreground transition-colors"
                >
                  {t.footer.docs}
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/isboyjc/amux"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-fd-foreground transition-colors"
                >
                  {t.footer.github}
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/isboyjc/amux/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-fd-foreground transition-colors"
                >
                  {t.footer.desktop}
                </a>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-semibold mb-4">{t.footer.resources}</h4>
            <ul className="space-y-2 text-sm text-fd-muted-foreground">
              <li>
                <Link
                  href={`/${lang}/docs/quick-start`}
                  className="hover:text-fd-foreground transition-colors"
                >
                  {t.footer.quickStart}
                </Link>
              </li>
              <li>
                <Link
                  href={`/${lang}/docs/adapters`}
                  className="hover:text-fd-foreground transition-colors"
                >
                  {t.footer.adapters}
                </Link>
              </li>
              <li>
                <Link
                  href={`/${lang}/docs/api`}
                  className="hover:text-fd-foreground transition-colors"
                >
                  {t.footer.apiReference}
                </Link>
              </li>
            </ul>
          </div>

          {/* Community */}
          <div>
            <h4 className="font-semibold mb-4">{t.footer.community}</h4>
            <ul className="space-y-2 text-sm text-fd-muted-foreground">
              <li>
                <a
                  href="https://github.com/isboyjc/amux/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-fd-foreground transition-colors"
                >
                  {t.footer.issues}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-fd-border flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-fd-muted-foreground">
          <div className="flex items-center gap-2">
            {t.footer.copyright}
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/isboyjc/amux"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-fd-foreground transition-colors"
            >
              GitHub
            </a>
            <span className="text-fd-border">|</span>
            <Link
              href={`/${lang}/docs`}
              className="hover:text-fd-foreground transition-colors"
            >
              {locale === 'zh' ? '文档' : 'Docs'}
            </Link>
            <span className="text-fd-border">|</span>
            <a
              href="https://github.com/isboyjc/amux/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-fd-foreground transition-colors"
            >
              {locale === 'zh' ? '下载' : 'Download'}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
