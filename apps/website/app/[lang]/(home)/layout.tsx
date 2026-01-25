import type { ReactNode } from 'react';
import { HomeNav } from '@/components/home';

export default async function Layout({
  params,
  children,
}: {
  params: Promise<{ lang: string }>;
  children: ReactNode;
}) {
  const { lang } = await params;

  return (
    <>
      <HomeNav lang={lang} />
      {children}
    </>
  );
}
