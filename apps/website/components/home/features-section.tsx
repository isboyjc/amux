'use client';

import {
  ArrowLeftRight,
  Feather,
  Puzzle,
  Waves,
  Wrench,
  Image,
} from 'lucide-react';
import { content, type Locale } from '@/lib/i18n-content';

interface FeaturesSectionProps {
  lang: string;
}

const featureIcons = {
  arrows: ArrowLeftRight,
  feather: Feather,
  puzzle: Puzzle,
  stream: Waves,
  tool: Wrench,
  image: Image,
};

export function FeaturesSection({ lang }: FeaturesSectionProps) {
  const locale = (lang === 'zh' ? 'zh' : 'en') as Locale;
  const t = content[locale];

  return (
    <section className="border-t border-fd-border bg-fd-muted/30">
      <div className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            {t.features.title}
          </h2>
          <p className="text-fd-muted-foreground text-lg max-w-2xl mx-auto">
            {t.features.subtitle}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {t.features.items.map((feature, i) => {
            const Icon =
              featureIcons[feature.icon as keyof typeof featureIcons];
            return (
              <div
                key={i}
                className="p-6 rounded-lg border border-fd-border bg-fd-card hover:border-fd-primary/50 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-lg bg-fd-muted flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-fd-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-fd-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
