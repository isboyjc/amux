'use client';

import { useState } from 'react';

interface Logo {
  name: string;
  full_logo: string;
}

interface InfiniteScrollLogosProps {
  logos: Logo[];
  direction?: 'left' | 'right';
  speed?: number;
}

export function InfiniteScrollLogos({
  logos,
  direction = 'left',
  speed = 60,
}: InfiniteScrollLogosProps) {
  const [isPaused, setIsPaused] = useState(false);
  const animationDirection = direction === 'left' ? 'normal' : 'reverse';

  return (
    <div 
      className="relative w-full overflow-hidden py-4"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        className="flex gap-12 md:gap-16 lg:gap-20"
        style={{
          animation: `scroll-horizontal ${speed}s linear infinite`,
          animationDirection,
          animationPlayState: isPaused ? 'paused' : 'running',
        }}
      >
        {/* Render logos 3 times for seamless loop */}
        {[...logos, ...logos, ...logos].map((logo, index) => (
          <div
            key={index}
            className="flex-shrink-0 flex items-center justify-center h-10 md:h-12 grayscale hover:grayscale-0 opacity-50 hover:opacity-100 transition-all duration-300"
            style={{ minWidth: '120px' }}
          >
            <img
              src={logo.full_logo}
              alt={logo.name}
              className="w-auto h-full object-contain"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
