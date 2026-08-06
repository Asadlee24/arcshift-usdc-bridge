// components/bridge/BridgeGuideModal.tsx
// Ultra-sleek guide modal for ArcShift CCTP v2 Bridge — auto-relay & 1-signature workflow

'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, ShieldAlert, Sparkles, Zap, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';
import { playClickSound } from '../../lib/audio';

interface BridgeGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light';
}

export default function BridgeGuideModal({ isOpen, onClose, theme = 'light' }: BridgeGuideModalProps) {
  const isDark = theme === 'dark';

  const overlayBg = 'bg-black/80 backdrop-blur-md';
  const modalBg = isDark 
    ? 'bg-[#0D1B2E] text-white border-slate-800' 
    : 'bg-white text-slate-900 border-slate-200';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';
  const cardBg = isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200';

  const handleClose = () => {
    playClickSound();
    onClose();
  };

  const steps = [
    {
      num: '01',
      title: 'Approve Spend',
      desc: 'Grant one-time USDC spend permission for Circle TokenMessenger on source chain.',
    },
    {
      num: '02',
      title: 'Burn & Forward',
      desc: 'USDC is burned on source chain with Circle depositForBurnWithHook auto-relay instructions.',
    },
    {
      num: '03',
      title: 'Circle Auto-Relay',
      desc: 'Circle Iris verifies consensus signatures and automatically mints native USDC on destination.',
    },
  ];

  const features = [
    {
      title: '1 Wallet Signature',
      desc: 'Approve + Burn in one action. Destination mint happens automatically.',
    },
    {
      title: 'Native USDC Only',
      desc: 'No wrapped synthetic tokens or third-party liquidity pools.',
    },
    {
      title: 'Fast & Gas Optimized',
      desc: 'Fast mode finality (~15s) with automated CCTP fee calculation.',
    },
    {
      title: 'EVM + Solana Support',
      desc: 'Seamless transfers across EVM chains and Solana Devnet ATAs.',
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
          {/* Overlay backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className={`absolute inset-0 ${overlayBg}`}
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
            className={`relative w-full max-w-xl max-h-[85vh] overflow-y-auto ${modalBg} border rounded-[28px] p-6 shadow-2xl flex flex-col gap-5 z-10`}
          >
            {/* Header */}
            <div className={`flex items-center justify-between border-b pb-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#C8922A]/15 border border-[#C8922A]/25 rounded-2xl">
                  <BookOpen className="h-5 w-5 text-[#C8922A]" />
                </div>
                <div>
                  <h2 className="text-base font-black uppercase tracking-wider">
                    How Auto-Relay Works
                  </h2>
                  <p className="text-[10px] font-bold text-[#C8922A] uppercase tracking-widest mt-0.5">
                    Circle CCTP v2 Forwarding Service
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className={`p-2 rounded-xl transition-all cursor-pointer hover:bg-slate-500/10 ${textMuted} hover:text-white`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex flex-col gap-6">
              
              {/* Step Sequence Diagram */}
              <div className="flex flex-col gap-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#C8922A] flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  3-Step Auto-Relay Workflow
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {steps.map((item) => (
                    <div 
                      key={item.num} 
                      className={`p-4 rounded-2xl border ${cardBg} transition-all duration-300 hover:border-[#C8922A]/40 flex flex-col gap-2 group`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black tracking-widest text-[#C8922A] font-mono">{item.num}</span>
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      </div>
                      <h3 className="text-xs font-black uppercase tracking-wide">{item.title}</h3>
                      <p className={`text-[10.5px] font-medium leading-relaxed ${textMuted}`}>{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Protocol Key Features */}
              <div className="flex flex-col gap-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" />
                  CCTP v2 Protocol Highlights
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {features.map((f) => (
                    <div key={f.title} className={`p-3.5 rounded-2xl border ${cardBg} flex items-start gap-2.5`}>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-black uppercase">{f.title}</h4>
                        <p className={`text-[10.5px] font-medium mt-0.5 leading-relaxed ${textMuted}`}>{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Safety & History Tip */}
              <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50 border-slate-200'} flex items-start gap-3`}>
                <div className="p-2 bg-[#C8922A]/15 rounded-xl text-[#C8922A] shrink-0 mt-0.5">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase text-[#C8922A]">
                    Live Transaction Tracking
                  </h4>
                  <p className={`text-[10.5px] font-medium mt-0.5 leading-relaxed ${textMuted}`}>
                    You can monitor live relay status in real-time. Use the **History (clock icon)** in the top navigation bar to view your full bridging history anytime.
                  </p>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className={`border-t pt-4 ${isDark ? 'border-slate-800' : 'border-slate-100'} flex justify-end`}>
              <button
                onClick={handleClose}
                className="h-11 px-6 rounded-xl bg-gradient-to-r from-[#C8922A] via-[#D4A043] to-[#E8A830] hover:brightness-110 text-white text-xs font-black uppercase tracking-wider cursor-pointer transition-all duration-200 shadow-md shadow-[#C8922A]/20 flex items-center gap-1.5"
              >
                <span>Start Bridging</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
