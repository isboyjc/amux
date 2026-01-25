'use client';

import Link from 'next/link';
import { ArrowRight, Github, Sparkles, Download } from 'lucide-react';
import { content, type Locale } from '@/lib/i18n-content';

interface HeroSectionProps {
  lang: string;
}

export function HeroSection({ lang }: HeroSectionProps) {
  const locale = (lang === 'zh' ? 'zh' : 'en') as Locale;
  const t = content[locale];

  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-fd-primary/5 via-transparent to-fd-primary/5" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-fd-primary/10 to-transparent rounded-full blur-3xl" />
      </div>

      {/* Hero Content */}
      <div className="container mx-auto px-4 py-32 flex-1 flex flex-col justify-center">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-fd-primary/10 text-fd-primary text-sm font-medium mb-8">
            <Sparkles className="w-4 h-4" />
            {t.hero.badge}
          </div>

          {/* Title */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6">
            {t.hero.title}
            <br />
            <span className="bg-gradient-to-r from-fd-primary to-fd-primary/60 bg-clip-text text-transparent">
              {t.hero.titleHighlight}
            </span>
          </h1>

          {/* Description */}
          <p className="text-lg md:text-xl text-fd-muted-foreground max-w-2xl mb-10">
            {t.hero.description}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href={`/${lang}/docs`}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg bg-fd-primary text-fd-primary-foreground font-medium hover:bg-fd-primary/90 transition-all hover:scale-105"
            >
              {t.hero.getStarted}
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href="https://github.com/isboyjc/amux/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg border border-fd-border bg-fd-background hover:bg-fd-accent transition-all hover:scale-105 font-medium"
            >
              <Download className="w-5 h-5" />
              {locale === 'zh' ? '下载客户端' : 'Download Desktop'}
            </a>
            <a
              href="https://github.com/isboyjc/amux"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg border border-fd-border bg-fd-background hover:bg-fd-accent transition-all hover:scale-105 font-medium"
            >
              <Github className="w-5 h-5" />
              {t.hero.github}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
