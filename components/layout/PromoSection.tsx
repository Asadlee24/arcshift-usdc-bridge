// components/layout/PromoSection.tsx
// Redesigned Promo Section displaying marketing advantages matching ArcID style (Supports dark/light theme and clean graphics)

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Shield, DollarSign } from 'lucide-react';

interface PromoSectionProps {
  theme?: 'dark' | 'light';
}

export default function PromoSection({ theme = 'light' }: PromoSectionProps) {
  const isDark = theme === 'dark';

  const cardBg = isDark ? 'bg-[#0F172A] border-[#1E293B]' : 'bg-white border-slate-200';
  const headingColor = isDark ? 'text-white' : 'text-slate-900';
  const descColor = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="w-full max-w-5xl mx-auto py-10 px-4 select-none">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >

        {/* CARD 1: Subsecond Finality */}
        <div className={`${cardBg} border hover:border-[#10B981]/30 rounded-[16px] p-5 transition-colors duration-150 flex flex-col cursor-default shadow-sm hover:shadow-md`}>
          <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[#10B981]/15 mb-4 flex-shrink-0">
            <Zap className="h-[18px] w-[18px] text-[#10B981]" />
          </div>
          <h4 className={`text-[14px] font-bold ${headingColor} mb-1.5`}>
            Subsecond finality
          </h4>
          <p className={`text-[12px] font-medium ${descColor} leading-[1.6]`}>
            Arc confirms transactions in under 1 second. No waiting, no uncertainty — your USDC lands instantly.
          </p>
        </div>

        {/* CARD 2: USDC as Gas */}
        <div className={`${cardBg} border hover:border-[#10B981]/30 rounded-[16px] p-5 transition-colors duration-150 flex flex-col cursor-default shadow-sm hover:shadow-md`}>
          <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[#10B981]/15 mb-4 flex-shrink-0">
            <DollarSign className="h-[18px] w-[18px] text-[#10B981]" />
          </div>
          <h4 className={`text-[14px] font-bold ${headingColor} mb-1.5`}>
            USDC as Gas
          </h4>
          <p className={`text-[12px] font-medium ${descColor} leading-[1.6]`}>
            Arc is the only chain where USDC pays for gas. No ETH or native chain token needed, ever. Pure stablecoin finance.
          </p>
        </div>

        {/* CARD 3: Secured by CCTP */}
        <div className={`${cardBg} border hover:border-[#10B981]/30 rounded-[16px] p-5 transition-colors duration-150 flex flex-col cursor-default shadow-sm hover:shadow-md`}>
          <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[#10B981]/15 mb-4 flex-shrink-0">
            <Shield className="h-[18px] w-[18px] text-[#10B981]" />
          </div>
          <h4 className={`text-[14px] font-bold ${headingColor} mb-1.5`}>
            Secured by CCTP
          </h4>
          <p className={`text-[12px] font-medium ${descColor} leading-[1.6]`}>
            Circle's Cross Chain Transfer Protocol burns and natively mints USDC — no wrapped assets, no bridges to hack.
          </p>
        </div>

      </motion.div>
    </div>
  );
}
