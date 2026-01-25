'use client';

import { InfiniteScrollLogos } from '@/components/home/infinite-scroll-logos';
import logosData from '@/public/data.json';

export function LogosSection() {
  return (
    <div className="absolute bottom-0 left-0 right-0 pb-12 px-10 md:px-20 lg:px-30">
      <div className="space-y-6">
        {/* Provider Logos - Scroll Left */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 w-32 md:w-48 bg-gradient-to-r from-fd-background via-fd-background/40 to-transparent pointer-events-none z-10" />
          <div className="absolute inset-y-0 right-0 w-32 md:w-48 pointer-events-none z-10">
            <div className="absolute inset-0 bg-gradient-to-l from-fd-background via-fd-background/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-l from-fd-primary/5 to-transparent" />
          </div>
          <InfiniteScrollLogos logos={logosData.providers} direction="left" speed={60} />
        </div>

        {/* Product Logos - Scroll Right */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 w-32 md:w-48 bg-gradient-to-r from-fd-background via-fd-background/40 to-transparent pointer-events-none z-10" />
          <div className="absolute inset-y-0 right-0 w-32 md:w-48 pointer-events-none z-10">
            <div className="absolute inset-0 bg-gradient-to-l from-fd-background via-fd-background/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-l from-fd-primary/5 to-transparent" />
          </div>
          <InfiniteScrollLogos logos={logosData.products} direction="right" speed={50} />
        </div>
      </div>
    </div>
  );
}
