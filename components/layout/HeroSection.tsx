// components/layout/HeroSection.tsx
// Redesigned Hero Section tailored for a premium dark-mode DeFi bridge experience matching ArcID (Supports dark/light mode)

'use client';

import React from 'react';
import { Zap, DollarSign, Shield } from 'lucide-react';
import { motion } from 'framer-motion';

interface HeroSectionProps {
  theme?: 'dark' | 'light';
}

export default function HeroSection({ theme = 'light' }: HeroSectionProps) {
  const isDark = theme === 'dark';

  const headingColor = isDark ? 'text-white' : 'text-slate-900';
  const descColor = isDark ? 'text-slate-400' : 'text-slate-500';
  const pillBg = isDark ? 'bg-[#0F172A] border-[#1E293B] text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700';

  return (
    <div className="w-full text-center py-6 select-none max-w-2xl mx-auto flex flex-col items-center">
      
      {/* Headline */}
      <motion.h1
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className={`text-[38px] sm:text-[44px] font-black tracking-tight ${headingColor} leading-[1.1] mb-3`}
      >
        Bridge USDC Natively.
        <br />
        <span className="text-[#10B981]">Sub Second Speed.</span>
      </motion.h1>

      {/* Subheading */}
      <motion.p
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
        className={`text-base font-medium ${descColor} max-w-md mb-6 leading-relaxed`}
      >
        Natively transfer stablecoin liquidity across chains instantly. Powered by Circle CCTP consensus with gasless minting on Arc.
      </motion.p>

      {/* Stat Pills */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
        className="flex flex-wrap items-center justify-center gap-3"
      >
        <div className={`flex items-center gap-1.5 rounded-full ${pillBg} px-3.5 py-1.5 text-xs font-semibold hover:scale-105 transition-transform duration-200`}>
          <Zap className="h-3.5 w-3.5 text-[#10B981]" />
          <span>Subsecond finality</span>
        </div>
        <div className={`flex items-center gap-1.5 rounded-full ${pillBg} px-3.5 py-1.5 text-xs font-semibold hover:scale-105 transition-transform duration-200`}>
          <DollarSign className="h-3.5 w-3.5 text-[#10B981]" />
          <span>$0.01 Gas</span>
        </div>
        <div className={`flex items-center gap-1.5 rounded-full ${pillBg} px-3.5 py-1.5 text-xs font-semibold hover:scale-105 transition-transform duration-200`}>
          <Shield className="h-3.5 w-3.5 text-[#10B981]" />
          <span>CCTP Secured</span>
        </div>
      </motion.div>

    </div>
  );
}
