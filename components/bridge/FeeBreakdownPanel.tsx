// components/bridge/FeeBreakdownPanel.tsx
// Dynamic fee breakdown panel displaying Circle CCTP v2 protocol fees,
// source gas estimation, auto-relay forwarding, and net receive amount.

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Zap, Clock, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { getChainById } from '../../constants/chains';
import { RouteQuote } from '../../lib/bridge/quotes';

export type SpeedMode = 'fast' | 'standard';

interface FeeBreakdownPanelProps {
  amount: string;
  fromChainId: number;
  toChainId: number;
  speedMode: SpeedMode;
  onSpeedModeChange: (mode: SpeedMode) => void;
  quote?: RouteQuote | null;
  theme?: 'dark' | 'light';
}

const GAS_FEE_ESTIMATES: Record<number, string> = {
  // Mainnet
  1:        '~$2.50',  // Ethereum Mainnet
  8453:     '~$0.01',  // Base
  42161:    '~$0.02',  // Arbitrum One
  5042:     '~$0.005', // Arc Mainnet

  // Testnet
  11155111: '~$0.80',  // Ethereum Sepolia
  84532:    '~$0.02',  // Base Sepolia
  421614:   '~$0.03',  // Arbitrum Sepolia
  43113:    '~$0.05',  // Avalanche Fuji
  11155420: '~$0.04',  // OP Sepolia
  5042002:  '~$0.01',  // Arc Testnet
};

const DEST_GAS_ESTIMATES: Record<number, string> = {
  // Mainnet
  1:        '~$2.00',
  8453:     '~$0.01',
  42161:    '~$0.01',
  5042:     '~$0.00',

  // Testnet
  11155111: '~$0.90',
  84532:    '~$0.01',
  421614:   '~$0.02',
  43113:    '~$0.04',
  11155420: '~$0.03',
  5042002:  '~$0.00',
};

const FINALITY_TIME: Record<SpeedMode, Record<number, string>> = {
  fast: {
    1: '~2 min', 8453: '~20 sec', 42161: '~20 sec', 5042: '~15 sec',
    11155111: '~2 min', 84532: '~20 sec', 421614: '~20 sec', 43113: '~30 sec', 11155420: '~20 sec', 5042002: '~15 sec',
  },
  standard: {
    1: '~15 min', 8453: '~2 min', 42161: '~2 min', 5042: '~1 min',
    11155111: '~15 min', 84532: '~2 min', 421614: '~2 min', 43113: '~3 min', 11155420: '~2 min', 5042002: '~1 min',
  }
};

