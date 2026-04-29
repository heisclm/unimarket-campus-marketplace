'use client';

import { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true); // Default true to avoid flash
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    const standsAlone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone 
      || document.referrer.includes('android-app://');
    
    setIsStandalone(standsAlone);

    if (standsAlone) {
      return; // Already installed
    }

    const hasDismissed = localStorage.getItem('pwa_prompt_dismissed_v2');
    
    // iOS detection
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIOSDevice);

    if (!hasDismissed) {
      // Show immediately on all platforms since we want the users to see it
      // if beforeinstallprompt fires later, we will have the event ready.
      setTimeout(() => setIsVisible(true), 3000); 
    }

    const handler = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIos) {
      setShowInstructions(true);
      return;
    }

    if (!deferredPrompt) {
       // If Chrome hasn't fired the event yet or it's unavailable, show manual instructions
       setShowInstructions(true);
       return;
    }
    
    try {
      // Show the install prompt
      await deferredPrompt.prompt();
      
      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setIsVisible(false);
      }
      
      // We no longer need the prompt
      setDeferredPrompt(null);
    } catch (err) {
      console.error('Failed to trigger install prompt', err);
      setShowInstructions(true);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('pwa_prompt_dismissed_v2', 'true');
  };

  if (isStandalone) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 150, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 150, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="fixed bottom-24 md:bottom-8 left-4 right-4 md:left-auto md:right-8 z-[100] md:w-96"
        >
          <div className="bg-black text-white p-4 sm:p-5 rounded-[2rem] shadow-2xl flex flex-col gap-3 relative overflow-hidden border border-white/10">
            <button 
              onClick={handleDismiss}
              className="absolute top-4 right-4 text-white/50 hover:text-white p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex gap-4 items-center pr-8">
              <div className="w-14 h-14 bg-white rounded-2xl flex-shrink-0 flex items-center justify-center p-1.5 shadow-inner">
                 <Image src="/icon-192.png" width={48} height={48} alt="UniMart Logo" className="rounded-xl w-full h-full object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-lg leading-tight tracking-tight">Install UniMart App</span>
                <span className="text-sm text-white/70 leading-tight mt-0.5">Faster experience & offline access</span>
              </div>
            </div>
            
            {showInstructions ? (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-2 bg-white/10 rounded-2xl p-4 text-sm text-white/90"
              >
                {isIos ? (
                  <>
                    <p className="flex items-center gap-2 mb-2 font-medium">To install on iOS:</p>
                    <p className="flex items-center gap-2">
                      1. Tap <Share className="w-4 h-4 inline" /> in the safari toolbar
                    </p>
                    <p className="mt-2 flex items-center gap-2">
                      2. Scroll down and tap <PlusSquare className="w-4 h-4 inline" /> <span className="font-bold">Add to Home Screen</span>
                    </p>
                  </>
                ) : (
                  <>
                    <p className="flex items-center gap-2 mb-2 font-medium">To install the app:</p>
                    <p className="flex items-center gap-2">
                      Tap the browser menu (⋮) and select <span className="font-bold">Add to Home screen</span> or <span className="font-bold">Install app</span>.
                    </p>
                  </>
                )}
              </motion.div>
            ) : (
               <button
                 onClick={handleInstallClick}
                 className="w-full bg-white text-black py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors mt-2 active:scale-[0.98]"
               >
                 <Download className="w-5 h-5" /> Install App
               </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
