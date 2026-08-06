// components/bridge/FeeBreakdownPanel.tsx
// Animated fee breakdown panel shown between amount entry and bridge confirmation

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Zap, Clock, ShieldCheck } from 'lucide-react';
import { getChainById } from '../../constants/chains';

export type SpeedMode = 'fast' | 'standard';

interface FeeBreakdownPanelProps {
  amount: string;
  fromChainId: number;
  toChainId: number;
  speedMode: SpeedMode;
  onSpeedModeChange: (mode: SpeedMode) => void;
  theme?: 'dark' | 'light';
}

const GAS_FEE_ESTIMATES: Record<number, string> = {
  11155111: '~$0.80',  // Ethereum Sepolia
  84532:    '~$0.02',  // Base Sepolia
  421614:   '~$0.03',  // Arbitrum Sepolia
  43113:    '~$0.05',  // Avalanche Fuji
  11155420: '~$0.04',  // OP Sepolia
  59141:    '~$0.06',  // Linea Sepolia
  80002:    '~$0.02',  // Polygon Amoy
  5042002:  '~$0.01',  // Arc Testnet
  1301:     '~$0.01',  // Unichain Sepolia
  14601:    '~$0.01',  // Sonic Testnet
  998:      '~$0.01',  // HyperEVM Testnet
  10143:    '~$0.02',  // Monad Testnet
  763373:   '~$0.01',  // Ink Sepolia
  1328:     '~$0.03',  // Sei Testnet
  4801:     '~$0.02',  // World Chain Sepolia
  688689:   '~$0.01',  // Pharos Testnet
};

const DEST_GAS_ESTIMATES: Record<number, string> = {
  11155111: '~$0.90',
  84532:    '~$0.01',
  421614:   '~$0.02',
  43113:    '~$0.04',
  11155420: '~$0.03',
  59141:    '~$0.05',
  80002:    '~$0.01',
  5042002:  '~$0.00',
  1301:     '~$0.01',
  14601:    '~$0.01',
  998:      '~$0.01',
  10143:    '~$0.01',
  763373:   '~$0.01',
  1328:     '~$0.02',
  4801:     '~$0.01',
  688689:   '~$0.01',
};

const FINALITY_TIME: Record<SpeedMode, Record<number, string>> = {
  fast: {
    11155111: '~2 min',   84532:    '~20 sec',  421614:   '~20 sec',
    43113:    '~30 sec',  11155420: '~20 sec',  59141:    '~45 sec',
    80002:    '~45 sec',  5042002:  '~15 sec',
    1301:     '~20 sec',  14601:    '~15 sec',  998:      '~15 sec',
    10143:    '~20 sec',  763373:   '~20 sec',  1328:     '~25 sec',
    4801:     '~20 sec',  688689:   '~20 sec',
  },
  standard: {
    11155111: '~15 min',  84532:    '~2 min',   421614:   '~2 min',
    43113:    '~3 min',   11155420: '~2 min',   59141:    '~4 min',
    80002:    '~3 min',   5042002:  '~1 min',
    1301:     '~2 min',   14601:    '~1 min',   998:      '~1 min',
    10143:    '~2 min',   763373:   '~2 min',   1328:     '~3 min',
    4801:     '~2 min',   688689:   '~2 min',
  }
};

export default function FeeBreakdownPanel({
  amount,
  fromChainId,
  toChainId,
  speedMode,
  onSpeedModeChange,
  theme = 'light',
}: FeeBreakdownPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const isDark = theme === 'dark';

  const toChain = getChainById(toChainId);
  const isForwarding = toChain?.supportsForwarding !== false;

  const hasAmount = parseFloat(amount || '0') > 0;

  const borderColor = isDark ? 'border-slate-800' : 'border-slate-200';
  const bgColor = isDark ? 'bg-slate-900/60' : 'bg-slate-50';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const dividerColor = isDark ? 'border-slate-800' : 'border-slate-200';

  const srcGas = GAS_FEE_ESTIMATES[fromChainId] ?? '~$0.05';
  const dstGas = isForwarding ? '$0.00 (Forwarded)' : (DEST_GAS_ESTIMATES[toChainId] ?? '~$0.01');
  
  const totalFee = hasAmount ? Math.max(parseFloat(amount) * 0.01, 0.001) : 0;
  const receivedVal = hasAmount ? Math.max(parseFloat(amount) - totalFee, 0) : 0;

  const cctpFeeDisplay = hasAmount ? `$${totalFee.toFixed(4)}` : '~1%';
  const receivedDisplay = hasAmount ? receivedVal.toFixed(4) : '–';
  
  const parseGas = (gasStr: string) => {
    if (gasStr.includes('Forwarded')) return 0;
    return parseFloat(gasStr.replace('~$', '').trim()) || 0;
  };
  const srcGasVal = parseGas(srcGas);
  const dstGasVal = parseGas(dstGas);
  const totalEstFeeVal = totalFee + srcGasVal + dstGasVal;
  const totalEstFeeDisplay = hasAmount ? `~$${totalEstFeeVal.toFixed(4)}` : '–';

  const finality = FINALITY_TIME[speedMode][fromChainId] ?? (speedMode === 'fast' ? '~30 sec' : '~5 min');

  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} overflow-hidden mb-3 transition-all duration-200`}>

      {/* ── Summary Row ──────────────────── */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className={`w-full flex items-center justify-between px-3 py-2.5 ${textMuted} hover:${textPrimary} transition-colors`}
      >
        <div className="flex items-center gap-2 text-[11px] font-semibold">
          <Clock className="h-3 w-3 text-amber-500" />
          <span>{finality}</span>
          <span className="opacity-40">·</span>
          <span>Est. Total Fee: {totalEstFeeDisplay}</span>
          <span className="text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
            <Zap className="h-2.5 w-2.5" /> 1-Signature Auto-Relay
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
            <div className={`px-3 pb-3 border-t ${dividerColor} pt-2.5 flex flex-col gap-2`}>

              {[
                { label: 'Source Gas Fee', value: srcGas },
                { label: 'Destination Gas Fee', value: dstGas },
                { label: 'Circle CCTP Protocol Fee (1%)', value: cctpFeeDisplay },
              ].map(row => (
                <div key={row.label} className={`flex items-center justify-between text-[11px] font-semibold ${textMuted}`}>
                  <span>{row.label}</span>
                  <span className={textPrimary}>{row.value}</span>
                </div>
              ))}

              <div className={`border-t ${dividerColor} my-0.5`} />

              <div className="flex items-center justify-between text-[12px] font-black">
                <span className={textMuted}>You Receive</span>
                <span className="text-[#C8922A]">{receivedDisplay} USDC</span>
              </div>

              <div className={`rounded-lg p-2.5 text-[10px] font-medium leading-relaxed flex items-start gap-2 ${
                isDark ? 'bg-amber-500/10 text-amber-300/90 border border-amber-500/20' : 'bg-amber-50 text-amber-900 border border-amber-200'
              }`}>
                <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
                <span><strong>Circle CCTP v2 Auto-Relay:</strong> Single-signature burn on source chain — native USDC is automatically minted directly to your destination wallet.</span>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
