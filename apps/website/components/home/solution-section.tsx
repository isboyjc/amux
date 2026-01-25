'use client';

import Link from 'next/link';
import { ArrowRight, Check, Terminal, Monitor, Download } from 'lucide-react';
import { content, type Locale } from '@/lib/i18n-content';

interface SolutionSectionProps {
  lang: string;
}

export function SolutionSection({ lang }: SolutionSectionProps) {
  const locale = (lang === 'zh' ? 'zh' : 'en') as Locale;
  const t = content[locale];

  return (
    <section className="border-t border-fd-border bg-gradient-to-b from-fd-background to-fd-muted/30">
      <div className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            {t.solution.title}
          </h2>
          <p className="text-fd-muted-foreground text-lg max-w-2xl mx-auto">
            {t.solution.subtitle}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* LLM Bridge Product Card */}
          <div className="relative group">
            <div className="relative p-8 rounded-lg border border-fd-border bg-fd-card h-full flex flex-col hover:border-fd-primary/50 transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-fd-muted">
                  <Terminal className="w-6 h-6 text-fd-foreground" />
                </div>
                <span className="text-xs font-medium px-3 py-1 rounded-md border border-fd-border bg-fd-muted text-fd-foreground">
                  {t.products.bridge.badge}
                </span>
              </div>

              <h3 className="text-2xl font-bold mb-2">
                {t.products.bridge.title}
              </h3>
              <p className="text-fd-muted-foreground font-medium mb-3">
                {t.products.bridge.subtitle}
              </p>
              <p className="text-fd-muted-foreground text-sm mb-6 leading-relaxed">
                {t.products.bridge.description}
              </p>

              <ul className="space-y-3 mb-8 flex-grow">
                {t.products.bridge.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <Check className="w-4 h-4 text-fd-primary flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="space-y-3">
                <code className="block w-full p-3 rounded-lg bg-fd-muted border border-fd-border text-sm font-mono">
                  {t.products.bridge.cta}
                </code>
                <Link
                  href={`/${lang}/docs`}
                  className="group/btn inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-fd-primary text-fd-primary-foreground font-medium hover:bg-fd-primary/90 transition-all"
                >
                  {t.products.bridge.ctaButton}
                  <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          </div>

          {/* Desktop Product Card */}
          <div className="relative group">
            <div className="relative p-8 rounded-lg border border-fd-border bg-fd-card h-full flex flex-col hover:border-fd-primary/50 transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-fd-muted">
                  <Monitor className="w-6 h-6 text-fd-foreground" />
                </div>
                <span className="text-xs font-medium px-3 py-1 rounded-md border border-fd-border bg-fd-muted text-fd-foreground">
                  {t.products.desktop.badge}
                </span>
              </div>

              <h3 className="text-2xl font-bold mb-2">
                {t.products.desktop.title}
              </h3>
              <p className="text-fd-muted-foreground font-medium mb-3">
                {t.products.desktop.subtitle}
              </p>
              <p className="text-fd-muted-foreground text-sm mb-6 leading-relaxed">
                {t.products.desktop.description}
              </p>

              <ul className="space-y-3 mb-8 flex-grow">
                {t.products.desktop.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <Check className="w-4 h-4 text-fd-primary flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="space-y-3">
                <div className="flex gap-2">
                  <button className="flex-1 px-3 py-2 rounded-lg border border-fd-border bg-fd-background hover:bg-fd-accent transition-all text-sm font-medium">
                    {t.products.desktop.platforms.mac}
                  </button>
                  <button className="flex-1 px-3 py-2 rounded-lg border border-fd-border bg-fd-background hover:bg-fd-accent transition-all text-sm font-medium">
                    {t.products.desktop.platforms.windows}
                  </button>
                  <button className="flex-1 px-3 py-2 rounded-lg border border-fd-border bg-fd-background hover:bg-fd-accent transition-all text-sm font-medium">
                    {t.products.desktop.platforms.linux}
                  </button>
                </div>
                <a
                  href="https://github.com/isboyjc/amux/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/btn inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-fd-primary text-fd-primary-foreground font-medium hover:bg-fd-primary/90 transition-all"
                >
                  <Download className="w-4 h-4" />
                  {t.products.desktop.ctaButton}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
