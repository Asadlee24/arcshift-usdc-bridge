// components/bridge/CircleOnRampModal.tsx
// Circle Faucet & Pay On-Ramp Portal — supports getting testnet USDC and mainnet card purchases

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, CreditCard, Shield, Zap, Globe, ExternalLink,
  CheckCircle2, AlertCircle, ArrowUpRight, Coins
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { playClickSound } from '../../lib/audio';

interface CircleOnRampModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light';
}

function buildFaucetUrl(address?: string): string {
  const base = 'https://faucet.circle.com';
  if (address) return `${base}?address=${address}`;
  return base;
}

function buildCirclePayUrl(address?: string): string {
  const base = 'https://pay.circle.com';
  if (address) return `${base}?walletAddress=${address}`;
  return base;
}

export default function CircleOnRampModal({ isOpen, onClose, theme = 'light' }: CircleOnRampModalProps) {
  const { address, isConnected } = useAccount();
  const [selectedMode, setSelectedMode] = useState<'faucet' | 'card'>('faucet');

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const isDark = theme === 'dark';
  const faucetUrl = buildFaucetUrl(isConnected ? address : undefined);
  const circlePayUrl = buildCirclePayUrl(isConnected ? address : undefined);

  const cardBg    = isDark ? 'bg-[#0F172A] border-[#1E293B]' : 'bg-white border-slate-200';
  const textPrim  = isDark ? 'text-white'      : 'text-slate-900';
  const textMuted = isDark ? 'text-slate-400'  : 'text-slate-500';
  const tileBg    = isDark ? 'bg-[#131B2E] border-[#1E293B]' : 'bg-slate-50 border-slate-200';
  const activeTabClass = 'bg-[#10B981] text-[#070B13]';
  const inactiveTabClass = isDark ? 'bg-[#131B2E] text-slate-400 hover:text-white border-[#1E293B]' : 'bg-slate-100 text-slate-600 hover:text-slate-900 border-slate-200';

  const handleLaunchClick = (url: string) => {
    playClickSound();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleClose = () => {
    playClickSound();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{   opacity: 0, scale: 0.94, y: 24  }}
            transition={{ duration: 0.25, type: 'spring', stiffness: 280, damping: 24 }}
            className={`fixed inset-x-4 top-1/2 -translate-y-1/2 z-[100] mx-auto w-full max-w-[480px]
              rounded-[24px] border ${cardBg} shadow-2xl overflow-hidden p-6 select-none`}
          >
            {/* Close */}
            <button
              type="button"
              onClick={handleClose}
              className={`absolute top-4 right-4 z-10 p-1.5 rounded-full transition-colors cursor-pointer
                ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-5 pr-6">
              <div className="w-11 h-11 rounded-full bg-[#10B981]/15 flex items-center justify-center flex-shrink-0">
                <Coins className="h-5 w-5 text-[#10B981]" />
              </div>
              <div>
                <h2 className={`text-[16px] font-black uppercase tracking-wider ${textPrim}`}>Get USDC Tokens</h2>
                <p className={`text-[11px] font-semibold ${textMuted}`}>
                  Select faucet for testing or card payments for mainnet
                </p>
              </div>
            </div>

            {/* Mode Tabs Selector */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                type="button"
                onClick={() => { playClickSound(); setSelectedMode('faucet'); }}
                className={`py-2 px-3 text-xs font-black rounded-lg border transition-all cursor-pointer ${
                  selectedMode === 'faucet' ? activeTabClass : inactiveTabClass
                }`}
              >
                TESTNET FAUCET
              </button>
              <button
                type="button"
                onClick={() => { playClickSound(); setSelectedMode('card'); }}
                className={`py-2 px-3 text-xs font-black rounded-lg border transition-all cursor-pointer relative ${
                  selectedMode === 'card' ? activeTabClass : inactiveTabClass
                }`}
              >
                <span>BUY WITH CARD</span>
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                  Soon
                </span>
              </button>
            </div>

            {/* Connected Wallet Alert */}
            {isConnected && address ? (
              <div className={`rounded-[12px] border ${tileBg} px-3 py-2 mb-4 flex items-center gap-2`}>
                <CheckCircle2 className="h-3.5 w-3.5 text-[#10B981] flex-shrink-0" />
                <div className="min-w-0">
                  <p className={`text-[9px] font-semibold ${textMuted}`}>Recipient Wallet Address</p>
                  <p className={`text-[11.5px] font-mono font-black ${textPrim} truncate`}>
                    {address}
                  </p>
                </div>
              </div>
            ) : (
              <div className={`rounded-[12px] border px-3 py-2 mb-4 flex items-center gap-2
                ${isDark ? 'bg-amber-950/20 border-amber-900/30' : 'bg-amber-50 border-amber-200'}`}>
                <AlertCircle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                <p className={`text-[10px] font-semibold ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                  Connect your wallet first to auto-fill the destination address.
                </p>
              </div>
            )}

            {/* Content Area */}
            <AnimatePresence mode="wait">
              {selectedMode === 'faucet' ? (
                <motion.div
                  key="faucet-view"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="flex flex-col gap-4"
                >
                  <div className={`rounded-[12px] border ${tileBg} p-3`}>
                    <h3 className={`text-[11px] font-black uppercase tracking-wider ${textPrim} mb-1.5`}>
                      Circle Sandbox Faucet
                    </h3>
                    <p className={`text-[10px] font-semibold ${textMuted} leading-relaxed mb-3`}>
                      Claim free testnet USDC to test the bridging process. Follow these steps:
                    </p>
                    {[
                      'Click "Go to Faucet" below',
                      'Paste your wallet address in the input field',
                      'Select the source network (e.g., Ethereum Sepolia, Base Sepolia, Fuji)',
                      'Click "Request Tokens" — USDC arrives in 1-2 minutes'
                    ].map((step, i) => (
                      <div key={i} className="flex items-center gap-2 mb-1.5 last:mb-0">
                        <span className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-black bg-[#10B981]/15 text-[#10B981]">
                          {i + 1}
                        </span>
                        <p className={`text-[10.5px] font-semibold ${textMuted}`}>{step}</p>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleLaunchClick(faucetUrl)}
                    className="w-full h-11 rounded-xl bg-[#10B981] hover:bg-[#059669] text-[#070B13]
                      text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2
                      transition-colors cursor-pointer"
                  >
                    Go to Circle Faucet
                    <ArrowUpRight className="h-4 w-4" />
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="card-view"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="flex flex-col gap-4"
                >
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { icon: CreditCard, label: 'Credit Card', sub: 'Visa & Mastercard' },
                      { icon: Zap, label: 'Instant', sub: 'Settles in seconds' },
                      { icon: Shield, label: 'Secured', sub: 'Official Circle partner' },
                      { icon: Globe, label: 'Global', sub: '150+ countries' }
                    ].map(({ icon: Icon, label, sub }) => (
                      <div key={label} className={`rounded-[12px] border ${tileBg} p-2.5 flex flex-col gap-1`}>
                        <Icon className="h-4 w-4 text-[#10B981]" />
                        <p className={`text-[10px] font-black ${textPrim}`}>{label}</p>
                        <p className={`text-[9.5px] font-semibold ${textMuted} leading-tight`}>{sub}</p>
                      </div>
                    ))}
                  </div>

                  <div className={`rounded-[12px] border ${tileBg} p-3 border-rose-500/20`}>
                    <p className={`text-[10.5px] font-bold text-rose-500 leading-relaxed text-center`}>
                      Under development: Mainnet fiat-to-USDC card purchases will be enabled upon Arc mainnet release.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled
                    className={`w-full h-11 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-not-allowed ${
                      isDark ? 'bg-slate-800 text-slate-500 border border-slate-700' : 'bg-slate-200 text-slate-400 border border-slate-300'
                    }`}
                  >
                    Card Purchase Coming Soon
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <p className={`text-[9px] font-semibold text-center mt-4 leading-relaxed
              ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
              Both links open external official Circle services. ArcShift does not process or store any financial or identity data.
            </p>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
