'use client';

import { useEffect } from 'react';
import { RefreshCcw, AlertOctagon } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('GLOBAL APPLICATION ERROR:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center mb-6">
        <AlertOctagon size={40} />
      </div>
      
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Something went wrong</h1>
      <p className="text-gray-500 max-w-md mb-8">
        UniMart encountered an unexpected error. This might be due to a poor connection or temporary server issue.
      </p>

      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={() => reset()}
          className="bg-black text-white px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-all active:scale-95"
        >
          <RefreshCcw size={18} />
          Try Again
        </button>
        
        <button
          onClick={() => window.location.href = '/'}
          className="bg-gray-100 text-gray-900 px-8 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all active:scale-95"
        >
          Go Home
        </button>
      </div>

      <div className="mt-12 pt-8 border-t border-gray-100 w-full max-w-xs">
        <p className="text-[10px] text-gray-400 font-mono uppercase tracking-widest leading-loose">
          Error Digest<br />
          {error.digest || 'no-digest-available'}
        </p>
      </div>
    </div>
  );
}
