'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import FeaturesShowcase from '@/components/FeaturesShowcase';
import Favicon from './favicon.ico';

export default function LandingPage() {
  return (
    <main className="bg-background text-foreground relative min-h-screen w-full overflow-hidden">
      <div
        className="absolute inset-0 -z-10 opacity-20"
        style={{
          backgroundImage: 'radial-gradient(#000 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <nav className="fixed inset-x-0 top-0 z-50 px-6 py-4 md:px-12">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
          <div className="brutalist-border brutalist-shadow-sm flex items-center gap-2 bg-white px-3 py-2">
            <Image src={Favicon} alt="Favicon" className="size-6" />
            <span className="text-sm font-black uppercase tracking-tighter">Grocery Pal</span>
          </div>
          <Link href="mailto:saikrishna.ambeti.1876@gmail.com">
            <button
              type="button"
              className="brutalist-border bg-primary brutalist-shadow-sm px-4 py-2 text-xs font-black uppercase tracking-wide text-white transition-all hover:-translate-x-1 hover:-translate-y-1 active:translate-x-0 active:translate-y-0 active:shadow-none"
            >
              Get Early Access
            </button>
          </Link>
        </div>
      </nav>

      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-center px-6 pb-24 pt-36 md:px-12">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, type: 'spring' }}
            className="relative"
          >
            <div className="bg-secondary brutalist-border brutalist-shadow absolute -left-8 -top-8 -z-10 h-24 w-24" />

            <p className="brutalist-border mb-6 inline-block bg-white px-4 py-1 text-xs font-black uppercase tracking-widest">
              Stop Guessing, Start Tracking
            </p>
            <h1 className="text-balance text-6xl font-black leading-[0.9] tracking-tighter sm:text-7xl md:text-8xl">
              Make every <span className="bg-primary px-2 text-white">rupee</span> visible.
            </h1>
            <p className="mt-8 max-w-xl text-xl font-medium leading-tight text-black/80">
              Grocery Pal is the unapologetically simple way to manage your money. No fluff, no
              complex menus, just pure financial clarity.
            </p>
            <div className="mt-10 flex flex-col gap-6 sm:flex-row sm:items-center">
              <Link href="mailto:saikrishna.ambeti.1876@gmail.com">
                <button
                  type="button"
                  className="brutalist-border bg-primary brutalist-shadow flex items-center justify-center gap-2 px-8 py-4 text-lg font-black uppercase tracking-tight text-white transition-all hover:-translate-x-1 hover:-translate-y-1 active:translate-x-0 active:translate-y-0 active:shadow-none"
                >
                  Get Early Access
                </button>
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8, rotate: 5 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.6, type: 'spring' }}
            className="relative hidden lg:block"
          >
            <div className="brutalist-border brutalist-shadow rotate-3 bg-white p-4">
              <div className="bg-foreground rounded-sm p-4 font-mono text-sm text-white">
                <div className="mb-2 flex justify-between">
                  <span>Total Spent:</span>
                  <span className="text-primary">₹45,200</span>
                </div>
                <div className="mb-4 h-1 w-full bg-white/20">
                  <div className="bg-primary h-1 w-3/4" />
                </div>
                <div className="space-y-2 opacity-80">
                  <div className="flex justify-between text-xs">
                    <span>Groceries</span>
                    <span>- ₹1,200</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Rent</span>
                    <span>- ₹15,000</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Coffee</span>
                    <span>- ₹450</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="brutalist-border bg-secondary brutalist-shadow absolute -bottom-6 -right-6 -rotate-6 p-4 text-white">
              <span className="text-xs font-black uppercase">Budget Alert!</span>
            </div>
          </motion.div>
        </div>
      </section>

      <FeaturesShowcase />

      <footer className="brutalist-border bg-white py-12 text-center">
        <p className="text-sm font-black uppercase tracking-widest">
          © 2026 Grocery Pal — Built for the bold.
        </p>
        <div className="mt-4 flex flex-col items-center justify-center gap-2">
          <p className="text-xs font-bold uppercase">Open Source under MIT License</p>
          <a
            href="https://github.com/Saikrishna1876/grocery-pal"
            target="_blank"
            rel="noopener noreferrer"
            className="brutalist-border bg-secondary brutalist-shadow-sm px-4 py-1 text-xs font-black uppercase transition-all hover:-translate-x-1 hover:-translate-y-1 active:translate-x-0 active:translate-y-0 active:shadow-none"
          >
            GitHub Repository
          </a>
        </div>
      </footer>
    </main>
  );
}
