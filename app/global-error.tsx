'use client';

import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-white">
          <div className="text-center">
            <h1 className="text-4xl font-black text-gray-900 mb-4">Critical Error</h1>
            <p className="text-gray-500 mb-8 max-w-sm mx-auto">
              A fatal error occurred at the application root. Please reload the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-8 py-4 bg-black text-white font-bold rounded-xl hover:bg-gray-800 transition-colors"
            >
              Reload System
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
