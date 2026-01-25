'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Github, Moon, Sun, Languages } from 'lucide-react';
import { useTheme } from 'next-themes';

interface HomeNavProps {
  lang: string;
}

const translations = {
  en: {
    docs: 'Docs',
    github: 'GitHub',
    theme: {
      light: 'Light',
      dark: 'Dark',
      system: 'System',
    },
  },
  zh: {
    docs: '文档',
    github: 'GitHub',
    theme: {
      light: '浅色',
      dark: '深色',
      system: '系统',
    },
  },
};

const languages = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
];

export function HomeNav({ lang }: HomeNavProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();

  const t = translations[lang as keyof typeof translations] || translations.en;

  useEffect(() => {
    setMounted(true);
    
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  // Get current path without language prefix for language switching
  const getPathWithoutLang = () => {
    return pathname.replace(/^\/(en|zh)/, '') || '/';
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-fd-background/80 backdrop-blur-lg border-b border-fd-border'
          : 'bg-transparent'
      }`}
    >
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          href={`/${lang}`}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
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
        </Link>

        {/* Nav Links */}
        <div className="flex items-center gap-6">
          <Link
            href={`/${lang}/docs`}
            className="text-sm font-medium hover:text-fd-primary transition-colors"
          >
            {t.docs}
          </Link>
          <a
            href="https://github.com/isboyjc/amux"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm font-medium hover:text-fd-primary transition-colors"
          >
            <Github className="w-4 h-4" />
            {t.github}
          </a>

          {/* Language Switcher */}
          <div className="relative group">
            <button
              className="flex items-center gap-1 text-sm font-medium hover:text-fd-primary transition-colors p-2 rounded-md hover:bg-fd-accent"
              aria-label="Change language"
            >
              <Languages className="w-4 h-4" />
              <span className="hidden sm:inline">
                {languages.find((l) => l.code === lang)?.label}
              </span>
            </button>
            <div className="absolute right-0 mt-2 w-32 bg-fd-popover border border-fd-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
              {languages.map((language) => (
                <Link
                  key={language.code}
                  href={`/${language.code}${getPathWithoutLang()}`}
                  className={`block px-4 py-2 text-sm hover:bg-fd-accent first:rounded-t-lg last:rounded-b-lg transition-colors ${
                    lang === language.code
                      ? 'text-fd-primary font-medium'
                      : 'text-fd-foreground'
                  }`}
                >
                  {language.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Theme Toggle */}
          {mounted && (
            <button
              onClick={toggleTheme}
              className="p-2 rounded-md hover:bg-fd-accent transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
