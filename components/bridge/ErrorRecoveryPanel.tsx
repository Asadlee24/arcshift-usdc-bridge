// components/bridge/ErrorRecoveryPanel.tsx
// Rich error recovery UI with diagnostics, retry options, and support links

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, RefreshCw, Wifi, Fuel, ShieldX, Clock, ChevronDown,
  ExternalLink, Copy, CheckCircle2, RotateCcw
} from 'lucide-react';

export type ErrorCategory = 'rejected' | 'gas' | 'reverted' | 'timeout' | 'network' | 'unknown';

interface ErrorRecoveryPanelProps {
  errorMessage: string;
  onRetry: () => void;
  onReset: () => void;
  fromChainId?: number;
  theme?: 'dark' | 'light';
}

function categorizeError(msg: string): ErrorCategory {
  const m = msg.toLowerCase();
  if (m.includes('rejected') || m.includes('denied') || m.includes('cancel')) return 'rejected';
  if (m.includes('insufficient funds') || m.includes('gas')) return 'gas';
  if (m.includes('reverted') || m.includes('revert')) return 'reverted';
  if (m.includes('timeout') || m.includes('timed out') || m.includes('attestation')) return 'timeout';
  if (m.includes('network') || m.includes('fetch') || m.includes('connection')) return 'network';
  return 'unknown';
}

type IconComponent = React.FC<{ className?: string }>;

const ERROR_META: Record<ErrorCategory, {
  icon: IconComponent;
  color: string;
  title: string;
  tip: string;
  actions: string[];
}> = {
  rejected: {
    icon: ShieldX,
    color: 'amber',
    title: 'Transaction Rejected',
    tip: 'You rejected the transaction in your wallet. No funds were moved.',
    actions: ['Check wallet notification', 'Ensure you approve all prompts', 'Retry the transaction'],
  },
  gas: {
    icon: Fuel,
    color: 'orange',
    title: 'Insufficient Gas Funds',
    tip: 'Not enough native token to pay for gas fees on the source chain.',
    actions: ['Get testnet ETH from Faucet Hub', 'Reduce the transfer amount', 'Switch to a chain with lower fees'],
  },
  reverted: {
    icon: AlertTriangle,
    color: 'red',
    title: 'Contract Reverted',
    tip: 'The on-chain transaction reverted. This may be due to an invalid approval, amount mismatch, or contract state issue.',
    actions: ['Verify USDC balance', 'Check approval amount matches', 'Try a smaller transfer amount'],
  },
  timeout: {
    icon: Clock,
    color: 'blue',
    title: 'Attestation Timeout',
    tip: "Circle's attestation service didn't respond in time. The burn transaction may still be valid on-chain.",
    actions: ['Wait ~2 minutes and retry', 'Check Circle CCTP status', 'Funds are safe — not double-spent'],
  },
  network: {
    icon: Wifi,
    color: 'purple',
    title: 'Network Error',
    tip: 'A network connectivity issue occurred while communicating with the RPC or attestation service.',
    actions: ['Check your internet connection', 'Try a different RPC or VPN', 'Retry after a few seconds'],
  },
  unknown: {
    icon: AlertTriangle,
    color: 'red',
    title: 'Transaction Failed',
    tip: 'An unexpected error occurred. Please review the details below and try again.',
    actions: ['Copy error details', 'Try again', 'Contact support if issue persists'],
  },
};

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  red:    { bg: 'bg-red-950/20',    border: 'border-red-900/30',    text: 'text-red-300',    badge: 'bg-red-500/20 text-red-400' },
  amber:  { bg: 'bg-amber-950/20',  border: 'border-amber-900/30',  text: 'text-amber-300',  badge: 'bg-amber-500/20 text-amber-400' },
  orange: { bg: 'bg-orange-950/20', border: 'border-orange-900/30', text: 'text-orange-300', badge: 'bg-orange-500/20 text-orange-400' },
  blue:   { bg: 'bg-blue-950/20',   border: 'border-blue-900/30',   text: 'text-blue-300',   badge: 'bg-blue-500/20 text-blue-400' },
  purple: { bg: 'bg-purple-950/20', border: 'border-purple-900/30', text: 'text-purple-300', badge: 'bg-purple-500/20 text-purple-400' },
};

