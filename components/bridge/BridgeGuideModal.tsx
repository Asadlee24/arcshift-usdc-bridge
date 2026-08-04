// components/bridge/BridgeGuideModal.tsx
// A premium, beautifully styled guide modal for the ArcShift USDC Bridge with clean UX and rich neon aesthetics.

'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, ShieldAlert, Sparkles, RefreshCw, Zap } from 'lucide-react';
import { playClickSound } from '../../lib/audio';

interface BridgeGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light';
}

export default function BridgeGuideModal({ isOpen, onClose, theme = 'light' }: BridgeGuideModalProps) {
  const isDark = theme === 'dark';

  const overlayBg = 'bg-black/75 backdrop-blur-md';
  const modalBg = isDark 
    ? 'bg-gradient-to-b from-[#0B0F19] to-[#05070B] text-white' 
    : 'bg-white text-slate-900';
  const modalBorder = isDark ? 'border-[#1E293B]' : 'border-slate-200';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';
  const cardBg = isDark ? 'bg-[#0E1527]/80 border-[#1E293B]' : 'bg-slate-50/80 border-slate-200';

  const handleClose = () => {
    playClickSound();
    onClose();
  };

  const steps = [
    { num: '01', title: 'Approve', desc: 'Unlock USDC spending on the source network.' },
    { num: '02', title: 'Burn', desc: 'Securely lock and burn USDC on-chain.' },
    { num: '03', title: 'Attest', desc: 'Circle verifies and signs the transaction proof.' },
    { num: '04', title: 'Claim', desc: 'Submit proof to mint native USDC on destination.' }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay backdrop with soft blur */}
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
            className={`relative w-full max-w-xl max-h-[85vh] overflow-y-auto ${modalBg} border ${modalBorder} rounded-[28px] p-6 shadow-[0_0_50px_-12px_rgba(16,185,129,0.15)] flex flex-col gap-5 select-none z-10`}
          >
            {/* Background glowing accents */}
            {isDark && (
              <div className="absolute top-[-10%] right-[-10%] w-[180px] h-[180px] rounded-full bg-[#10B981]/10 blur-[60px] pointer-events-none" />
            )}

            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4 border-slate-700/10 dark:border-slate-800/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#10B981]/10 rounded-xl">
                  <BookOpen className="h-5 w-5 text-[#10B981]" />
                </div>
                <div>
                  <h2 className="text-base font-black uppercase tracking-wider">
                    How it Works
                  </h2>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                    ArcShift USDC Bridge
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
              <div className="flex flex-col gap-2.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#10B981] flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  Bridging Workflow
                </span>
                
                <div className="grid grid-cols-2 gap-3">
                  {steps.map((item, idx) => (
                    <div 
                      key={item.num} 
                      className={`p-3.5 rounded-2xl border ${cardBg} transition-all duration-300 hover:border-[#10B981]/40 flex flex-col gap-1.5 group`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black tracking-widest text-[#10B981]/80">{item.num}</span>
                        <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <h3 className="text-xs font-extrabold uppercase tracking-wide">{item.title}</h3>
                      <p className={`text-[10.5px] font-medium leading-relaxed ${textMuted}`}>{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mode Selection Breakdown */}
              <div className="flex flex-col gap-2.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#10B981] flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" />
                  Selectable Bridge Modes
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className={`p-4 rounded-2xl border ${cardBg} flex flex-col gap-1.5`}>
                    <h4 className="text-xs font-extrabold uppercase text-slate-400">Standard Mode</h4>
                    <p className={`text-[10.5px] font-medium leading-relaxed ${textMuted}`}>
                      User pays gas on both chains. Network switch and claim transaction required on destination chain.
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-[#10B981]/5 to-transparent flex flex-col gap-1.5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 h-16 w-16 bg-[#10B981]/5 rounded-full blur-xl pointer-events-none" />
                    <h4 className="text-xs font-extrabold uppercase text-[#10B981] flex items-center gap-1">
                      Relayed Mode
                      <span className="text-[8px] bg-[#10B981]/10 px-1 rounded font-black">GASLESS</span>
                    </h4>
                    <p className={`text-[10.5px] font-medium leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Gasless claim! A flat 0.50 USDC fee is deducted, and our background relayer automatically mints USDC for you.
                    </p>
                  </div>
                </div>
              </div>

              {/* Stuck / Rescue Safety block */}
              <div className="p-4 rounded-2xl border border-amber-500/15 bg-amber-500/5 flex items-start gap-3">
                <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-500 flex-shrink-0 mt-0.5">
                  <ShieldAlert className="h-4 w-4" />
                </div>
                <div className="flex flex-col gap-1">
                  <h4 className="text-xs font-extrabold uppercase text-amber-500 tracking-wide">
                    Rescue stuck transactions
                  </h4>
                  <p className={`text-[10.5px] font-medium leading-relaxed ${textMuted}`}>
                    If you close your browser or reject a step, use the **Transaction History (clock icon)** in the navbar to scan and resume your claim safely.
                  </p>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="border-t pt-4 border-slate-700/10 dark:border-slate-800/60 flex justify-end">
              <button
                onClick={handleClose}
                className="h-10 px-6 rounded-xl bg-[#10B981] hover:bg-[#0D9488] text-[#070B13] text-xs font-black uppercase tracking-wider cursor-pointer transition-all duration-200 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]"
              >
                Let's Bridge
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
