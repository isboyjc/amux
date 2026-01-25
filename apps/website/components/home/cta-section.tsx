'use client';

import Link from 'next/link';
import { ArrowRight, Github, Download } from 'lucide-react';
import { content, type Locale } from '@/lib/i18n-content';

interface CTASectionProps {
  lang: string;
}

export function CTASection({ lang }: CTASectionProps) {
  const locale = (lang === 'zh' ? 'zh' : 'en') as Locale;
  const t = content[locale];

  return (
    <section className="border-t border-fd-border bg-fd-muted/30">
      <div className="container mx-auto px-4 py-24">
        <div className="text-center max-w-3xl mx-auto">
          
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            {t.cta.title}
          </h2>
          <p className="text-fd-muted-foreground text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
            {t.cta.subtitle}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href={`/${lang}/docs`}
              className="group inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-fd-primary text-fd-primary-foreground font-medium hover:bg-fd-primary/90 transition-all"
            >
              {t.cta.primary}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <a
              href="https://github.com/isboyjc/amux/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-fd-border bg-fd-background hover:bg-fd-accent transition-all font-medium"
            >
              <Download className="w-4 h-4" />
              {locale === 'zh' ? '下载客户端' : 'Download Desktop'}
            </a>
            <a
              href="https://github.com/isboyjc/amux"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-fd-border bg-fd-background hover:bg-fd-accent transition-all font-medium"
            >
              <Github className="w-4 h-4" />
              {t.cta.secondary}
            </a>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-fd-muted-foreground">
            <span>{locale === 'zh' ? '开源免费' : 'Open Source'}</span>
            <span className="text-fd-border">•</span>
            <span>{locale === 'zh' ? 'MIT 协议' : 'MIT License'}</span>
            <span className="text-fd-border">•</span>
            <span>{locale === 'zh' ? '零依赖' : 'Zero Dependencies'}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
