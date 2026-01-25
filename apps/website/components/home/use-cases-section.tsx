'use client';

import { Code2, Building2, FlaskConical } from 'lucide-react';
import { content, type Locale } from '@/lib/i18n-content';

interface UseCasesSectionProps {
  lang: string;
}

const useCaseIcons = {
  code: Code2,
  building: Building2,
  flask: FlaskConical,
};

export function UseCasesSection({ lang }: UseCasesSectionProps) {
  const locale = (lang === 'zh' ? 'zh' : 'en') as Locale;
  const t = content[locale];

  return (
    <section className="border-t border-fd-border">
      <div className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            {t.useCases.title}
          </h2>
          <p className="text-fd-muted-foreground text-lg max-w-2xl mx-auto">
            {t.useCases.subtitle}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {t.useCases.items.map((item, i) => {
            const Icon = useCaseIcons[item.icon as keyof typeof useCaseIcons];
            return (
              <div
                key={i}
                className="p-8 rounded-lg border border-fd-border bg-fd-card text-center hover:border-fd-primary/50 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-lg bg-fd-muted flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-6 h-6 text-fd-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-3">{item.title}</h3>
                <p className="text-fd-muted-foreground text-sm leading-relaxed">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
