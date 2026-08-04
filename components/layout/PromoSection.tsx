// components/layout/PromoSection.tsx
// Redesigned Promo Section displaying key advantages matching ArcShift brand identity (Warm gold & teal accents)

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Shield, DollarSign } from 'lucide-react';

interface PromoSectionProps {
  theme?: 'dark' | 'light';
}

export default function PromoSection({ theme = 'light' }: PromoSectionProps) {
  const isDark = theme === 'dark';

  const cardBg = isDark
    ? 'bg-[#141209] border-[#C8922A]/15 hover:border-[#C8922A]/40'
    : 'bg-white border-[#E8E6DF] hover:border-[#C8922A]/35';
  const headingColor = isDark ? 'text-[#F5F0E8]' : 'text-[#12141A]';
  const descColor = isDark ? 'text-[#A09880]' : 'text-[#5C6470]';
  const iconBg = isDark ? 'bg-[#C8922A]/15 text-[#D4A043]' : 'bg-[#C8922A]/10 text-[#C8922A]';

  return (
    <div className="w-full max-w-5xl mx-auto py-8 sm:py-12 px-4 select-none">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6"
      >

        {/* CARD 1: Subsecond Finality */}
        <div className={`${cardBg} border rounded-[18px] p-5 sm:p-6 transition-all duration-300 flex flex-col cursor-default shadow-sm hover:shadow-md group`}>
          <div className={`flex h-10 w-10 items-center justify-center rounded-[10px] ${iconBg} mb-4 flex-shrink-0 transition-transform duration-300 group-hover:scale-110`}>
            <Zap className="h-[20px] w-[20px]" />
          </div>
          <h4 className={`text-[15px] font-bold ${headingColor} mb-2`}>
            Subsecond finality
          </h4>
          <p className={`text-[13px] font-medium ${descColor} leading-[1.6]`}>
            Arc confirms transactions in under 1 second. No waiting, no uncertainty — your USDC lands instantly.
          </p>
        </div>

        {/* CARD 2: USDC as Gas */}
        <div className={`${cardBg} border rounded-[18px] p-5 sm:p-6 transition-all duration-300 flex flex-col cursor-default shadow-sm hover:shadow-md group`}>
          <div className={`flex h-10 w-10 items-center justify-center rounded-[10px] ${iconBg} mb-4 flex-shrink-0 transition-transform duration-300 group-hover:scale-110`}>
            <DollarSign className="h-[20px] w-[20px]" />
          </div>
          <h4 className={`text-[15px] font-bold ${headingColor} mb-2`}>
            USDC as Gas
          </h4>
          <p className={`text-[13px] font-medium ${descColor} leading-[1.6]`}>
            Arc is the only chain where USDC pays for gas. No ETH or native chain token needed, ever. Pure stablecoin finance.
          </p>
        </div>

        {/* CARD 3: Secured by CCTP */}
        <div className={`${cardBg} border rounded-[18px] p-5 sm:p-6 transition-all duration-300 flex flex-col cursor-default shadow-sm hover:shadow-md group`}>
          <div className={`flex h-10 w-10 items-center justify-center rounded-[10px] ${iconBg} mb-4 flex-shrink-0 transition-transform duration-300 group-hover:scale-110`}>
            <Shield className="h-[20px] w-[20px]" />
          </div>
          <h4 className={`text-[15px] font-bold ${headingColor} mb-2`}>
            Secured by CCTP
          </h4>
          <p className={`text-[13px] font-medium ${descColor} leading-[1.6]`}>
            Circle's Cross Chain Transfer Protocol burns and natively mints USDC — no wrapped assets, no bridges to hack.
          </p>
        </div>

      </motion.div>
    </div>
  );
}
