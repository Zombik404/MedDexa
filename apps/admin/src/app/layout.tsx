import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Shell } from '@/components/Shell';
import { readSession } from '@/lib/session';
import './globals.css';

export const metadata: Metadata = { title: 'MedDexa Admin', robots: { index: false, follow: false }, icons: { icon: '/mark.svg' } };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { user } = await readSession();
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{user ? <Shell user={user}>{children}</Shell> : children}</body>
    </html>
  );
}
