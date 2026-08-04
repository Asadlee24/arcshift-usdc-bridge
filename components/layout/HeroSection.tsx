// components/layout/HeroSection.tsx
// Hero — light "precision fintech" treatment.
//
// Design decisions worth knowing:
//  - Mixed weight instead of uniform font-black. The emphasis line carries the
//    weight; the rest sits at 500-600. Uniform black at display size reads as
//    shouting and is the single most common "unpolished" tell.
//  - Optical alignment: the eyebrow and pills are centred on the text block,
//    not the viewport, so they stay aligned when copy wraps.
//  - Accent text uses --accent-green-ink (#047857), NOT #10B981. The bright
//    emerald is ~2.2:1 on white and fails WCAG AA for text; the ink variant is
//    ~4.8:1 and passes AA at these sizes. The bright value is kept for fills
//    and glows where contrast rules don't apply.

'use client';

import React from 'react';
import { Zap, DollarSign, Shield } from 'lucide-react';
import { motion } from 'framer-motion';

interface HeroSectionProps {
  theme?: 'dark' | 'light';
}

const STATS = [
  { icon: Zap, label: 'Subsecond finality' },
  { icon: DollarSign, label: '$0.01 gas' },
  { icon: Shield, label: 'CCTP secured' },
] as const;

export default function HeroSection({ theme = 'light' }: HeroSectionProps) {
  const isDark = theme === 'dark';

  const headingColor = isDark ? 'text-white' : 'text-[#12141A]';
  const descColor = isDark ? 'text-slate-400' : 'text-[#5C6470]';
  const accentColor = isDark ? 'text-[#10B981]' : 'text-[#047857]';

  const eyebrowChrome = isDark
    ? 'border-[#1E293B] bg-[#0F172A]/80 text-slate-300'
    : 'border-[#E8E8EC] bg-white/80 text-[#5C6470]';

  const pillChrome = isDark
    ? 'border-[#1E293B] bg-[#0F172A] text-slate-300'
    : 'border-[#E8E8EC] bg-white text-[#12141A]';

  // One shared spring so every element decelerates identically.
  const ease = [0.16, 1, 0.3, 1] as const;
  const rise = (delay: number) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease },
  });

  return (
    <div className="w-full select-none max-w-3xl mx-auto flex flex-col items-center text-center px-4 py-10 sm:py-14">

      {/* Eyebrow — status, not decoration. Establishes "live system". */}
      <motion.div
        {...rise(0)}
        className={`inline-flex items-center gap-2 rounded-full border ${eyebrowChrome} px-3 py-1 mb-7 backdrop-blur-sm ${
          isDark ? '' : 'shadow-crisp'
        }`}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10B981] opacity-70" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#10B981]" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
          Live on Arc Testnet
        </span>
      </motion.div>

      {/* Headline. Weight is carried by line two, not both lines. */}
      <motion.h1
        {...rise(0.08)}
        className={`${headingColor} text-[40px] sm:text-[56px] lg:text-[64px] leading-[1.02] tracking-[-0.035em] mb-5`}
      >
        <span className="block font-semibold">Bridge USDC natively.</span>
        <span
          className={`block font-bold ${accentColor}`}
          style={
            isDark
              ? undefined
              : {
                  // Subtle vertical gradient adds dimension without hurting
                  // contrast — the darkest stop is the one that matters.
                  backgroundImage:
                    'linear-gradient(180deg, #059669 0%, #047857 60%, #036249 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }
          }
        >
          At subsecond speed.
        </span>
      </motion.h1>

      {/* Subheading — measure capped near 62ch for comfortable reading. */}
      <motion.p
        {...rise(0.16)}
        className={`text-[16px] sm:text-[17px] font-normal ${descColor} max-w-[34rem] mb-9 leading-[1.65]`}
      >
        Move stablecoin liquidity across chains without wrapped assets or
        third-party liquidity pools. Settled by Circle CCTP, with gasless
        minting on Arc.
      </motion.p>

      {/* Stat row — a single grouped surface rather than three floating pills.
          Grouping reads as one deliberate component instead of scattered tags. */}
      <motion.div
        {...rise(0.24)}
        className="flex flex-wrap items-center justify-center gap-2 sm:gap-0 sm:divide-x sm:divide-[#E8E8EC] sm:rounded-full sm:border sm:border-[#E8E8EC] sm:bg-white sm:shadow-crisp sm:px-1"
        style={isDark ? { borderColor: '#1E293B', background: 'transparent' } : undefined}
      >
        {STATS.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium transition-colors duration-200 rounded-full border sm:border-0 sm:rounded-none ${pillChrome} sm:bg-transparent`}
          >
            <Icon className={`h-[15px] w-[15px] ${accentColor}`} strokeWidth={2.25} />
            <span className="whitespace-nowrap">{label}</span>
          </div>
        ))}
      </motion.div>

    </div>
  );
}
