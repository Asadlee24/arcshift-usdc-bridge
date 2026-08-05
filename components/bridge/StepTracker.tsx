import React from 'react';
import { Check, X, Loader2, ExternalLink, Activity, Zap, Lock } from 'lucide-react';
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
  const dividerBorder = isDark ? 'border-[#1E293B]' : 'border-slate-200';
  const bgCircleBase = isDark ? 'bg-[#0F172A]' : 'bg-white';
  const borderLineBase = isDark ? 'bg-slate-800' : 'bg-slate-200';
  const linkBg = isDark ? 'bg-[#131B2E] border-[#1E293B] text-slate-400 hover:text-white hover:border-[#10B981]' : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:border-[#10B981]';

  const isForwardingRoute = steps.length === 3;

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
            <span className="h-2 w-2 rounded-full bg-[#10B981] animate-ping" />
            <h3 className={`text-sm font-black tracking-wide ${textPrimary} uppercase`}>
              {isSwap ? 'Swapping Assets' : 'Bridging Assets'}
            </h3>
            {isForwardingRoute ? (
              <span className="text-[9px] font-black text-[#10B981] bg-[#10B981]/15 px-2 py-0.5 rounded-full border border-[#10B981]/30 flex items-center gap-0.5 ml-2">
                <Zap className="h-2.5 w-2.5" /> Circle Auto-Relay
              </span>
            ) : (
              <span className="text-[9px] font-semibold text-slate-400 bg-slate-500/10 px-2 py-0.5 rounded-full border border-slate-500/20 flex items-center gap-0.5 ml-2">
                <Lock className="h-2.5 w-2.5" /> 2-Step Mint
              </span>
            )}
          </div>
          <p className={`text-[11px] font-semibold ${textMuted} mt-0.5`}>
            {isSwap ? (
              <>
                Swapping <span className="text-[#10B981] font-black">{amount} {swapTokens?.sell || 'USDC'}</span> to <span className="text-blue-400 font-black">{swapTokens?.buy || 'EURC'}</span> on <span className="text-[#10B981] font-black">Arc Testnet</span>
              </>
            ) : (
              <>
                {amount} USDC from <span className="text-[#10B981] font-black">{sourceChainName.replace(/_/g, ' ')}</span> to <span className="text-blue-400 font-black">{destChainName.replace(/_/g, ' ')}</span>
              </>
            )}
          </p>
        </div>
        <div className={`text-xs font-black ${isDark ? 'text-slate-300' : 'text-slate-600'} font-mono bg-slate-500/10 px-2 py-0.5 rounded-[4px] border border-slate-500/15 tabular-nums`}>
          {elapsedSeconds}s
        </div>
      </div>

      {/* Progress Banner */}
      <div className={`mb-5 p-4 rounded-2xl border relative overflow-hidden ${isDark ? 'bg-[#0B1221] border-[#1E293B] shadow-[0_0_20px_rgba(16,185,129,0.02)]' : 'bg-slate-50 border-slate-200'}`}>
        <div className="absolute top-0 bottom-0 left-0 w-[80px] bg-gradient-to-r from-transparent via-[#10B981]/15 to-transparent pointer-events-none animate-scanline" />

        <div className="flex items-center justify-between mb-2">
          <span className={`text-[11px] font-extrabold uppercase tracking-wider ${textMuted} flex items-center gap-1`}>
            <Activity className="h-3 w-3 text-[#10B981] animate-pulse" />
            Estimated Finality
          </span>
          <span className="text-[13px] font-black text-[#10B981] font-mono tabular-nums">
            {remainingTime > 0 ? `${remainingTime}s` : 'Finalizing...'}
          </span>
        </div>
        
        <div className={`w-full h-2 rounded-full overflow-hidden relative ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
          <motion.div 
            className="h-full bg-gradient-to-r from-blue-500 via-emerald-400 to-[#10B981] rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        
        <div className="flex justify-between items-center mt-2 text-[10px] font-semibold">
          <span className={textMuted}>Speed Profile: {speedLabel}</span>
          <span className="text-[#10B981] font-black font-mono">{Math.round(progressPercent)}%</span>
        </div>
      </div>

      {/* Animated Step Nodes */}
      <div className="flex flex-col">
        {steps.map((step, idx) => {
          const isPending = step.status === 'pending';
          const isActive = step.status === 'active';
          const isDone = step.status === 'done';
          const isErr = step.status === 'error';

          let subText = step.description;
          if (isActive && step.name === 'attest') {
            subText = isForwardingRoute
              ? `Circle is attesting burn & auto-minting on destination... ${attestationElapsed}s`
              : `Verifying signatures from Circle Attestation network... ${attestationElapsed}s`;
          }

          return (
            <div key={step.name} className="flex gap-4 relative">
              
              <div className="flex flex-col items-center relative flex-shrink-0">
                <div className="relative h-[30px] w-[30px] flex items-center justify-center">
                  {isActive && (
                    <span className="absolute inset-0 rounded-full bg-[#10B981]/20 border border-[#10B981]/60 animate-ping" />
                  )}

                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: isDone ? [1, 1.2, 1] : 1 }}
                    transition={{ duration: 0.35, ease: 'easeInOut' }}
                    className={`flex h-[26px] w-[26px] z-10 items-center justify-center rounded-full border transition-all duration-300 ${
                      isDone
                        ? 'bg-[#10B981] border-[#10B981] text-[#070B13] shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                        : isActive
                        ? `border-2 border-[#10B981] ${bgCircleBase} text-[#10B981] shadow-[0_0_10px_rgba(16,185,129,0.25)]`
                        : isErr
                        ? 'bg-red-500 border-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.4)]'
                        : `border-2 ${isDark ? 'border-slate-800' : 'border-slate-200'} ${bgCircleBase} ${isDark ? 'text-slate-700' : 'text-slate-300'}`
                    }`}
                  >
                    {isDone ? (
                      <Check className="h-3.5 w-3.5 text-[#070B13] stroke-[3]" />
                    ) : isActive ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#10B981]" />
                    ) : isErr ? (
                      <X className="h-3.5 w-3.5 text-white" />
                    ) : (
                      <span className="text-[10px] font-bold font-mono">{idx + 1}</span>
                    )}
                  </motion.div>
                </div>

                {idx < steps.length - 1 && (
                  <div className={`absolute top-[30px] bottom-0 w-[2.5px] rounded-full ${borderLineBase}`}>
                    {(isDone || (isActive && idx === 0)) && (
                      <motion.div
                        initial={{ height: '0%' }}
                        animate={{ height: isDone ? '100%' : '50%' }}
                        transition={{ duration: 0.4 }}
                        className="w-full bg-[#10B981] rounded-full shadow-[0_0_6px_rgba(16,185,129,0.3)]"
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
                <span className={`text-[13px] font-black tracking-wide ${isActive ? 'text-[#10B981]' : textPrimary}`}>
                  {step.label}
                </span>
                <span className={`text-[11px] ${textMuted} font-semibold mt-0.5 leading-relaxed`}>
                  {subText}
                </span>

                {isDone && step.txHash && step.explorerUrl && (
                  <motion.a
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    href={step.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex items-center gap-1.5 font-mono text-[9.5px] border px-2.5 py-0.5 rounded-lg transition-all duration-200 mt-2.5 cursor-pointer hover:shadow-sm ${linkBg}`}
                  >
                    <span>{step.txHash}</span>
                    <ExternalLink className="h-3 w-3 text-[#10B981]" />
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
          className={`mt-5 rounded-2xl ${isDark ? 'bg-red-950/20 border-red-900/30' : 'bg-red-50 border-red-200'} border p-4 flex gap-3 items-start text-xs`}
        >
          <div className="h-6 w-6 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0 text-white mt-0.5 font-bold">
            !
          </div>
          <div className="flex flex-col">
            <span className={`font-black ${isDark ? 'text-red-400' : 'text-red-600'} uppercase tracking-wide`}>Transaction Error</span>
            <span className={`${isDark ? 'text-slate-400' : 'text-slate-500'} mt-0.5 leading-relaxed font-semibold`}>{error}</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
