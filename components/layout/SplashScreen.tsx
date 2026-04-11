'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export default function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onComplete, 500); // Wait for exit animation
    }, 2500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ 
              duration: 0.8, 
              ease: [0, 0.71, 0.2, 1.01],
              scale: {
                type: "spring",
                damping: 12,
                stiffness: 100,
                restDelta: 0.001
              }
            }}
            className="flex flex-col items-center gap-6"
          >
            <div className="w-24 h-24 bg-[#d9ff00] text-black flex items-center justify-center rounded-[2rem] font-bold text-5xl shadow-2xl shadow-[#d9ff00]/20">
              U
            </div>
            <div className="text-center">
              <motion.h1 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-white text-3xl font-bold tracking-tighter"
              >
                UniMarket<span className="text-[#d9ff00]">.</span>
              </motion.h1>
              <motion.p 
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-gray-500 text-xs font-bold uppercase tracking-[0.3em] mt-2"
              >
                Premium Campus Marketplace
              </motion.p>
            </div>
          </motion.div>

          {/* Loading Indicator */}
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: 200 }}
            transition={{ duration: 2, ease: "easeInOut" }}
            className="absolute bottom-20 h-1 bg-[#d9ff00] rounded-full overflow-hidden"
          >
            <div className="w-full h-full bg-white/20 animate-pulse" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
