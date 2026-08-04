// components/bridge/UnifiedPortfolioDrawer.tsx
// A premium drawer detailing the user's Unified USDC Portfolio across all 16 networks with parallel RPC loading and Gas advantage comparison

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wallet, Shield, ArrowUpRight, TrendingUp, Info, HelpCircle, Activity, Sparkles } from 'lucide-react';
import { useAccount } from 'wagmi';
import { SUPPORTED_CHAINS, ChainMetadata } from '../../constants/chains';
import { playClickSound } from '../../lib/audio';

// Solana Wallet & Web3 Imports
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey as SolanaPublicKey } from '@solana/web3.js';
import { readErc20Balance } from '../../lib/rpcClient';

interface UnifiedPortfolioDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light';
}

interface ChainBalanceState {
  chain: ChainMetadata;
  balance: number;
  isLoading: boolean;
  isError: boolean;
}

// USDC is 6-decimal on every chain in this app.
const USDC_DECIMALS = 6;

async function fetchSingleChainBalance(chain: ChainMetadata, userAddress: string, solanaAddress?: string): Promise<number> {
  if (chain.isComingSoon) return 0;

  if (chain.isSolana) {
    if (!solanaAddress) return 0;
    try {
      const connection = new Connection(chain.rpcUrl, 'confirmed');
      const pubKey = new SolanaPublicKey(solanaAddress);
      const mintPubKey = new SolanaPublicKey(chain.usdcAddress);
      
      const response = await connection.getParsedTokenAccountsByOwner(pubKey, {
        mint: mintPubKey,
      });
      if (response.value.length > 0) {
        const amount = response.value[0].account.data.parsed.info.tokenAmount.uiAmount;
        return amount || 0;
      }
    } catch (err) {
      console.warn("Failed to fetch Solana USDC balance:", err);
    }
    return 0;
  }
  
  if (!userAddress) return 0;

  // Endpoint selection, failover, and timeouts come from lib/rpcClient. This previously kept
  // its own BACKUP_RPCS copy which listed dead endpoints (Blast 403, rpc.sepolia.org 404,
  // rpc-amoy.polygon.technology unreachable) and hit Arc's CORS-blocked RPC directly, so the
  // Arc row could never load and several others burned a full timeout first.
  const balance = await readErc20Balance(chain.id, chain.usdcAddress, userAddress, USDC_DECIMALS);
  return balance ?? 0;
}

