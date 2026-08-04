// components/bridge/SwapChainsBtn.tsx
// Centered swap button styled as a clean dark rounded-xl overlapping box with an emerald icon

'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpDown } from 'lucide-react';

interface SwapChainsBtnProps {
  onClick: () => void;
  disabled?: boolean;
}

export default function SwapChainsBtn({ onClick, disabled = false }: SwapChainsBtnProps) {
  const [rotation, setRotation] = useState(0);

  const handleSwapClick = () => {
    if (disabled) return;
    setRotation(prev => prev + 180);
    onClick();
  };

  return (
    <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-20 select-none">
      <motion.button
        type="button"
        disabled={disabled}
        onClick={handleSwapClick}
        animate={{ rotate: rotation }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#0F172A] border border-[#1E293B] hover:border-[#10B981] text-slate-400 hover:text-[#10B981] transition-colors cursor-pointer"
        style={{ outline: 'none' }}
      >
        <ArrowUpDown className="h-4 w-4" />
      </motion.button>
    </div>
  );
}
