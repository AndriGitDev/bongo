import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://bongo.andri.is'),
  title: {
    default: 'Bongómælir',
    template: '%s · Bongómælir',
  },
  description:
    'Óvísindalega vísindalegur mælikvarði á bongó veður á Íslandi — með þína staðsetningu sjálfgefinna.',
  openGraph: {
    title: 'Bongómælir',
    description: 'Hversu bongó er hjá þér?',
    url: 'https://bongo.andri.is',
    siteName: 'Bongómælir',
    locale: 'is_IS',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: '#ffb000',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="is">
      <body>{children}</body>
    </html>
  );
}
