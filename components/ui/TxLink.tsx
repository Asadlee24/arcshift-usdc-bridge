// components/ui/TxLink.tsx
// Reusable UI link that formats transaction hashes and maps them to their respective block explorers with copy features

'use client';

import React, { useState } from 'react';
import { ExternalLink, Copy, Check } from 'lucide-react';

interface TxLinkProps {
  txHash: string;
  explorerUrl: string;
  className?: string;
}

export default function TxLink({ txHash, explorerUrl, className = '' }: TxLinkProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const truncatedHash = txHash.substring(0, 6) + '...' + txHash.substring(txHash.length - 4);

  return (
    <div className={`inline-flex items-center gap-2 font-mono text-xs font-semibold ${className}`}>
      {/* Explorer Link */}
      <a
        href={`${explorerUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-arc-cyan hover:underline flex items-center gap-1 transition-all"
      >
        <span>{truncatedHash}</span>
        <ExternalLink className="h-3.5 w-3.5" />
      </a>

      {/* Copy Button */}
      <button
        onClick={handleCopy}
        className="p-1 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.04] text-text-muted hover:text-white transition-all cursor-pointer"
        title="Copy transaction hash"
        style={{ outline: 'none' }}
      >
        {copied ? (
          <Check className="h-3 w-3 text-success-green" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </button>
    </div>
  );
}