const COLOR_MAP_LIGHT: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  red:    { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    badge: 'bg-red-100 text-red-600' },
  amber:  { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-600' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-600' },
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-600' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-600' },
};

export default function ErrorRecoveryPanel({
  errorMessage,
  onRetry,
  onReset,
  theme = 'light',
}: ErrorRecoveryPanelProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const isDark = theme === 'dark';
  const category = categorizeError(errorMessage);
  const meta = ERROR_META[category];
  const Icon: IconComponent = meta.icon;
  const colorKey = meta.color;
  const colors = isDark ? COLOR_MAP[colorKey] ?? COLOR_MAP['red'] : COLOR_MAP_LIGHT[colorKey] ?? COLOR_MAP_LIGHT['red'];

  const handleCopy = async () => {
    await navigator.clipboard.writeText(errorMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`rounded-[16px] border ${colors.bg} ${colors.border} p-4 mb-4`}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`p-1.5 rounded-xl ${colors.badge}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[12px] font-black ${isDark ? 'text-white' : 'text-slate-900'} mb-0.5`}>
            {meta.title}
          </p>
          <p className={`text-[11px] font-semibold leading-relaxed ${colors.text}`}>
            {meta.tip}
          </p>
        </div>
      </div>

      {/* Action Steps */}
      <ul className="flex flex-col gap-1 mb-3">
        {meta.actions.map((action, i) => (
          <li key={i} className={`flex items-center gap-2 text-[10px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            <span className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-black ${colors.badge}`}>
              {i + 1}
            </span>
            {action}
          </li>
        ))}
      </ul>

      {/* Error detail collapsible */}
      <button
        type="button"
        onClick={() => setShowDetails(v => !v)}
        className={`w-full flex items-center justify-between text-[10px] font-semibold ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'} transition-colors mb-2`}
      >
        <span>Technical Details</span>
        {showDetails
          ? <ChevronDown className="h-3 w-3 rotate-180" />
          : <ChevronDown className="h-3 w-3" />
        }
      </button>

      <AnimatePresence initial={false}>
        {showDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={`rounded-[10px] p-2.5 mb-3 relative ${isDark ? 'bg-black/30' : 'bg-slate-100'}`}>
              <p className={`text-[10px] font-mono leading-relaxed break-words pr-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {errorMessage}
              </p>
              <button
                type="button"
                onClick={handleCopy}
                className={`absolute top-2 right-2 p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-200'}`}
                title="Copy error"
              >
                {copied
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-[#10B981]" />
                  : <Copy className={`h-3.5 w-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                }
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <motion.button
          type="button"
          onClick={onRetry}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-[10px] bg-[#10B981] hover:bg-[#059669] text-[#070B13] text-[11px] font-black uppercase tracking-wider transition-colors cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </motion.button>
        <motion.button
          type="button"
          onClick={onReset}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-[10px] border text-[11px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
            isDark
              ? 'border-[#1E293B] text-slate-400 hover:text-white hover:border-slate-600'
              : 'border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-400'
          }`}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Start Over
        </motion.button>
      </div>

      {/* Support link */}
      <a
        href="https://discord.gg/arcnetwork"
        target="_blank"
        rel="noopener noreferrer"
        className={`mt-2.5 flex items-center justify-center gap-1 text-[10px] font-semibold ${isDark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-400 hover:text-slate-600'} transition-colors`}
      >
        Need help? Join Arc Discord
        <ExternalLink className="h-3 w-3" />
      </a>
    </motion.div>
  );
}
