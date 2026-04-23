'use client';

import { useState, useEffect } from 'react';
import SplashScreen from './SplashScreen';
import PageTransition from './PageTransition';

export default function AppWrapper({ children }: { children: React.ReactNode }) {
  const [isSplashComplete, setIsSplashComplete] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Failsafe: Force show app after 2.5 seconds no matter what
    const failsafe = setTimeout(() => {
      setIsMounted(true);
      setIsSplashComplete(true);
    }, 2500);

    const timer = setTimeout(() => {
      setIsMounted(true);
      if (sessionStorage.getItem('hasSeenSplash')) {
        setIsSplashComplete(true);
      }
    }, 0);
    
    return () => {
      clearTimeout(timer);
      clearTimeout(failsafe);
    };
  }, []);

  const handleSplashComplete = () => {
    setIsSplashComplete(true);
    sessionStorage.setItem('hasSeenSplash', 'true');
  };

  // During SSR and first client render, we must match the server (show splash if not complete)
  // But we use isMounted to ensure we don't trigger hydration mismatch
  return (
    <div className="contents">
      {isMounted && !isSplashComplete && <SplashScreen onComplete={handleSplashComplete} />}
      {children}
    </div>
  );
}
