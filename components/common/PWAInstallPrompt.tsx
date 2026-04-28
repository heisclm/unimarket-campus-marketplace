'use client';

import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
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

  useEffect(() => {
    const handler = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Check if user previously dismissed it
      const hasDismissed = localStorage.getItem('pwa_prompt_dismissed');
      if (!hasDismissed) {
        setIsVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
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

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="fixed bottom-24 md:bottom-8 left-4 right-4 md:left-auto md:right-8 z-[100] md:w-80"
        >
          <div className="bg-black text-white p-4 rounded-2xl shadow-2xl flex flex-col gap-3 relative overflow-hidden">
            <button 
              onClick={handleDismiss}
              className="absolute top-2 right-2 text-white/50 hover:text-white p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex gap-4 items-center pr-6">
              <div className="w-12 h-12 bg-white rounded-xl flex-shrink-0 flex items-center justify-center p-1">
                 <Image src="/icon-192.png" width={40} height={40} alt="UniMart Logo" className="rounded-lg" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg leading-tight">Install UniMart</span>
                <span className="text-sm text-white/70 leading-tight">Fast, offline, and secure</span>
              </div>
            </div>
            <button
              onClick={handleInstallClick}
              className="w-full bg-white text-black py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors mt-2"
            >
              <Download className="w-4 h-4" /> Add to Home Screen
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
