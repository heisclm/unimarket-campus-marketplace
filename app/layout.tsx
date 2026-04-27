import type {Metadata, Viewport} from 'next';
import './globals.css'; // Global styles
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import SideNav from '@/components/layout/SideNav';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { CartProvider } from '@/components/cart/CartProvider';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { Toaster } from 'react-hot-toast';
import { Suspense } from 'react';

import AppWrapper from '@/components/layout/AppWrapper';
import { RouteLogger } from '@/components/common/RouteLogger';

export const metadata: Metadata = {
  title: {
    default: 'UniMart - The Campus Marketplace',
    template: '%s | UniMart',
  },
  description: 'The ultimate, secure campus marketplace for students. Buy, sell, trade, and auction items safely with escrow protection.',
  keywords: ['student marketplace', 'campus store', 'buy textbooks', 'student discounts', 'unimart'],
  authors: [{ name: 'UniMart Team' }],
  creator: 'UniMart',
  metadataBase: new URL(process.env.APP_URL || 'https://unimart.local'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    title: 'UniMart - The Campus Marketplace',
    description: 'The ultimate, secure campus marketplace for students. Buy, sell, trade, and auction items safely with escrow protection.',
    siteName: 'UniMart',
    images: [{
      url: '/og-image.jpg', // You will need to add this asset
      width: 1200,
      height: 630,
      alt: 'UniMart Preview',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'UniMart - The Campus Marketplace',
    description: 'The ultimate, secure campus marketplace for students. Buy, sell, trade, and auction items safely.',
    images: ['/og-image.jpg'],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'UniMart',
    startupImage: ['/icon.svg'],
  },
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans min-h-screen bg-[#f4f4f0] text-gray-900 overflow-x-hidden antialiased">
        <ErrorBoundary>
          <AuthProvider>
            <CartProvider>
              <AppWrapper>
                <div className="flex flex-col h-[100dvh] overflow-hidden bg-[#f4f4f0]">
                  <Navbar />
                  <div className="flex-1 flex overflow-hidden">
                     <SideNav />
                     <div className="flex-1 overflow-y-auto pb-20 md:pb-0 scroll-smooth">
                        <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 md:pl-8">
                          <Suspense fallback={null}>
                            {children}
                          </Suspense>
                        </main>
                        <div className="hidden lg:block">
                          <Footer />
                        </div>
                     </div>
                  </div>
                  <BottomNav />
                </div>
                <Toaster 
                  position="bottom-right"
                  toastOptions={{
                    duration: 4000,
                    style: {
                      background: '#fff',
                      color: '#000',
                      borderRadius: '1rem',
                      padding: '1rem',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    },
                  }}
                />
                <Suspense fallback={null}>
                  <RouteLogger />
                </Suspense>
              </AppWrapper>
            </CartProvider>
          </AuthProvider>
        </ErrorBoundary>
        <Analytics />
      </body>
    </html>
  );
}
