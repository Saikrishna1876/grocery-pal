'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { cn } from '@/lib/utils'; // I should check if this exists, if not I'll use a simple concat or create it.

interface ScreenshotFrameProps {
  src: string;
  alt: string;
  className?: string;
  delay?: number;
}

export default function ScreenshotFrame({ src, alt, className, delay = 0 }: ScreenshotFrameProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, rotate: 2 }}
      whileInView={{ opacity: 1, y: 0, rotate: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay, type: 'spring' }}
      className={cn(
        'brutalist-border brutalist-shadow relative mx-auto max-w-[320px] rounded-[2.5rem] bg-white p-3 transition-transform hover:-rotate-1',
        className,
      )}
    >
      <div className="brutalist-border bg-foreground aspect-1080/2300 max-h-150 rounded-4xl relative flex flex-col overflow-hidden">
        <Image
          src={src}
          alt={alt}
          width={800}
          height={600}
          className="h-full w-full object-cover"
          priority
        />
        {/* Home Indicator */}
        {/* <div className="absolute bottom-2 left-1/2 h-1 w-24 -translate-x-1/2 rounded-full bg-white/30" /> */}
      </div>
      {/* Speaker/Camera Notch */}
      <div className="bg-foreground absolute left-1/2 top-4 z-10 h-4 w-16 -translate-x-1/2 rounded-full" />
    </motion.div>
  );
}
