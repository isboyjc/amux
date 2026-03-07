import { i18n } from '@/lib/i18n';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

// Logo component that adapts to theme
function Logo() {
  return (
    <div className="flex items-center gap-2">
      <svg
        className="w-7 h-7"
        viewBox="0 0 128 128"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M4 96 C4 96, 24 12, 64 12 C104 12, 124 96, 124 96 Q124 102, 118 102 C94 102, 92 64, 64 64 C36 64, 34 102, 10 102 Q4 102, 4 96 Z"
          fill="currentColor"
        />
      </svg>
      <span className="font-bold text-lg">Amux</span>
    </div>
  );
}

export function baseOptions(locale: string): BaseLayoutProps {
  return {
    i18n,
    nav: {
      title: <Logo />,
    },
    githubUrl: 'https://github.com/isboyjc/amux',
  };
}
