import { RootProvider } from 'fumadocs-ui/provider/next';
import { Ubuntu, Ubuntu_Mono } from 'next/font/google';
import { defineI18nUI } from 'fumadocs-ui/i18n';
import { GoogleAnalytics } from '@next/third-parties/google';
import { i18n } from '@/lib/i18n';
import '../global.css';

// Ubuntu fonts for consistency with desktop app
const ubuntu = Ubuntu({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-sans',
});

const ubuntuMono = Ubuntu_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-mono',
});

const { provider } = defineI18nUI(i18n, {
  translations: {
    en: {
      displayName: 'English',
    },
    zh: {
      displayName: '中文',
      search: '查询文档',
    },
  },
});

export default async function RootLayout({
  params,
  children,
}: {
  params: Promise<{ lang: string }>;
  children: React.ReactNode;
}) {
  const lang = (await params).lang;
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  return (
    <html lang={lang} className={`${ubuntu.variable} ${ubuntuMono.variable}`} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider
          i18n={provider(lang)}
        >
          {children}
        </RootProvider>
        {gaId && <GoogleAnalytics gaId={gaId} />}
      </body>
    </html>
  );
}
