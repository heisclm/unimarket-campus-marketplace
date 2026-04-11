'use client';

import { useState } from 'react';
import SplashScreen from './SplashScreen';
import PageTransition from './PageTransition';

export default function AppWrapper({ children }: { children: React.ReactNode }) {
  const [isSplashComplete, setIsSplashComplete] = useState(() => {
    if (typeof window !== 'undefined') {
      return !!sessionStorage.getItem('hasSeenSplash');
    }
    return false;
  });

  const handleSplashComplete = () => {
    setIsSplashComplete(true);
    sessionStorage.setItem('hasSeenSplash', 'true');
  };

  return (
    <>
      {!isSplashComplete && <SplashScreen onComplete={handleSplashComplete} />}
      <div className={isSplashComplete ? 'opacity-100' : 'opacity-0'}>
        <PageTransition>
          {children}
        </PageTransition>
      </div>
    </>
  );
}
