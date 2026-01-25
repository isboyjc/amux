import {
  HeroSection,
  LogosSection,
  PainPointsSection,
  SolutionSection,
  FeaturesSection,
  CodeExampleSection,
  UseCasesSection,
  CTASection,
  FooterSection,
} from '@/components/home';

export default async function Page({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return (
    <div className="flex flex-col">
      {/* Hero Section with Logos */}
      <div className="relative">
        <HeroSection lang={lang} />
        <LogosSection />
      </div>

      {/* Pain Points */}
      <PainPointsSection lang={lang} />

      {/* Solution / Products */}
      <SolutionSection lang={lang} />

      {/* Features */}
      <FeaturesSection lang={lang} />

      {/* Code Example */}
      <CodeExampleSection lang={lang} />

      {/* Use Cases */}
      <UseCasesSection lang={lang} />

      {/* Final CTA */}
      <CTASection lang={lang} />

      {/* Footer */}
      <FooterSection lang={lang} />
    </div>
  );
}
