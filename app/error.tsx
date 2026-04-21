'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('App Error:', error);

    // Auto-recover Vercel Chunk Skews / Missing RSC failures
    if (error.message.includes('Failed to fetch') || error.message.includes('ChunkLoadError') || error.message.includes('Unexpected token')) {
      window.location.reload();
    }
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-4">
      <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
        <AlertCircle className="w-10 h-10 text-red-500" />
      </div>
      <h2 className="text-2xl font-black tracking-tight text-gray-900 mb-2">
        Something went wrong!
      </h2>
      <p className="text-gray-500 text-center max-w-md mx-auto mb-8">
        We encountered an unexpected error while trying to load this page. This often happens if the app was just updated.
      </p>
      <div className="flex items-center gap-4">
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-[#d9ff00] text-black font-bold rounded-xl hover:bg-[#c4e600] transition-colors"
        >
          Refresh Page
        </button>
        <Link 
          href="/" 
          className="px-6 py-3 bg-white border border-gray-200 text-gray-900 font-bold rounded-xl hover:bg-gray-50 transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