export default function FeeBreakdownPanel({
  amount,
  fromChainId,
  toChainId,
  speedMode,
  onSpeedModeChange,
  quote,
  theme = 'light',
}: FeeBreakdownPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const isDark = theme === 'dark';

  const fromChain = getChainById(fromChainId);
  const toChain = getChainById(toChainId);
  const isForwarding = toChain?.supportsForwarding !== false;
  const supportsFast = fromChain?.supportsFastTransfer !== false;

  const hasAmount = parseFloat(amount || '0') > 0;

  const borderColor = isDark ? 'border-slate-800' : 'border-slate-200';
  const bgColor = isDark ? 'bg-slate-900/60' : 'bg-slate-50';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const dividerColor = isDark ? 'border-slate-800' : 'border-slate-200';

  const srcGas = GAS_FEE_ESTIMATES[fromChainId] ?? '~$0.02';
  const dstGas = isForwarding ? '$0.00 (Auto-Minted)' : (DEST_GAS_ESTIMATES[toChainId] ?? '~$0.01');

  // Protocol fee calculation
  let protocolFeeDisplay = '$0.00 (Standard)';
  let protocolFeeNumeric = 0;

  if (quote) {
    protocolFeeNumeric = parseFloat(quote.protocolFeeFormatted);
    protocolFeeDisplay = speedMode === 'fast'
      ? `$${quote.protocolFeeFormatted} USDC (~10 bps)`
      : '$0.00 (Standard)';
  } else if (hasAmount && speedMode === 'fast') {
    // documented fast transfer estimate ~10 bps (0.10%)
    const est = Math.max(parseFloat(amount) * 0.001, 0.01);
    protocolFeeNumeric = est;
    protocolFeeDisplay = `~$${est.toFixed(4)} USDC (~10 bps)`;
  }

  const receivedDisplay = quote
    ? `${quote.expectedReceiveAmount} USDC`
    : hasAmount
      ? `${Math.max(0, parseFloat(amount) - protocolFeeNumeric).toFixed(4)} USDC`
      : '–';

  const parseGas = (gasStr: string) => {
    if (gasStr.includes('Auto-Minted') || gasStr.includes('Forwarded')) return 0;
    return parseFloat(gasStr.replace('~$', '').trim()) || 0;
  };
  const srcGasVal = parseGas(srcGas);
  const totalEstFeeVal = protocolFeeNumeric + srcGasVal;
  const totalEstFeeDisplay = hasAmount ? `~$${totalEstFeeVal.toFixed(4)}` : '–';

  const finality = quote?.estimatedDuration ??
    (FINALITY_TIME[speedMode]?.[fromChainId] ?? (speedMode === 'fast' ? '~20 sec' : '~2 min'));

  return (
    <div className={`rounded-2xl border ${borderColor} ${bgColor} overflow-hidden mb-3 transition-all duration-200`}>

      {/* ── Speed Mode Selector (Fast vs Standard) ──────────────────── */}
      {supportsFast && (
        <div className={`px-3.5 py-2.5 border-b ${dividerColor} flex items-center justify-between`}>
          <span className={`text-[11px] font-black uppercase tracking-wider ${textMuted}`}>Transfer Speed</span>
          <div className="flex items-center gap-1 bg-black/20 dark:bg-slate-950/40 p-1 rounded-xl border border-slate-700/30">
            <button
              type="button"
              onClick={() => onSpeedModeChange('fast')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                speedMode === 'fast'
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  : `${textMuted} hover:${textPrimary}`
              }`}
            >
              <Zap className="h-3 w-3" />
              <span>Fast</span>
              <span className="text-[9px] opacity-80">(~15s)</span>
            </button>
            <button
              type="button"
              onClick={() => onSpeedModeChange('standard')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                speedMode === 'standard'
                  ? 'bg-slate-700 text-white shadow-md'
                  : `${textMuted} hover:${textPrimary}`
              }`}
            >
              <Clock className="h-3 w-3" />
              <span>Standard</span>
              <span className="text-[9px] opacity-80">(Free)</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Summary Row ──────────────────── */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 ${textMuted} hover:${textPrimary} transition-colors cursor-pointer`}
      >
        <div className="flex items-center gap-2 text-[11px] font-bold flex-wrap">
          <Clock className="h-3 w-3 text-amber-500 flex-shrink-0" />
          <span>{finality}</span>
          <span className="opacity-40">·</span>
          <span>Est. Fee: {totalEstFeeDisplay}</span>
          <span className="text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="h-2.5 w-2.5" /> 1-Signature Auto-Relay
          </span>
        </div>
        {expanded
          ? <ChevronUp className="h-3.5 w-3.5 flex-shrink-0" />
          : <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
        }
      </button>

      {/* ── Expanded Detail ───────────────────────────────── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="fee-detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={`px-3.5 pb-3.5 border-t ${dividerColor} pt-2.5 flex flex-col gap-2`}>

              <div className={`flex items-center justify-between text-[11px] font-semibold ${textMuted}`}>
                <span>Source Gas Fee</span>
                <span className={textPrimary}>{srcGas}</span>
              </div>

              <div className={`flex items-center justify-between text-[11px] font-semibold ${textMuted}`}>
                <span>Destination Gas Fee</span>
                <span className="text-emerald-500 font-bold">{dstGas}</span>
              </div>

              <div className={`flex items-center justify-between text-[11px] font-semibold ${textMuted}`}>
                <span>{speedMode === 'fast' ? 'Circle Fast Transfer Fee' : 'Circle Protocol Fee'}</span>
                <span className={textPrimary}>{protocolFeeDisplay}</span>
              </div>

              <div className={`border-t ${dividerColor} my-0.5`} />

              <div className="flex items-center justify-between text-[12px] font-black">
                <span className={textMuted}>You Receive</span>
                <span className="text-[#C8922A]">{receivedDisplay}</span>
              </div>

              <div className={`rounded-xl p-2.5 text-[10px] font-medium leading-relaxed flex items-start gap-2 ${
                isDark ? 'bg-amber-500/10 text-amber-300/90 border border-amber-500/20' : 'bg-amber-50 text-amber-900 border border-amber-200'
              }`}>
                <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
                <span>
                  <strong>Circle CCTP v2 Direct Mint:</strong> Single-signature burn on source network. Native USDC is minted directly to your destination wallet by Circle's MessageTransmitter without wrapped token or liquidity pool risk.
                </span>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
