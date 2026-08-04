// components/ui/USDCAmount.tsx
// Reusable UI element to render USDC amounts with official circular coin badges in a tabular-numeric font

'use client';

import React from 'react';

interface USDCAmountProps {
  amount: string | number;
  showIcon?: boolean;
  className?: string;
}

export default function USDCAmount({ amount, showIcon = true, className = '' }: USDCAmountProps) {
  const formattedVal = typeof amount === 'number' ? amount.toFixed(2) : parseFloat(amount || '0').toFixed(2);

  return (
    <div className={`inline-flex items-center gap-1.5 font-bold tabular-nums ${className}`}>
      {showIcon && (
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-usdc-blue shadow-md shadow-usdc-blue/15 select-none">
          <span className="text-[9px] font-black text-white">$</span>
        </div>
      )}
      <span className="text-white">{formattedVal} <span className="text-[10px] text-text-muted font-medium tracking-wide">USDC</span></span>
    </div>
  );
}
