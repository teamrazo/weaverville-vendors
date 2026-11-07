import type { Metadata, Viewport } from 'next';
import { Cinzel, Open_Sans } from 'next/font/google';
import './globals.css';
import WcocFooterCredit from './components/WcocFooterCredit';
import StructuredData from './components/StructuredData';
import { CHAMBER_NAME, SHARE_SUBTITLE, SHARE_TITLE, SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from './lib/site';

// Self-hosted at build time: no render-blocking request to Google on page load.
const cinzel = Cinzel({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-cinzel', display: 'swap' });
const openSans = Open_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-open-sans', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: `${CHAMBER_NAME} Vendor Portal`,
  keywords: [
    'Weaverville vendor application',
    'Mountain Magic Christmas vendors',
    'Weaverville CA events',
    'Trinity County craft fair',
    'holiday market vendor booth',
    'Weaverville Chamber of Commerce',
  ],
  authors: [{ name: CHAMBER_NAME, url: 'https://weavervilleca.org' }],
  publisher: CHAMBER_NAME,
  alternates: { canonical: '/' },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: `${CHAMBER_NAME} Vendor Portal`,
    locale: 'en_US',
    title: SHARE_TITLE,
    description: SHARE_SUBTITLE,
  },
  twitter: {
    card: 'summary_large_image',
    title: SHARE_TITLE,
    description: SHARE_SUBTITLE,
  },
  formatDetection: { telephone: true, address: false, email: false },
  category: 'events',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#161513',
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${openSans.variable}`}>
      <head>
        <StructuredData />
      </head>
      <body className="min-h-screen flex flex-col justify-between bg-chamber-cream text-chamber-black font-body">
        <header className="bg-chamber-black text-chamber-cream border-b-4 border-chamber-gold shadow-chamber relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 30%, #f0d397 0, transparent 45%), radial-gradient(circle at 80% 70%, #f0d397 0, transparent 45%)',
            }}
          />
          <div className="max-w-4xl mx-auto px-4 py-7 text-center relative">
            <p className="text-chamber-gold tracking-[0.25em] text-xs font-semibold uppercase mb-2">
              Trinity County, California &middot; Est. 1909
            </p>
            <h1 className="text-2xl md:text-3xl font-bold font-serif-brand text-chamber-cream">
              WEAVERVILLE CHAMBER OF COMMERCE
            </h1>
            <div className="w-16 h-[2px] bg-chamber-gold mx-auto my-3" />
            <p className="text-chamber-gold/90 text-sm font-medium">Official Event Vendor Application Portal</p>
          </div>
        </header>

        <main className="flex-grow container mx-auto px-4 py-10 max-w-3xl">
          {children}
        </main>

        <footer className="bg-chamber-black text-gray-300 border-t-2 border-chamber-gold py-8 text-center text-xs">
          <div className="max-w-4xl mx-auto px-4 space-y-3">
            <p className="font-serif-brand text-chamber-gold text-sm font-semibold tracking-wide">
              WEAVERVILLE CHAMBER OF COMMERCE
            </p>
            <p className="text-gray-400">P.O. Box 487 &bull; Weaverville, CA 96093 &bull; Contact: Magdalena Elorriaga (<a href="tel:+19099636137" className="underline decoration-chamber-gold/60 hover:text-chamber-gold">909-963-6137</a>)</p>
            <p className="pt-2 text-gray-500">
              <a
                href="https://weavervilleca.org"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-chamber-gold/60 hover:text-chamber-gold transition-colors"
              >
                Return to Main Chamber Website (weavervilleca.org)
              </a>
            </p>
          </div>
          <WcocFooterCredit className="mx-auto mt-5 max-w-4xl border-t border-chamber-gold/20 px-4 pt-4" textClass="text-gray-400" mutedClass="text-gray-500" linkClass="hover:text-chamber-gold" />
        </footer>
      </body>
    </html>
  );
}