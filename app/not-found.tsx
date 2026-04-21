'use client';

import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-4">
      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
        <FileQuestion className="w-10 h-10 text-gray-400" />
      </div>
      <h2 className="text-3xl font-black tracking-tight text-gray-900 mb-2">
        Page Not Found
      </h2>
      <p className="text-gray-500 text-center max-w-md mx-auto mb-8">
        The link you followed might be broken, or the page may have been removed.
      </p>
      <Link 
        href="/" 
        className="px-6 py-3 bg-black text-white font-bold rounded-xl hover:bg-gray-800 transition-colors"
      >
        Return Home
      </Link>
    </div>
  );
}