export default function UnifiedPortfolioDrawer({ isOpen, onClose, theme = 'light' }: UnifiedPortfolioDrawerProps) {
  const { address, isConnected } = useAccount();
  const { publicKey } = useWallet();
  const solanaAddress = publicKey?.toBase58();

  const [balances, setBalances] = useState<ChainBalanceState[]>([]);
  const [totalUnifiedBalance, setTotalUnifiedBalance] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isDark = theme === 'dark';

  // Styles
  const drawerBg = isDark ? 'bg-[#070B13] border-[#1E293B]' : 'bg-white border-slate-200';
  const textPrim = isDark ? 'text-white' : 'text-slate-900';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';
  const sectionBg = isDark ? 'bg-[#0F172A] border-[#1E293B]' : 'bg-slate-50 border-slate-200';
  const cardHighlight = isDark ? 'bg-gradient-to-r from-emerald-950/40 to-[#131B2E] border-emerald-500/20' : 'bg-gradient-to-r from-emerald-50 to-emerald-100/50 border-emerald-200';

  // Load balances in parallel
  const loadBalances = async () => {
    if (!address && !solanaAddress) {
      setBalances([]);
      setTotalUnifiedBalance(0);
      return;
    }

    setIsRefreshing(true);
    
    // Initialize state
    const initialStates: ChainBalanceState[] = SUPPORTED_CHAINS.map(c => ({
      chain: c,
      balance: 0,
      isLoading: !c.isComingSoon,
      isError: false
    }));
    setBalances(initialStates);

    try {
      const promises = SUPPORTED_CHAINS.map(async (c) => {
        if (c.isComingSoon) return { chainId: c.id, balance: 0, error: false };
        try {
          const bal = await fetchSingleChainBalance(c, address || '', solanaAddress);
          return { chainId: c.id, balance: bal, error: false };
        } catch {
          return { chainId: c.id, balance: 0, error: true };
        }
      });

      const results = await Promise.all(promises);

      // Update state
      let sum = 0;
      const updatedStates = initialStates.map(state => {
        const found = results.find(r => r.chainId === state.chain.id);
        if (found) {
          let adjustedBalance = found.balance;
          if (state.chain.id === 5042002 && typeof window !== 'undefined' && address) {
            const localOffset = parseFloat(localStorage.getItem(`arc_credit_USDC_${address}`) || '0');
            adjustedBalance = Math.max(0, adjustedBalance + localOffset);
          }
          sum += adjustedBalance;
          return {
            ...state,
            balance: adjustedBalance,
            isLoading: false,
            isError: found.error
          };
        }
        return { ...state, isLoading: false };
      });

      setBalances(updatedStates);
      setTotalUnifiedBalance(sum);
    } catch (e) {
      console.error('Failed to load portfolio balances:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadBalances();
    }
  }, [isOpen, address, isConnected, solanaAddress]);

  const handleClose = () => {
    playClickSound();
    onClose();
  };

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
                  <Wallet className="h-5 w-5 text-[#10B981]" />
                  <h2 className={`text-base font-black uppercase tracking-wider ${textPrim}`}>
                    Unified Portfolio
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={loadBalances}
                    disabled={isRefreshing || !isConnected}
                    className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-[6px] transition-colors border cursor-pointer ${
                      isRefreshing
                        ? 'border-slate-700 text-slate-500 cursor-not-allowed'
                        : isDark
                          ? 'border-[#1E293B] text-slate-300 hover:bg-[#131B2E] hover:text-white'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {isRefreshing ? 'REFRESHING...' : 'REFRESH'}
                  </button>
                  <button
                    onClick={handleClose}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-slate-500/10 ${textMuted} hover:${textPrim}`}
                  >
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">

                {/* 1. Unified Balance Dashboard */}
                <div className={`p-5 rounded-2xl border flex flex-col gap-3.5 relative overflow-hidden ${
                  isDark 
                    ? 'bg-[#0F172A] border-[#1E293B]' 
                    : 'bg-white border-slate-200/80 shadow-sm'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-extrabold uppercase tracking-wider ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      My USDC Across All Chains:
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 text-[8px] font-black uppercase tracking-wider">
                      Circle Gateway
                    </span>
                  </div>

                  {/* Chain Breakdowns */}
                  <div className="flex flex-col gap-2 mt-1">
                    {(balances || []).filter(item => item && item.chain && !item.chain.isComingSoon).map((item) => (
                      <div key={item.chain.id} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <img
                            src={item.chain.iconUrl}
                            alt={item.chain.name}
                            className="w-4.5 h-4.5 rounded-full object-cover"
                          />
                          <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            {item.chain.name}
                          </span>
                        </div>
                        
                        <span className={`font-mono font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                          {item.isLoading ? (
                            <span className="opacity-50 animate-pulse text-[10px]">Loading...</span>
                          ) : item.isError ? (
                            <span className="text-rose-500 text-[10px]">Error</span>
                          ) : (
                            `${(item.balance || 0).toFixed(2)} USDC`
                          )}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Divider */}
                  <div className="border-t border-slate-500/10 pt-2" />

                  {/* Total Row */}
                  <div className="flex items-center justify-between text-xs font-black">
                    <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>Total</span>
                    <span className="font-mono text-sm font-black text-[#10B981]">
                      {isRefreshing ? (
                        <span className="text-xs opacity-50 animate-pulse">Calculating...</span>
                      ) : (
                        `${(totalUnifiedBalance || 0).toFixed(2)} USDC`
                      )}
                    </span>
                  </div>
                </div>

                {/* 2. Arc L1 Gas Advantage Insight */}
                <div className={`p-4 rounded-[16px] border ${sectionBg} flex flex-col gap-2.5`}>
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-[#10B981]" />
                    <h4 className={`text-[11px] font-black uppercase tracking-wider ${textPrim}`}>
                      Arc Gas Fees Advantage
                    </h4>
                  </div>
                  <p className={`text-[10px] font-semibold ${textMuted} leading-relaxed`}>
                    Arc Network uses USDC directly as its native gas token. Under EIP-1559 EWMA smoothing, transaction fees are stablecoin-native and highly predictable:
                  </p>
                  
                  <div className="flex flex-col gap-2 mt-1">
                    {/* Arc L1 Gas */}
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center text-[9px] font-bold">
                        <span className="text-[#10B981]">Arc L1 gas fee (USDC native)</span>
                        <span className="text-[#10B981] font-mono">$0.01 fixed</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div className="w-[3%] h-full bg-[#10B981]" />
                      </div>
                    </div>
                    {/* Other Chains Gas */}
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center text-[9px] font-bold">
                        <span className="text-slate-400">Other networks gas fee (variable)</span>
                        <span className="text-slate-400 font-mono">$0.50 - $2.50+</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div className="w-[85%] h-full bg-slate-500" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Chains List */}
                <div className="flex flex-col gap-2.5">
                  <h4 className={`text-[10px] font-black uppercase tracking-widest ${textMuted}`}>
                    Assets by Blockchain
                  </h4>

                  {!isConnected ? (
                    <div className="text-center py-12 text-slate-500 font-semibold text-xs border border-dashed border-slate-700/20 rounded-[16px]">
                      Connect your wallet to view portfolio assets.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {balances.map((item) => (
                        <div
                          key={item.chain.id}
                          className={`p-3 rounded-[12px] border ${sectionBg} flex items-center justify-between transition-all hover:border-slate-500/25`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={item.chain.iconUrl}
                              alt={item.chain.name}
                              className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                            />
                            <div className="min-w-0">
                              <h5 className={`text-[11px] font-bold ${textPrim} truncate`}>
                                {item.chain.name}
                              </h5>
                              <p className="text-[9px] font-semibold text-slate-500">
                                {item.chain.isNativeArc ? 'Native Gas Chain' : `CCTP Domain ${item.chain.cctpDomain}`}
                              </p>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            {item.chain.isComingSoon ? (
                              <span className="text-[9px] font-black uppercase tracking-wider text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-[4px]">
                                Soon
                              </span>
                            ) : item.isLoading ? (
                              <span className="text-[10px] font-semibold text-slate-500 animate-pulse">
                                Loading...
                              </span>
                            ) : item.isError ? (
                              <span className="text-[10px] font-semibold text-rose-500" title="RPC timeout">
                                Error
                              </span>
                            ) : (
                              <div className="flex flex-col items-end">
                                <span className={`text-[12px] font-mono font-black ${textPrim}`}>
                                  {item.balance.toFixed(2)}
                                </span>
                                <span className="text-[8px] font-bold text-slate-400">USDC</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-700/10 dark:border-slate-800/60 text-center">
                <p className={`text-[9px] font-semibold ${textMuted} leading-relaxed`}>
                  Unified Portfolio is a simulated circle gateway implementation aggregating multichain testnet balances.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
