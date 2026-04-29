'use client';

import { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';
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

  useEffect(() => {
    // Check if app is already installed
    const standsAlone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone 
      || document.referrer.includes('android-app://');
    
    setIsStandalone(standsAlone);

    if (standsAlone) {
      return; // Already installed
    }

    const hasDismissed = localStorage.getItem('pwa_prompt_dismissed');
    
    // iOS detection
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIOSDevice);

    if (isIOSDevice && !hasDismissed) {
      // Show immediately on iOS since it has no beforeinstallprompt event
      setTimeout(() => setIsVisible(true), 2000); 
    }

    const handler = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      if (!hasDismissed) {
        setIsVisible(true);
      }
    };

    const customShowHandler = () => {
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('show-install-prompt', customShowHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('show-install-prompt', customShowHandler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIos) {
      // Just dismiss the banner for iOS (they have to follow the visual instructions)
      setIsVisible(false);
      return;
    }

    if (!deferredPrompt) {
      // Fallback for iframe/preview or browsers that don't support the programmatic prompt
      alert("To install this app, click the 'Install' icon (a monitor with a down arrow) in your browser's address bar, or use the 'Add to Home Screen' option in your browser menu. If you are previewing inside a frame, you must first open the app in a new tab.");
      setIsVisible(false);
      return;
    }
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    // We no longer need the prompt, whether accepted or dismissed
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('pwa_prompt_dismissed', 'true');
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
          className="fixed bottom-24 md:bottom-8 left-4 right-4 md:left-auto md:right-8 z-[100] md:w-80"
        >
          <div className="bg-black text-white p-4 sm:p-5 rounded-box shadow-2xl flex flex-col gap-3 relative overflow-hidden border border-white/10">
            <button 
              onClick={handleDismiss}
              className="absolute top-3 right-3 text-white/50 hover:text-white p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex gap-4 items-center pr-8">
              <div className="w-14 h-14 bg-white rounded-2xl flex-shrink-0 flex items-center justify-center p-1.5 shadow-inner">
                 <Image src="/icon-192.png" width={48} height={48} alt="UniMart Logo" className="rounded-xl w-full h-full object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-lg leading-tight tracking-tight">Install UniMart</span>
                <span className="text-sm text-white/70 leading-tight mt-0.5">Fast, offline, and secure</span>
              </div>
            </div>
            
            {isIos ? (
              <div className="mt-2 bg-white/10 rounded-xl p-3 text-sm text-white/90">
                <p className="flex items-center gap-2">
                  1. Tap <Share className="w-4 h-4 inline" /> in the toolbar
                </p>
                <p className="mt-1 flex items-center gap-2">
                  2. Scroll down and tap <span className="font-bold">Add to Home Screen</span>
                </p>
              </div>
            ) : (
               <button
                 onClick={handleInstallClick}
                 className="w-full bg-white text-black py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors mt-2 active:scale-[0.98]"
               >
                 <Download className="w-5 h-5" /> Add to Home Screen
               </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
