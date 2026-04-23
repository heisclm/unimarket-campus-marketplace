'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export function RouteLogger() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    console.log(`[UniMart Router] Navigated successfully to: ${pathname}?${searchParams}`);
    // If you see this log, the router didn't crash. 
    // If a page turns blank but you NEVER see this log, the incoming page component threw an unhandled error during render.
  }, [pathname, searchParams]);

  return null;
}
