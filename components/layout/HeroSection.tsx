// components/layout/HeroSection.tsx
//
// Typographic redesign: Playfair Display (display face) for the headline,
// DM Sans (body) for supporting text. Gold (#C8922A) replaces emerald as the
// hero accent — it reads as "stored value" rather than generic DeFi green.
//
// Type scale pushed further: 72px on desktop (up from 64px). The amount
// input elsewhere is the second focal point; the headline is the first.

'use client';

import React from 'react';
import { Zap, DollarSign, Shield } from 'lucide-react';
import { motion } from 'framer-motion';

interface HeroSectionProps {
  theme?: 'dark' | 'light';
}

const STATS = [
  { icon: Zap,        label: 'Subsecond finality' },
  { icon: DollarSign, label: '$0.01 gas'           },
  { icon: Shield,     label: 'CCTP secured'        },
] as const;

export default function HeroSection({ theme = 'light' }: HeroSectionProps) {
  const isDark = theme === 'dark';

  // Ink colours
  const headingColor   = isDark ? 'text-[#F5F0E8]' : 'text-[#12141A]';
  const descColor      = isDark ? 'text-[#A09880]'  : 'text-[#5C6470]';
  const goldAccent     = isDark ? '#D4A043'          : '#C8922A';
  const tealAccent     = isDark ? '#38BDF8'          : '#0C4A6E';

  const eyebrowBg   = isDark ? 'bg-[#1A170D] border-[#C8922A]/20 text-[#A09880]' : 'bg-white/90 border-[#C8922A]/20 text-[#5C6470]';
  const statsBorder = isDark ? 'border-[#C8922A]/12 bg-[#1A170D]/60' : 'border-[#E8E6DF] bg-white/80';
  const statDivider = isDark ? 'divide-[#C8922A]/10' : 'divide-[#E8E6DF]';
  const pillBg      = isDark ? 'bg-[#1A170D] border-[#C8922A]/15 text-[#A09880]' : 'bg-white border-[#E8E6DF] text-[#12141A]';

  const ease = [0.16, 1, 0.3, 1] as const;
  const rise = (delay: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, delay, ease },
  });

  return (
    <div className="w-full select-none max-w-3xl mx-auto flex flex-col items-center text-center px-4 py-12 sm:py-16">

      {/* Eyebrow pill — establishes "live system" credibility */}
      <motion.div
        {...rise(0)}
        className={`inline-flex items-center gap-2 rounded-full border ${eyebrowBg} px-3.5 py-1.5 mb-8 backdrop-blur-sm shadow-sm`}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C8922A] opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#C8922A]" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] font-body">
          Live on Arc Testnet
        </span>
      </motion.div>

      {/* Headline — Playfair Display, mixed weight, gold emphasis */}
      <motion.h1
        {...rise(0.08)}
        className={`${headingColor} font-display text-[52px] sm:text-[66px] lg:text-[74px] leading-[1.01] tracking-[-0.03em] mb-6`}
      >
        {/* Line 1 — lighter weight, ink */}
        <span className="block" style={{ fontWeight: 700 }}>
          Bridge USDC natively.
        </span>
        {/* Line 2 — heavy, gold gradient. This is the emphasis. */}
        <span
          className="block"
          style={{
            fontWeight: 900,
            backgroundImage: isDark
              ? `linear-gradient(135deg, ${goldAccent} 0%, #E8B84B 40%, ${tealAccent} 100%)`
              : `linear-gradient(135deg, #A87520 0%, ${goldAccent} 45%, #8A6510 100%)`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          At subsecond speed.
        </span>
      </motion.h1>

      {/* Subheading — DM Sans, measured line length */}
      <motion.p
        {...rise(0.16)}
        className={`text-[16px] sm:text-[18px] font-body font-normal ${descColor} max-w-[34rem] mb-10 leading-[1.70]`}
      >
        Move stablecoin liquidity across chains without wrapped assets or
        third-party liquidity pools. Settled by Circle CCTP, with gasless
        minting on Arc.
      </motion.p>

      {/* Stats row */}
      <motion.div
        {...rise(0.24)}
        className={`
          flex flex-wrap items-center justify-center gap-2
          sm:gap-0 sm:divide-x ${statDivider}
          sm:rounded-full sm:border ${statsBorder}
          sm:shadow-sm sm:px-1 backdrop-blur-sm
        `}
      >
        {STATS.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className={`
              flex items-center gap-2 px-4 py-2.5
              text-[13px] font-body font-medium
              rounded-full border sm:border-0 sm:rounded-none
              ${pillBg} sm:bg-transparent
            `}
          >
            <Icon
              className="h-[14px] w-[14px]"
              style={{ color: goldAccent }}
              strokeWidth={2.5}
            />
            <span className="whitespace-nowrap">{label}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
