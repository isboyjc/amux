'use client';

import { content, type Locale } from '@/lib/i18n-content';

interface PainPointsSectionProps {
  lang: string;
}

export function PainPointsSection({ lang }: PainPointsSectionProps) {
  const locale = (lang === 'zh' ? 'zh' : 'en') as Locale;
  const t = content[locale];

  return (
    <section className="border-t border-fd-border bg-fd-muted/30">
      <div className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            {t.painPoints.title}
          </h2>
          <p className="text-fd-muted-foreground text-lg max-w-2xl mx-auto">
            {t.painPoints.subtitle}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {t.painPoints.items.map((item, i) => (
            <div
              key={i}
              className="group relative p-6 rounded-lg border border-fd-border bg-fd-card hover:border-fd-border/80 transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-lg bg-fd-muted flex items-center justify-center mb-4">
                <span className="text-xl font-bold text-fd-muted-foreground">✕</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
              <p className="text-fd-muted-foreground text-sm leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
