'use client';

import { useState, useEffect } from 'react';
import SplashScreen from './SplashScreen';
import PageTransition from './PageTransition';

export default function AppWrapper({ children }: { children: React.ReactNode }) {
  const [isSplashComplete, setIsSplashComplete] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Defer state updates to avoid synchronous cascading render lint error
    // and ensure hydration completes before state changes
    const timer = setTimeout(() => {
      setIsMounted(true);
      if (sessionStorage.getItem('hasSeenSplash')) {
        setIsSplashComplete(true);
      }
    }, 0);
    
    return () => clearTimeout(timer);
  }, []);

  const handleSplashComplete = () => {
    setIsSplashComplete(true);
    sessionStorage.setItem('hasSeenSplash', 'true');
  };

  // During SSR and first client render, we must match the server (show splash if not complete)
  // But we use isMounted to ensure we don't trigger hydration mismatch
  return (
    <>
      {isMounted && !isSplashComplete && <SplashScreen onComplete={handleSplashComplete} />}
      <div className={(isMounted && isSplashComplete) ? 'opacity-100' : 'opacity-0'}>
        <PageTransition>
          {children}
        </PageTransition>
      </div>
    </>
  );
}
