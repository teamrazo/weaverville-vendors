
import './globals.css';

import React from 'react';



export const metadata = {

  title: 'Weaverville Chamber of Commerce - Vendor Application',

  description: 'Official Vendor Application for Weaverville Chamber of Commerce Events',

};



export default function RootLayout({ children }: { children: React.ReactNode }) {

  return (

    <html lang="en">

      <body className="min-h-screen flex flex-col justify-between">

        <header className="bg-[#1b4332] text-white py-6 px-4 shadow-md text-center">

          <h1 className="text-2xl font-bold tracking-wide">WEAVERVILLE CHAMBER OF COMMERCE</h1>

          <p className="text-amber-300 text-sm font-medium mt-1">Vendor Application Portal</p>

        </header>

        <main className="flex-grow container mx-auto px-4 py-8 max-w-3xl">

          {children}

        </main>

        <footer className="bg-gray-900 text-gray-400 text-center py-6 text-xs">

          © {new Date().getFullYear()} Weaverville Chamber of Commerce • Weaverville, California • Contact: Magdalena Elorriaga (909-963-6137)

        </footer>

      </body>

    </html>

  );

}

