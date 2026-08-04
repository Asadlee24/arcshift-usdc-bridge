// components/bridge/SuccessView.tsx
// Redesigned Success View with high-end animations, interactive token path flight simulator, neon highlights, and terminal-style shareable bridge receipt

'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Check, ArrowRight, Sparkles, Copy } from 'lucide-react';
import { getChainById } from '../../constants/chains';

interface SuccessViewProps {
  amount: string;
  fromChainId: number;
  toChainId: number;
  sourceTxHash: string;
  destTxHash?: string;
  elapsedSeconds: number;
  onReset: () => void;
  theme?: 'dark' | 'light';
  isRelayed?: boolean;
  userAddress?: string;
  isSwap?: boolean;
}

export default function SuccessView({
  amount,
  fromChainId,
  toChainId,
  sourceTxHash,
  destTxHash,
  elapsedSeconds,
  onReset,
  theme = 'light',
  isRelayed = false,
  userAddress,
  isSwap = false,
}: SuccessViewProps) {
  const fromChain = getChainById(fromChainId);
  const toChain = getChainById(toChainId);
  const isDark = theme === 'dark';
  const [copied, setCopied] = useState(false);

  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';
  
  const buttonStyle = isDark 
    ? 'bg-[#10B981] hover:bg-[#059669] text-[#070B13] shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
    : 'bg-[#10B981] hover:bg-[#059669] text-white shadow-[0_0_15px_rgba(16,185,129,0.2)]';

  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return addr.substring(0, 6) + '...' + addr.substring(addr.length - 6);
  };

  const handleCopy = () => {
    const receiptText = isSwap
      ? `ArcShift Swap Receipt\n---------------------------\nAmount: ${amount}\nCompleted in ${elapsedSeconds} seconds\nTransaction Hash: ${sourceTxHash}\n---------------------------\nSwapped with ArcShift`
      : `ArcShift Bridge Receipt\n---------------------------\nAmount: ${amount}\nRoute: ${fromChain?.name} → ${toChain?.name}\nCompleted in ${elapsedSeconds} seconds\nSource Tx: ${sourceTxHash}\nDest Tx: ${destTxHash || ''}\n---------------------------\nBridged with ArcShift`;
    navigator.clipboard.writeText(receiptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareX = () => {
    const text = isSwap
      ? `Just swapped ${amount} on Arc Testnet in ${elapsedSeconds} seconds using @ArcShift! 🚀\nTx: ${sourceTxHash}`
      : `Just bridged ${amount} from ${fromChain?.name} to ${toChain?.name} in ${elapsedSeconds} seconds using @ArcShift! 🚀\nSource: ${sourceTxHash}\nDest: ${destTxHash || ''}`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="flex flex-col text-left select-none w-full">
      
      {/* 1. Compact Header Row */}
      <div className="flex items-center gap-3 mb-3.5 mt-0.5 w-full">
        <div className={`relative h-10 w-10 rounded-full border flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.25)] flex-shrink-0 ${
          isDark 
            ? 'bg-[#070B13] border-[#10B981] text-[#10B981]' 
            : 'bg-emerald-50 border-[#10B981] text-[#059669]'
        }`}>
          <Check className="h-5 w-5 stroke-[3]" />
          <div className="absolute inset-0 rounded-full bg-[#10B981]/25 blur-sm animate-pulse" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className={`text-base font-black ${textPrimary} tracking-tight uppercase leading-none mb-1`}>
            {isSwap ? 'SWAP COMPLETE' : 'BRIDGE COMPLETE'}
          </h3>
          <p className={`text-[11px] font-bold ${textMuted} truncate`}>
            {isSwap ? 'Successfully swapped ' : 'Successfully transferred '}
            <span className="text-[#10B981] font-black">{amount}</span>
          </p>
        </div>
      </div>

      {/* 2. Compact Interactive Path Simulator */}
      <div className="w-full mb-3.5 p-2.5 rounded-xl border flex items-center justify-between relative overflow-hidden bg-slate-500/5 border-slate-500/10">
        {/* Route Line */}
        <div className="absolute top-1/2 left-[40px] right-[40px] -translate-y-1/2 h-[1px] border-t border-dashed border-slate-400/30 z-0" />
        
        {/* Animated Flying Token Particle */}
        <motion.div
          animate={{ x: [0, 160, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/2 left-[42px] -translate-y-1/2 h-2 w-2 rounded-full bg-[#10B981] shadow-[0_0_6px_#10B981] z-10"
        />

        {/* Source Chain Node */}
        <div className="flex flex-col items-center gap-1 z-10">
          <div className={`h-8 w-8 rounded-full p-0.5 flex items-center justify-center border shadow-xs ${
            isDark ? 'bg-[#0F172A] border-slate-700/40' : 'bg-white border-slate-200'
          }`}>
            <img src={fromChain?.iconUrl} alt={fromChain?.name} className="h-full w-full rounded-full object-cover" />
          </div>
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{fromChain?.shortName}</span>
        </div>

        <ArrowRight className="h-4 w-4 text-[#10B981] animate-pulse flex-shrink-0" />

        {/* Destination Chain Node */}
        <div className="flex flex-col items-center gap-1 z-10">
          <div className={`h-8 w-8 rounded-full p-0.5 flex items-center justify-center border-2 shadow-xs ${
            isDark ? 'bg-[#0F172A] border-[#10B981]' : 'bg-white border-[#10B981]'
          }`}>
            <img src={toChain?.iconUrl} alt={toChain?.name} className="h-full w-full rounded-full object-cover" />
          </div>
          <span className="text-[8px] font-black text-[#10B981] uppercase tracking-wider">{toChain?.shortName}</span>
        </div>
      </div>

      {/* 3. Compact Bridge/Swap Receipt (Terminal-style) */}
      <div className="w-full mb-3.5 relative">
        <div className={`p-4 rounded-xl border border-dashed relative overflow-hidden font-mono text-left ${
          isDark 
            ? 'bg-[#0F172A]/70 border-slate-800 text-slate-300' 
            : 'bg-white border-slate-300 text-slate-700 shadow-sm'
        }`}>
          {/* Top Receipt Tear Details */}
          <div className="absolute top-0 left-0 right-0 h-1 flex justify-between overflow-hidden">
            {Array.from({ length: 28 }).map((_, i) => (
              <div 
                key={i} 
                className={`w-2 h-2 rounded-full -mt-1 flex-shrink-0 ${
                  isDark ? 'bg-[#070B13]' : 'bg-slate-50'
                }`} 
              />
            ))}
          </div>

          <div className="text-center mt-1 mb-2.5">
            <span className={`text-[9px] uppercase tracking-widest font-black opacity-60 ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              {isSwap ? 'ArcShift Swap Receipt' : 'ArcShift Bridge Receipt'}
            </span>
            <div className="text-xl font-black text-[#10B981] mt-0.5">
              {amount}
            </div>
          </div>

          <div className="space-y-1.5 text-[11px] border-t border-b border-dashed border-slate-700/20 dark:border-slate-800/50 py-2.5 my-2">
            <div className="flex justify-between">
              <span className="opacity-60">Route:</span>
              <span className="font-bold flex items-center gap-1">
                {fromChain?.shortName}
                <ArrowRight className="h-2.5 w-2.5 text-[#10B981]" />
                {toChain?.shortName}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="opacity-60">Completed in:</span>
              <span className="font-bold">{elapsedSeconds}s</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="opacity-60">{isSwap ? 'Tx Hash:' : 'Source Tx:'}</span>
              <a
                href={fromChain?.explorerUrl ? `${fromChain.explorerUrl}/tx/${sourceTxHash}` : '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold font-mono text-[#10B981] hover:underline flex items-center gap-0.5"
              >
                {formatAddress(sourceTxHash)}
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>

            {!isSwap && destTxHash && (
              <div className="flex justify-between items-center">
                <span className="opacity-60">Dest Tx:</span>
                <a
                  href={toChain?.explorerUrl ? `${toChain.explorerUrl}/tx/${destTxHash}` : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold font-mono text-[#10B981] hover:underline flex items-center gap-0.5"
                >
                  {formatAddress(destTxHash)}
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>
            )}

          </div>

          {/* Bottom Receipt Tear Details */}
          <div className="absolute bottom-0 left-0 right-0 h-1 flex justify-between overflow-hidden">
            {Array.from({ length: 28 }).map((_, i) => (
              <div 
                key={i} 
                className={`w-2 h-2 rounded-full -mb-1 flex-shrink-0 ${
                  isDark ? 'bg-[#070B13]' : 'bg-slate-50'
                }`} 
              />
            ))}
          </div>
        </div>
      </div>

      {/* 4. Compact Receipt Actions */}
      <div className="flex gap-2 w-full mb-3.5">
        <button
          onClick={handleShareX}
          className={`flex-1 py-2 rounded-lg border text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            isDark 
              ? 'border-slate-800 bg-[#0F172A] hover:bg-slate-800 text-slate-300' 
              : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-sm'
          }`}
        >
          <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Share
        </button>

        <button
          onClick={handleCopy}
          className={`flex-1 py-2 rounded-lg border text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            isDark 
              ? 'border-slate-800 bg-[#0F172A] hover:bg-slate-800 text-slate-300' 
              : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-sm'
          }`}
        >
          {copied ? (
            <span className="text-[#10B981]">Copied!</span>
          ) : (
            <>
              <Copy className="w-3 h-3 text-[#10B981]" />
              Copy
            </>
          )}
        </button>

        <a
          href={toChain?.explorerUrl ? `${toChain.explorerUrl}/tx/${sourceTxHash}` : '#'}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex-1 py-2 rounded-lg border text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            isDark 
              ? 'border-slate-800 bg-[#0F172A] hover:bg-slate-800 text-slate-300' 
              : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-sm'
          }`}
        >
          <ExternalLink className="w-3 h-3 text-[#10B981]" />
          Explorer
        </a>
      </div>

      {/* 5. Reset / CTA Button */}
      <button
        onClick={onReset}
        className={`w-full h-9.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${buttonStyle}`}
      >
        {isSwap ? 'Swap again' : 'Bridge again'}
      </button>

    </div>
  );
}
