import './globals.css';
import React from 'react';

export const metadata = {
  title: 'Weaverville Chamber of Commerce - Event Vendor Portal',
  description: 'Official Event Vendor Application for the Weaverville Chamber of Commerce',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
            <p className="text-gray-400">P.O. Box 487 &bull; Weaverville, CA 96093 &bull; Contact: Magdalena Elorriaga (909-963-6137)</p>
            <p className="pt-2 text-gray-500">
              <a
                href="https://weavervilleca.org"
                target="_blank"
                rel="noreferrer"
                className="underline decoration-chamber-gold/60 hover:text-chamber-gold transition-colors"
              >
                Return to Main Chamber Website (weavervilleca.org)
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
