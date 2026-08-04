// components/ui/ChainBadge.tsx
// Reusable UI Badge displaying a chain icon and shortname with distinct HSL border glows

'use client';

import React from 'react';
import { getChainById } from '../../constants/chains';

interface ChainBadgeProps {
  chainId: number;
  className?: string;
}

export default function ChainBadge({ chainId, className = '' }: ChainBadgeProps) {
  const chain = getChainById(chainId);

  if (!chain) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-xl bg-white/[0.02] border border-white/[0.06] px-2.5 py-1 text-xs font-semibold text-white select-none ${className}`}
      style={{
        boxShadow: `0 0 10px ${chain.color}15`,
        borderColor: `${chain.color}30`
      }}
    >
      <img
        src={chain.iconUrl}
        alt={chain.name}
        className="h-3.5 w-3.5 object-contain rounded-full"
        onError={(e) => {
          (e.target as HTMLElement).style.display = 'none';
        }}
      />
      <span>{chain.shortName}</span>
    </span>
  );
}
