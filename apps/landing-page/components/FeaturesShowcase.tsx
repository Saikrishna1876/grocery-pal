'use client';

import { motion } from 'framer-motion';
import { LineChart, Smartphone, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import ScreenshotFrame from './ScreenshotFrame';

const features = [
  {
    icon: Smartphone,
    title: 'Capture Every Expense',
    description:
      'Log spending in seconds with a mobile-first workflow that stays fast even when life gets busy.',
    color: 'bg-primary',
    screenshot: '/screenshots/capture-expense.jpg',
  },
  {
    icon: LineChart,
    title: 'See Trends Instantly',
    description:
      'Watch your monthly habits evolve with charts that make it obvious where to optimize.',
    color: 'bg-secondary',
    screenshot: '/screenshots/trends-analysis.jpg',
  },
  {
    icon: Users,
    title: 'Share With Your Circle',
    description:
      'Helps people to be on the same page, keep track of what is already bought and what should be bought.',
    color: 'bg-tertiary',
    screenshot: '/screenshots/social-sharing.jpg',
  },
];

export default function FeaturesShowcase() {
  return (
    <section className="mx-auto w-full max-w-7xl px-6 pb-32 md:px-12">
      <div className="mb-16 text-center">
        <h2 className="text-4xl font-black uppercase tracking-tighter md:text-6xl">
          Why Grocery Pal?
        </h2>
      </div>

      <div className="space-y-24">
        {features.map((feature, index) => {
          const Icon = feature.icon;
          const isEven = index % 2 === 0;

          return (
            <div
              key={feature.title}
              className={cn(
                'grid gap-12 lg:grid-cols-2 lg:items-center',
                !isEven && 'lg:direction-rtl',
              )}
            >
              <motion.div
                className={cn('flex flex-col gap-6', !isEven && 'lg:order-last')}
                initial={{ opacity: 0, x: isEven ? -50 : 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, type: 'spring' }}
              >
                <div className="brutalist-border brutalist-shadow-sm bg-primary inline-flex w-fit p-3 text-black">
                  <Icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-3xl font-black uppercase tracking-tight md:text-5xl">
                  {feature.title}
                </h3>
                <p className="text-lg font-medium leading-snug text-black/80">
                  {feature.description}
                </p>
              </motion.div>

              <div className={cn('flex justify-center', !isEven && 'lg:order-first')}>
                <ScreenshotFrame
                  src={feature.screenshot}
                  alt={feature.title}
                  delay={0.2}
                  className="max-w-lg"
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
