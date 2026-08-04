// components/bridge/ChainPicker.tsx
// Dropdown chain picker component styled as a premium rounded-full Relay-link pill (Supports dark/light theme)

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Check, Search } from 'lucide-react';
import { SUPPORTED_CHAINS, ChainMetadata } from '../../constants/chains';
import { measureChainLatency } from '../../lib/rpcClient';

interface ChainPickerProps {
  selectedChain: ChainMetadata;
  onSelect: (chain: ChainMetadata) => void;
  disabledChains?: number[];
  label: string;
  theme?: 'dark' | 'light';
}

export default function ChainPicker({
  selectedChain,
  onSelect,
  disabledChains = [],
  label,
  theme = 'light',
}: ChainPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [latencies, setLatencies] = useState<Record<number, number>>({});

  // Dynamic real-time latency checks when picker is opened
  useEffect(() => {
    if (!isOpen) return;

    const activeChains = SUPPORTED_CHAINS.filter(c => !c.isComingSoon && !c.isSolana);

    // Probing stops when the picker closes, so a stale batch can't overwrite fresh readings.
    let isCancelled = false;

    // measureChainLatency goes through the shared client, which honours the endpoint
    // registry and the /api/rpc proxy. Probing chain.rpcUrl directly (as this did before)
    // meant Arc was reported as "off" purely because the browser blocked it on CORS, even
    // though the node was healthy.
    activeChains.forEach(async (chain) => {
      const latency = await measureChainLatency(chain.id);
      if (!isCancelled) {
        setLatencies(prev => ({ ...prev, [chain.id]: latency }));
      }
    });

    return () => { isCancelled = true; };
  }, [isOpen]);

  const handleSelect = (chain: ChainMetadata) => {
    if (disabledChains.includes(chain.id)) return;
    onSelect(chain);
    setIsOpen(false);
    setSearchQuery('');
  };

  // Filter chains — exclude Arc Testnet from FROM picker, exclude non-arc from TO picker  
  const filteredChains = SUPPORTED_CHAINS.filter(chain =>
    chain.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chain.shortName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group: Active (EVM + Solana), Coming Soon
  const activeChains    = filteredChains.filter(c => !c.isComingSoon);
  const comingSoonChains   = filteredChains.filter(c => c.isComingSoon);

  const isDark = theme === 'dark';

  // Dynamic theme mappings
  const buttonStyle = isDark 
    ? 'bg-[#0F172A] hover:bg-[#182235] border-[#1E293B] text-white' 
    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-900 shadow-sm';
  const popoverStyle = isDark 
    ? 'bg-[#0F172A] border-[#1E293B]' 
    : 'bg-white border-slate-200 shadow-xl';
  const searchBg = isDark 
    ? 'bg-[#131B2E] border-[#1E293B]' 
    : 'bg-slate-50 border-slate-200';
  const searchInputColor = isDark ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';
  const textChainName = isDark ? 'text-white' : 'text-slate-900';
  const buttonOptionStyle = (isSelected: boolean, isDisabled: boolean) => {
    if (isSelected) return 'bg-[#10B981]/15 text-[#10B981]';
    if (isDisabled) return 'opacity-40 cursor-not-allowed';
    return isDark 
      ? 'hover:bg-[#131B2E] text-slate-300 hover:text-white' 
      : 'hover:bg-slate-50 text-slate-700 hover:text-slate-900';
  };

  return (
    <div className="relative flex-shrink-0" ref={dropdownRef}>
      
      {/* Relay-style select pill trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex h-11 items-center justify-between gap-1 sm:gap-2 rounded-full border px-2 sm:px-3 text-xs sm:text-sm font-semibold transition-colors duration-150 cursor-pointer select-none ${buttonStyle}`}
        style={{ outline: 'none' }}
      >
        <div className="flex items-center gap-2 text-left">
          {/* Chain Logo */}
          <div className="relative h-6 w-6 rounded-full bg-[#10B981]/15 p-[1.5px] flex-shrink-0">
            <img
              src={selectedChain.iconUrl}
              alt={selectedChain.name}
              className="h-full w-full object-contain rounded-full bg-slate-950"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            {/* Small USDC corner badge */}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-blue-600 border border-slate-950 flex items-center justify-center text-[5px] text-white font-bold font-mono">
              $
            </span>
          </div>
          
          <div className="flex flex-col select-none">
            <span className={`font-bold text-[12px] leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>USDC</span>
            <span className={`${textMuted} text-[10px] font-medium leading-none`}>{selectedChain.shortName}</span>
          </div>
        </div>

        <ChevronRight className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
      </button>

      {/* Popover list */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`absolute right-0 z-50 mt-1.5 w-64 rounded-[12px] p-2 border shadow-relay-dropdown ${popoverStyle}`}
          >
            {/* Search Input Box */}
            <div className={`flex items-center gap-1.5 rounded-[8px] px-2 py-1.5 mb-2 border ${searchBg}`}>
              <Search className="h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search chains..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full bg-transparent text-[11px] font-semibold focus:outline-none ${searchInputColor}`}
              />
            </div>

            {/* List */}
            <div className="max-h-72 overflow-y-auto custom-scrollbar">

              {/* Active chains */}
              {activeChains.length > 0 && (
                <>
                  <p className={`px-2 py-1 text-[9px] font-black uppercase tracking-wider ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                    Active Networks
                  </p>
                  {activeChains.map((chain) => {
                    const isSelected = chain.appKitId === selectedChain.appKitId;
                    const isDisabled = disabledChains.includes(chain.id);
                    return (
                      <button
                        key={chain.appKitId}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => handleSelect(chain)}
                        className={`flex w-full items-center justify-between rounded-[8px] px-2.5 py-2 text-left text-xs font-semibold transition-colors duration-100 mb-0.5 last:mb-0 cursor-pointer ${buttonOptionStyle(isSelected, isDisabled)}`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-5 w-5 rounded-full bg-[#10B981]/10 p-[1px] flex-shrink-0 flex items-center justify-center" style={{ minWidth: 20 }}>
                            <img
                              src={chain.iconUrl}
                              alt={chain.name}
                              className="h-full w-full object-contain rounded-full"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          </div>
                          <div className="flex flex-col">
                            <span className={`font-bold leading-tight flex items-center gap-1 ${textChainName}`}>
                              {chain.name}
                              {chain.isSolana ? (
                                <span className="inline-flex items-center rounded-full bg-purple-950/40 border border-purple-900/30 px-1 text-[8px] font-semibold text-purple-400">Solana</span>
                              ) : chain.isNativeArc && (
                                <span className="inline-flex items-center rounded-full bg-emerald-950/40 border border-emerald-900/30 px-1 text-[8px] font-semibold text-[#10B981]">Native</span>
                              )}
                            </span>
                            {chain.isSolana ? (
                              <span className={`${isDark ? 'text-slate-500' : 'text-slate-400'} text-[9px] font-medium`}>Non-EVM</span>
                            ) : (
                              <span className={`${isDark ? 'text-slate-500' : 'text-slate-400'} text-[9px] font-medium`}>Chain ID: {chain.id}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {latencies[chain.id] !== undefined && !chain.isSolana && (
                            <div className="flex items-center gap-1 select-none pr-1">
                              <span className={`h-1.5 w-1.5 rounded-full ${
                                latencies[chain.id] === -1
                                  ? 'bg-red-500 animate-pulse'
                                  : latencies[chain.id] < 200
                                  ? 'bg-emerald-500'
                                  : latencies[chain.id] < 500
                                  ? 'bg-amber-500'
                                  : 'bg-red-400'
                              }`} />
                              <span className="text-[9px] font-mono font-semibold text-slate-500">
                                {latencies[chain.id] === -1 ? 'off' : `${latencies[chain.id]}ms`}
                              </span>
                            </div>
                          )}
                          {isSelected && <Check className="h-3.5 w-3.5 text-[#10B981]" />}
                        </div>
                      </button>
                    );
                  })}
                </>
              )}

              {/* Coming Soon */}
              {comingSoonChains.length > 0 && (
                <>
                  <p className={`px-2 pt-2 pb-1 text-[9px] font-black uppercase tracking-wider ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                    Coming Soon
                  </p>
                  {comingSoonChains.map((chain) => (
                    <button
                      key={chain.appKitId}
                      type="button"
                      disabled
                      className={`flex w-full items-center justify-between rounded-[8px] px-2.5 py-2 text-left text-xs font-semibold mb-0.5 opacity-45 cursor-not-allowed`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-full bg-slate-500/10 p-[1px] flex-shrink-0" style={{ minWidth: 20 }}>
                          <img
                            src={chain.iconUrl}
                            alt={chain.name}
                            className="h-full w-full object-contain rounded-full"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        </div>
                        <div className="flex flex-col">
                          <span className={`font-bold leading-tight ${textChainName}`}>{chain.name}</span>
                          <span className={`text-[9px] font-medium ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                            Coming Soon
                          </span>
                        </div>
                      </div>
                      <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-[4px] ${
                        isDark ? 'bg-[#131B2E] text-slate-500' : 'bg-slate-100 text-slate-400'
                      }`}>
                        Soon
                      </span>
                    </button>
                  ))}
                </>
              )}

              {filteredChains.length === 0 && (
                <div className={`text-center py-4 text-[11px] font-medium ${textMuted}`}>
                  No chains found
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
