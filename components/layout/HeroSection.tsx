// components/layout/HeroSection.tsx
// Typographic & visual hero section: clean gold brand accents, crisp typography

'use client';

import React from 'react';
import { Zap, DollarSign, Shield } from 'lucide-react';
import { motion } from 'framer-motion';

interface HeroSectionProps {
  theme?: 'dark' | 'light';
}

const STATS = [
  { icon: Zap,        label: 'Subsecond Finality' },
  { icon: DollarSign, label: '$0.01 Gas'           },
  { icon: Shield,     label: 'CCTP Secured'        },
] as const;

export default function HeroSection({ theme = 'light' }: HeroSectionProps) {
  const isDark = theme === 'dark';

  const headingColor = isDark ? 'text-white' : 'text-slate-900';
  const descColor    = isDark ? 'text-slate-400' : 'text-slate-600';
  const goldAccent   = '#C8922A';

  const eyebrowBg   = isDark ? 'bg-slate-900/90 border-[#C8922A]/30 text-[#C8922A]' : 'bg-white border-[#C8922A]/25 text-[#C8922A]';
  const statsBorder = isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white';
  const statDivider = isDark ? 'divide-slate-800' : 'divide-slate-200';
  const pillBg      = isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900';

  const ease = [0.16, 1, 0.3, 1] as const;
  const rise = (delay: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease },
  });

  return (
    <div className="w-full select-none max-w-3xl mx-auto flex flex-col items-center text-center px-4 py-8 sm:py-12">

      {/* Eyebrow pill */}
      <motion.div
        {...rise(0)}
        className={`inline-flex items-center gap-2 rounded-full border ${eyebrowBg} px-4 py-1.5 mb-6 sm:mb-8 backdrop-blur-md shadow-sm`}
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C8922A] opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#C8922A]" />
        </span>
        <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.18em]">
          Live on Arc Testnet · CCTP v2 Auto-Relay
        </span>
      </motion.div>

      {/* Headline */}
      <motion.h1
        {...rise(0.08)}
        className={`${headingColor} font-sans font-extrabold text-[34px] sm:text-[56px] lg:text-[68px] leading-[1.05] tracking-tight mb-4 sm:mb-6 px-2`}
      >
        <span className="block font-black">
          Bridge USDC Natively.
        </span>
        <span
          className="block font-black bg-gradient-to-r from-[#F4D98A] via-[#C8922A] to-[#A6741C] bg-clip-text text-transparent"
        >
          Subsecond & Automatic.
        </span>
      </motion.h1>

      {/* Subheading */}
      <motion.p
        {...rise(0.16)}
        className={`text-[14px] sm:text-[16px] font-medium ${descColor} max-w-[34rem] mb-8 sm:mb-10 leading-[1.65] px-2`}
      >
        Move stablecoin liquidity across chains seamlessly. Circle CCTP v2 Forwarding Service auto-relays your mint for 1-signature transfers.
      </motion.p>

      {/* Stats row */}
      <motion.div
        {...rise(0.24)}
        className={`
          flex flex-wrap items-center justify-center gap-2
          sm:gap-0 sm:divide-x ${statDivider}
          sm:rounded-full sm:border ${statsBorder}
          sm:shadow-sm sm:px-1 backdrop-blur-md
        `}
      >
        {STATS.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className={`
              flex items-center gap-2 px-4 py-2 sm:py-2.5
              text-[12px] sm:text-[13px] font-bold
              rounded-full border sm:border-0 sm:rounded-none
              ${pillBg} sm:bg-transparent
            `}
          >
            <Icon
              className="h-[14px] w-[14px] text-[#C8922A]"
              strokeWidth={2.5}
            />
            <span className="whitespace-nowrap">{label}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
