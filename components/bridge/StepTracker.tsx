// components/bridge/StepTracker.tsx
// Animated step tracker for bridge transactions with metallic gold branding

'use client';

import React from 'react';
import { Check, X, Loader2, ExternalLink, Activity, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { BridgeStep } from '../../hooks/useBridge';

interface StepTrackerProps {
  steps: BridgeStep[];
  elapsedSeconds: number;
  attestationElapsed: number;
  amount: string;
  sourceChainName: string;
  destChainName: string;
  error: string | null;
  theme?: 'dark' | 'light';
  isSwap?: boolean;
  swapTokens?: { sell: string; buy: string };
}

export default function StepTracker({
  steps,
  elapsedSeconds,
  attestationElapsed,
  amount,
  sourceChainName,
  destChainName,
  error,
  theme = 'light',
  isSwap = false,
  swapTokens,
}: StepTrackerProps) {
  const isDark = theme === 'dark';

  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';
  const dividerBorder = isDark ? 'border-slate-800' : 'border-slate-200';
  const bgCircleBase = isDark ? 'bg-slate-900' : 'bg-white';
  const borderLineBase = isDark ? 'bg-slate-800' : 'bg-slate-200';
  const linkBg = isDark ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-amber-500/50' : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:border-amber-500';

  const getEstDuration = (chainName: string): { duration: number; speed: string } => {
    const name = chainName.toLowerCase();
    if (name.includes('ethereum')) return { duration: 30, speed: 'Medium (Sepolia L1)' };
    if (name.includes('base')) return { duration: 15, speed: 'Fast (Base L2)' };
    if (name.includes('arbitrum')) return { duration: 15, speed: 'Fast (Arbitrum L2)' };
    if (name.includes('avalanche')) return { duration: 12, speed: 'Instant (Avalanche Fuji)' };
    if (name.includes('optimism') || name.includes('op')) return { duration: 18, speed: 'Fast (Optimism L2)' };
    if (name.includes('linea')) return { duration: 20, speed: 'Fast (Linea L2)' };
    if (name.includes('polygon')) return { duration: 22, speed: 'Fast (Polygon L2)' };
    if (name.includes('arc')) return { duration: 6, speed: 'Subsecond (Arc Native)' };
    return { duration: 20, speed: 'Standard' };
  };

  const { duration: estDuration, speed: speedLabel } = getEstDuration(sourceChainName);
  const remainingTime = Math.max(0, estDuration - elapsedSeconds);
  const progressPercent = Math.min(100, (elapsedSeconds / estDuration) * 100);

  return (
    <div className="w-full flex flex-col select-none py-1">
      
      {/* Header */}
      <div className={`flex items-center justify-between pb-4 mb-4 border-b ${dividerBorder}`}>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
            <h3 className={`text-sm font-black tracking-wide ${textPrimary} uppercase`}>
              {isSwap ? 'Swapping Assets' : 'Bridging Assets'}
            </h3>
            <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1 ml-2">
              <Zap className="h-2.5 w-2.5" /> Circle Auto-Relay
            </span>
          </div>
          <p className={`text-[11px] font-semibold ${textMuted} mt-0.5`}>
            {isSwap ? (
              <>
                Swapping <span className="text-amber-500 font-bold">{amount} {swapTokens?.sell || 'USDC'}</span> to <span className="text-amber-400 font-bold">{swapTokens?.buy || 'EURC'}</span> on <span className="text-amber-500 font-bold">Arc Testnet</span>
              </>
            ) : (
              <>
                {amount} USDC from <span className="text-amber-500 font-bold">{sourceChainName.replace(/_/g, ' ')}</span> to <span className="text-amber-400 font-bold">{destChainName.replace(/_/g, ' ')}</span>
              </>
            )}
          </p>
        </div>
        <div className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'} font-mono bg-slate-500/10 px-2.5 py-1 rounded-md border border-slate-500/15 tabular-nums`}>
          {elapsedSeconds}s
        </div>
      </div>

      {/* Progress Banner */}
      <div className={`mb-5 p-4 rounded-xl border relative overflow-hidden ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-[11px] font-extrabold uppercase tracking-wider ${textMuted} flex items-center gap-1.5`}>
            <Activity className="h-3 w-3 text-amber-500 animate-pulse" />
            Estimated Finality
          </span>
          <span className="text-[13px] font-bold text-amber-500 font-mono tabular-nums">
            {remainingTime > 0 ? `${remainingTime}s` : 'Finalizing...'}
          </span>
        </div>
        
        <div className={`w-full h-2 rounded-full overflow-hidden relative ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
          <motion.div 
            className="h-full bg-gradient-to-r from-[#C8922A] via-[#D4A043] to-[#E8A830] rounded-full shadow-sm"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        
        <div className="flex justify-between items-center mt-2 text-[10px] font-semibold">
          <span className={textMuted}>Speed Profile: {speedLabel}</span>
          <span className="text-amber-500 font-bold font-mono">{Math.round(progressPercent)}%</span>
        </div>
      </div>

      {/* Animated Step Nodes */}
      <div className="flex flex-col">
        {steps.map((step, idx) => {
          const isActive = step.status === 'active';
          const isDone = step.status === 'done';
          const isErr = step.status === 'error';

          let subText = step.description;
          if (isActive && step.name === 'attest') {
            subText = `Circle consensus attesting burn & auto-minting on destination... ${attestationElapsed}s`;
          }

          return (
            <div key={step.name} className="flex gap-4 relative">
              
              <div className="flex flex-col items-center relative flex-shrink-0">
                <div className="relative h-[30px] w-[30px] flex items-center justify-center">
                  {isActive && (
                    <span className="absolute inset-0 rounded-full bg-amber-500/20 border border-amber-500/60 animate-ping" />
                  )}

                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: isDone ? [1, 1.2, 1] : 1 }}
                    transition={{ duration: 0.35, ease: 'easeInOut' }}
                    className={`flex h-[26px] w-[26px] z-10 items-center justify-center rounded-full border transition-all duration-300 ${
                      isDone
                        ? 'bg-amber-500 border-amber-500 text-slate-950 font-bold'
                        : isActive
                        ? `border-2 border-amber-500 ${bgCircleBase} text-amber-500`
                        : isErr
                        ? 'bg-red-500 border-red-500 text-white'
                        : `border-2 ${isDark ? 'border-slate-800' : 'border-slate-200'} ${bgCircleBase} ${isDark ? 'text-slate-700' : 'text-slate-300'}`
                    }`}
                  >
                    {isDone ? (
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    ) : isActive ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
                    ) : isErr ? (
                      <X className="h-3.5 w-3.5 text-white" />
                    ) : (
                      <span className="text-[10px] font-bold font-mono">{idx + 1}</span>
                    )}
                  </motion.div>
                </div>

                {idx < steps.length - 1 && (
                  <div className={`absolute top-[30px] bottom-0 w-[2px] rounded-full ${borderLineBase}`}>
                    {(isDone || (isActive && idx === 0)) && (
                      <motion.div
                        initial={{ height: '0%' }}
                        animate={{ height: isDone ? '100%' : '50%' }}
                        transition={{ duration: 0.4 }}
                        className="w-full bg-amber-500 rounded-full"
                      />
                    )}
                  </div>
                )}
              </div>

              <motion.div 
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: idx * 0.1 }}
                className="flex-1 pb-6 last:pb-0 flex flex-col items-start"
              >
                <span className={`text-[13px] font-bold tracking-wide ${isActive ? 'text-amber-500' : textPrimary}`}>
                  {step.label}
                </span>
                <span className={`text-[11px] ${textMuted} font-medium mt-0.5 leading-relaxed`}>
                  {subText}
                </span>

                {isDone && step.txHash && step.explorerUrl && (
                  <motion.a
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    href={step.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex items-center gap-1.5 font-mono text-[10px] border px-2.5 py-1 rounded-md transition-all duration-200 mt-2.5 cursor-pointer hover:shadow-sm ${linkBg}`}
                  >
                    <span>{step.txHash}</span>
                    <ExternalLink className="h-3 w-3 text-amber-500" />
                  </motion.a>
                )}
              </motion.div>
            </div>
          );
        })}
      </div>

      {error && (
        <motion.div 
          initial={{ x: [-10, 10, -10, 10, 0] }}
          transition={{ duration: 0.4 }}
          className={`mt-5 rounded-xl ${isDark ? 'bg-red-950/20 border-red-900/30' : 'bg-red-50 border-red-200'} border p-4 flex gap-3 items-start text-xs`}
        >
          <div className="h-5 w-5 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0 text-white font-bold text-[10px] mt-0.5">
            !
          </div>
          <div className="flex flex-col">
            <span className={`font-bold ${isDark ? 'text-red-400' : 'text-red-600'} uppercase tracking-wide`}>Transaction Error</span>
            <span className={`${isDark ? 'text-slate-400' : 'text-slate-500'} mt-0.5 leading-relaxed font-medium`}>{error}</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
