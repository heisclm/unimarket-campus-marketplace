'use client';

import { useState } from 'react';
import Image, { ImageProps } from 'next/image';
import { Image as ImageIcon } from 'lucide-react';

interface PremiumImageProps extends Omit<ImageProps, 'onLoad' | 'onError'> {
  fallbackSrc?: string;
  containerClassName?: string;
  showSkeleton?: boolean;
}

export default function PremiumImage({
  src,
  alt,
  className = '',
  containerClassName = '',
  fallbackSrc,
  showSkeleton = true,
  ...props
}: PremiumImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [prevSrc, setPrevSrc] = useState(src);

  // Reset state when src changes to prevent "ghosting" of previous images
  // This pattern is recommended by React for adjusting state when a prop changes
  if (src !== prevSrc) {
    setPrevSrc(src);
    setIsLoaded(false);
    setHasError(false);
  }

  // If no source is provided and we aren't showing a skeleton, show fallback/icon
  if (!src && !showSkeleton) {
    return (
      <div className={`absolute inset-0 flex items-center justify-center bg-gray-100 ${containerClassName}`}>
        {fallbackSrc ? (
          <Image src={fallbackSrc} alt={alt} {...props} className={className} />
        ) : (
          <ImageIcon className="w-8 h-8 text-gray-300" />
        )}
      </div>
    );
  }

  return (
    <div className={`absolute inset-0 overflow-hidden ${containerClassName}`}>
      {/* Skeleton Loader - Show if not loaded OR if src is missing but showSkeleton is true */}
      {((!isLoaded && !hasError) || (!src && showSkeleton)) && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse z-0" />
      )}

      {/* Actual Image */}
      {src && !hasError ? (
        <Image
          src={src}
          alt={alt}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className={`
            ${className}
            transition-opacity duration-500 ease-in-out
            ${isLoaded ? 'opacity-100 z-10' : 'opacity-0 z-0'}
          `}
          {...props}
        />
      ) : hasError ? (
        /* Fallback UI */
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          {fallbackSrc ? (
            <Image src={fallbackSrc} alt={alt} {...props} className={className} />
          ) : (
            <ImageIcon className="w-8 h-8 text-gray-300" />
          )}
        </div>
      ) : null}
    </div>
  );
}
