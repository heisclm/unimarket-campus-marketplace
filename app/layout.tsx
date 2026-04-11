import type {Metadata, Viewport} from 'next';
import './globals.css'; // Global styles
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { CartProvider } from '@/components/cart/CartProvider';
import Chatbot from '@/components/chat/Chatbot';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: 'UniMarket - Campus Marketplace',
  description: 'A modern, secure campus marketplace for students and vendors to buy, sell, and auction products with a vibrant community board.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'UniMarket',
  },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body className="bg-[#f4f4f0] min-h-screen font-sans text-gray-900 antialiased" suppressHydrationWarning>
        <AuthProvider>
          <CartProvider>
            <ErrorBoundary>
              <div className="flex flex-col min-h-screen">
                <Navbar />
                <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
                  {children}
                </main>
                <div className="hidden md:block">
                  <Footer />
                </div>
                <BottomNav />
              </div>
              <Chatbot />
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
            </ErrorBoundary>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
