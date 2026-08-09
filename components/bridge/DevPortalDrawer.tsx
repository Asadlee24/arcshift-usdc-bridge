// components/bridge/DevPortalDrawer.tsx
// A premium developer drawer allowing builders to customize, live preview, and copy embed code for the Bridgr USDC Bridge Widget

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Code, Copy, Check, ExternalLink, Terminal, Sparkles } from 'lucide-react';
import { playClickSound } from '../../lib/audio';

interface DevPortalDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light';
}

export default function DevPortalDrawer({ isOpen, onClose, theme = 'light' }: DevPortalDrawerProps) {
  const isDark = theme === 'dark';
  const [widgetTheme, setWidgetTheme] = useState<'dark' | 'light'>('dark');
  const [widgetChain, setWidgetChain] = useState<string>('ethereum');
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('https://bridgr-bridge.vercel.app'); // ⚠️ FLAG: update to new Vercel domain when assigned

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const widgetUrl = `${origin}/?widget=true&theme=${widgetTheme}&from=${widgetChain}`;
  const iframeCode = `<iframe\n  src="${widgetUrl}"\n  width="450"\n  height="580"\n  style="border: none; border-radius: 24px; box-shadow: 0 4px 20px rgba(16, 185, 129, 0.15);"\n/>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(iframeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    playClickSound();
    onClose();
  };

  // Styles
  const drawerBg = isDark ? 'bg-[#070B13] border-[#1E293B]' : 'bg-white border-slate-200';
  const textPrim = isDark ? 'text-white' : 'text-slate-900';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';
  const blockBg = isDark ? 'bg-[#0F172A] border-[#1E293B]' : 'bg-slate-50 border-slate-200';
  const selectBorder = isDark ? 'border-slate-800' : 'border-slate-200';
  const labelColor = isDark ? 'text-slate-300' : 'text-slate-700';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden select-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Drawer Wrapper */}
          <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className={`w-screen max-w-md border-l ${drawerBg} flex flex-col`}
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-700/10 dark:border-slate-800/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code className="h-5 w-5 text-[#10B981]" />
                  <h2 className={`text-base font-black uppercase tracking-wider ${textPrim}`}>
                    Developer Widget SDK
                  </h2>
                </div>
                <button
                  onClick={handleClose}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-slate-500/10 ${textMuted} hover:${textPrim}`}
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
                
                {/* Description info block */}
                <div className={`p-4 rounded-xl border ${blockBg} flex flex-col gap-2`}>
                  <div className="flex items-center gap-1.5 text-xs font-black text-[#10B981] uppercase tracking-wider">
                    <Sparkles className="h-3.5 w-3.5" />
                    Expand Your Platform
                  </div>
                  <p className={`text-[11px] font-semibold ${textMuted} leading-relaxed`}>
                    Embed the Bridgr USDC Bridge directly into your dApp, NFT marketplace, game client, or portfolio. Enable players and users to bridge assets to Arc Network without leaving your site.
                  </p>
                </div>

                {/* 1. Customization Settings */}
                <div className="flex flex-col gap-3">
                  <span className={`text-[10px] font-black uppercase tracking-wider ${textMuted}`}>
                    Customize Widget Parameters:
                  </span>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Widget Theme Toggle */}
                    <div className="flex flex-col gap-1.5">
                      <label className={`text-[10px] font-bold uppercase tracking-wider ${labelColor}`}>
                        Widget Theme
                      </label>
                      <select
                        value={widgetTheme}
                        onChange={(e) => setWidgetTheme(e.target.value as 'dark' | 'light')}
                        className={`w-full h-8 px-2 rounded-lg border text-xs font-bold bg-transparent outline-none focus:border-[#10B981] cursor-pointer ${selectBorder} ${textPrim}`}
                      >
                        <option className="bg-[#0F172A] text-white" value="dark">Dark Theme</option>
                        <option className="bg-white text-slate-900" value="light">Light Theme</option>
                      </select>
                    </div>

                    {/* Default Chain Selection */}
                    <div className="flex flex-col gap-1.5">
                      <label className={`text-[10px] font-bold uppercase tracking-wider ${labelColor}`}>
                        Default From Chain
                      </label>
                      <select
                        value={widgetChain}
                        onChange={(e) => setWidgetChain(e.target.value)}
                        className={`w-full h-8 px-2 rounded-lg border text-xs font-bold bg-transparent outline-none focus:border-[#10B981] cursor-pointer ${selectBorder} ${textPrim}`}
                      >
                        <option className="bg-[#0F172A] text-white" value="ethereum">Ethereum Sepolia</option>
                        <option className="bg-[#0F172A] text-white" value="base">Base Sepolia</option>
                        <option className="bg-[#0F172A] text-white" value="arbitrum">Arbitrum Sepolia</option>
                        <option className="bg-[#0F172A] text-white" value="optimism">Optimism Sepolia</option>
                        <option className="bg-[#0F172A] text-white" value="avalanche">Avalanche Fuji</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. Embedded Iframe Live Preview Container */}
                <div className="flex flex-col gap-2">
                  <span className={`text-[10px] font-black uppercase tracking-wider ${textMuted}`}>
                    Live Preview:
                  </span>
                  
                  <div className={`w-full rounded-xl border flex items-center justify-center relative overflow-hidden bg-slate-500/5 ${selectBorder}`} style={{ height: '280px' }}>
                    {/* Live iframe widget rendering */}
                    <iframe
                      src={widgetUrl}
                      title="Bridgr Bridge Widget Preview"
                      className="w-full h-full border-none transform scale-[0.6] origin-center"
                      style={{ width: '166%', height: '166%' }} // Upscaled and scaled down to preview perfectly inside a smaller container
                    />
                  </div>
                </div>

                {/* 3. Integration Code block */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${textMuted}`}>
                      HTML Embed Snippet:
                    </span>
                    <button
                      onClick={handleCopy}
                      className="text-[9px] font-black uppercase tracking-wider text-[#10B981] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3 w-3" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Copy Snippet
                        </>
                      )}
                    </button>
                  </div>

                  <div className={`p-4 rounded-xl border font-mono text-[9px] whitespace-pre overflow-x-auto ${blockBg} text-slate-400`}>
                    <code>{iframeCode}</code>
                  </div>
                </div>

              </div>

              {/* Footer info brand tag */}
              <div className={`p-4 border-t border-slate-700/10 dark:border-slate-800/60 flex items-center justify-between text-[10px] font-bold ${textMuted}`}>
                <span className="flex items-center gap-1">
                  <Terminal className="h-3 w-3 text-[#10B981]" />
                  v1.0.0 Widget SDK
                </span>
                <a
                  href="https://github.com/Asadlee24/arcshift-usdc-bridge" // ⚠️ FLAG: update href when GitHub repo is renamed
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#10B981] flex items-center gap-0.5 transition-colors"
                >
                  GitHub docs
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>

            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
