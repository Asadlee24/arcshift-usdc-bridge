// components/bridge/BridgeCard.tsx
// Ultra-sleek Bridge Card component — stable USDC CCTP v2 auto-relay between Arc Mainnet and EVM chains

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, Zap, AlertTriangle } from 'lucide-react';

import ChainPicker from './ChainPicker';
import SwapChainsBtn from './SwapChainsBtn';
import BridgeButton from './BridgeButton';
import StepTracker from './StepTracker';
import SuccessView from './SuccessView';
import FeeBreakdownPanel, { SpeedMode } from './FeeBreakdownPanel';
import ErrorRecoveryPanel from './ErrorRecoveryPanel';

import { getChainById, SUPPORTED_CHAINS } from '../../constants/chains';
import { useUSDCBalance } from '../../hooks/useUSDCBalance';
import { useBridge, validateBridgeAmount } from '../../hooks/useBridge';
import { useAccount } from 'wagmi';
import { useWallet } from '@solana/wallet-adapter-react';
import { playClickSound, playChargeSound, playSuccessSound } from '../../lib/audio';
import { getActiveEnvironment } from '../../lib/registry';
import { isRoutePaused } from '../../lib/registry/pauseControls';
import { getRouteFeeQuote, calculateMaxBridgeAmount, RouteQuote } from '../../lib/bridge/quotes';

interface BridgeCardProps {
  theme?: 'dark' | 'light';
}

export default function BridgeCard({ theme = 'light' }: BridgeCardProps) {
  const { isConnected, address } = useAccount();
  const solanaWallet = useWallet();

  const isMainnet = getActiveEnvironment() === 'mainnet';
  const defaultFromId = isMainnet ? 8453 : 84532;     // Base Mainnet / Base Sepolia
  const defaultToId = isMainnet ? 5042 : 5042002;      // Arc Mainnet / Arc Testnet

  const [fromChain, setFromChain] = useState(() => getChainById(defaultFromId) || SUPPORTED_CHAINS[0]);
  const [toChain, setToChain] = useState(() => getChainById(defaultToId) || SUPPORTED_CHAINS[1]);

  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState(false);
  const [amountErrorMsg, setAmountErrorMsg] = useState('');

  const [speedMode, setSpeedMode] = useState<SpeedMode>('fast');
  const [quote, setQuote] = useState<RouteQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  // Startup sanitizer: purge any legacy arc_credit_* keys from previous testnet simulation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('arc_credit_')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
      } catch (e) {
        console.warn('Storage sanitization error:', e);
      }
    }
  }, []);

  // Parse URL query parameter ?from=
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const fromParam = params.get('from');
      if (fromParam) {
        let chainId = defaultFromId;
        const normalized = fromParam.toLowerCase();
        if (normalized === 'base') chainId = isMainnet ? 8453 : 84532;
        else if (normalized === 'ethereum' || normalized === 'mainnet') chainId = isMainnet ? 1 : 11155111;
        else if (normalized === 'arbitrum') chainId = isMainnet ? 42161 : 421614;
        else if (normalized === 'arc') chainId = isMainnet ? 5042 : 5042002;

        const chain = getChainById(chainId);
        if (chain && !chain.isComingSoon) {
          setFromChain(chain);
          if (toChain.id === chain.id) {
            const defaultTo = getChainById(defaultToId);
            if (defaultTo) setToChain(defaultTo);
          }
        }
      }
    }
  }, [isMainnet, defaultFromId, defaultToId, toChain.id]);

  // Balances
  const {
    formattedBalance: fromBalance,
    balanceNum: fromBalanceNum,
    rawBalance: fromRawBalance,
    isLoading: isLoadingFromBalance,
    refetch: refetchFromBalance
  } = useUSDCBalance(fromChain.id);

  const {
    formattedBalance: toBalance,
    isLoading: isLoadingToBalance,
    refetch: refetchToBalance
  } = useUSDCBalance(toChain.id);

  // Bridge execution hook
  const {
    executeBridge,
    status,
    steps,
    sourceTxHash,
    destTxHash,
    error: bridgeError,
    elapsedSeconds,
    attestationElapsed,
    reset: resetBridgeState
  } = useBridge();

  const activeStepIndex = steps.findIndex(s => s.status === 'active');

  useEffect(() => {
    if (status === 'success') {
      refetchFromBalance();
      refetchToBalance();
      playSuccessSound();
    }
  }, [status, refetchFromBalance, refetchToBalance]);

  // Validation
  useEffect(() => {
    if (amount === '') {
      setAmountError(false);
      setAmountErrorMsg('');
      return;
    }

    const validationError = validateBridgeAmount(amount, fromBalanceNum);
    setAmountError(Boolean(validationError));
    setAmountErrorMsg(validationError ?? '');
  }, [amount, fromBalanceNum]);

  // Dynamic Fee & Receive Quote
  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0 || amountError) {
      setQuote(null);
      return;
    }

    let isMounted = true;
    setQuoteLoading(true);

    const timer = setTimeout(() => {
      getRouteFeeQuote(fromChain.id, toChain.id, amount, speedMode)
        .then(q => {
          if (isMounted) setQuote(q);
        })
        .catch(err => {
          if (isMounted) setQuote(null);
        })
        .finally(() => {
          if (isMounted) setQuoteLoading(false);
        });
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [amount, fromChain.id, toChain.id, speedMode, amountError]);

  const handleSwapChains = () => {
    if (status === 'bridging') return;
    playClickSound();
    const temp = fromChain;
    setFromChain(toChain);
    setToChain(temp);
    setAmount('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '' || /^\d*\.?\d{0,6}$/.test(val)) {
      setAmount(val);
    }
  };

  const handleMaxClick = () => {
    playClickSound();
    if (fromRawBalance !== undefined && fromRawBalance > 0n) {
      const { maxFormatted } = calculateMaxBridgeAmount(fromRawBalance, fromChain.isNativeArc);
      setAmount(maxFormatted);
    } else if (fromBalanceNum > 0) {
      const fallbackUnits = BigInt(Math.floor(fromBalanceNum * 1_000_000));
      const { maxFormatted } = calculateMaxBridgeAmount(fallbackUnits, fromChain.isNativeArc);
      setAmount(maxFormatted);
    } else {
      setAmount('');
    }
  };

  const handleBridgeSubmit = () => {
    if (amountError || amount === '' || parseFloat(amount) <= 0) return;
    playChargeSound();
    executeBridge(fromChain, toChain, amount, speedMode);
  };

  const handleRetry = () => {
    if (amountError || amount === '' || parseFloat(amount) <= 0) return;
    playChargeSound();
    executeBridge(fromChain, toChain, amount, speedMode);
  };

  const handleResetAll = () => {
    playClickSound();
    setAmount('');
    resetBridgeState();
  };

  const pauseState = isRoutePaused(fromChain.id, toChain.id);
  const usdValue = parseFloat(amount || '0') * 1.0;

  // Harmonized styling system
  const isDark = theme === 'dark';
  const cardBg = isDark
    ? 'bg-[#0D1B2E]/95 backdrop-blur-2xl border-slate-800/80 text-white shadow-2xl shadow-black/50'
    : 'bg-white/98 backdrop-blur-xl border-slate-200 text-slate-900 shadow-2xl shadow-slate-200/60';
  const inputBg = isDark
    ? 'bg-slate-900/60 border-slate-800 focus-within:border-[#C8922A]/50 focus-within:bg-slate-900/90'
    : 'bg-slate-50/90 border-slate-200 focus-within:border-[#C8922A] focus-within:bg-white';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';

  const isFormVisible = status !== 'bridging' && status !== 'success';
  const hasValidAmount = !amountError && amount !== '' && parseFloat(amount) > 0 && !pauseState.isPaused;

  const receiveAmountDisplay = quote
    ? quote.expectedReceiveAmount
    : amount && !amountError
      ? amount
      : '';

  return (
    <div className="w-full max-w-[520px] mx-auto select-none px-3 sm:px-0">

      {/* Dynamic Card */}
      <div className={`w-full ${cardBg} border rounded-3xl p-4 sm:p-6 md:p-7 relative transition-all duration-300`}>

        <AnimatePresence mode="wait">

          {/* STATE A: IDLE FORM */}
          {isFormVisible && (
            <motion.div
              key="bridge-form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col"
            >
              {/* Header Title & Status Bar */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black uppercase tracking-wider text-[#C8922A]">
                    Cross-Chain Bridge
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isMainnet
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  }`}>
                    {isMainnet ? 'Arc Mainnet' : 'Testnet'}
                  </span>
                </div>

                {/* Live Auto-Relay pill */}
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${
                  isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600'
                }`}>
                  <Zap className="h-3 w-3" /> Auto-Relay
                </div>
              </div>

              {/* Pause Notification Banner */}
              {pauseState.isPaused && (
                <div className="mb-4 p-3.5 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 flex items-start gap-2.5 text-left">
                  <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] font-bold leading-relaxed">
                    {pauseState.reason || 'Transfers for this route are temporarily paused.'}
                  </p>
                </div>
              )}

              {/* Stacked Transfer boxes */}
              <div className="relative flex flex-col gap-1 mb-4">
                {/* 1. SOURCE CONTAINER (FROM) */}
                <div className={`${inputBg} border rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between min-h-[110px] sm:min-h-[120px] ${amountError ? 'border-red-500/60' : ''} transition-all duration-200`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-black ${textMuted} uppercase tracking-wider`}>You Pay</span>

                    <div className="flex items-center gap-1.5">
                      <span className={`text-[11px] font-bold ${textMuted}`}>Balance:</span>
                      {isLoadingFromBalance ? (
                        <span className={`h-3.5 w-10 ${isDark ? 'bg-slate-800' : 'bg-slate-200'} animate-pulse rounded-md`} />
                      ) : (
                        <span className={`text-[11px] font-mono font-black ${amountError ? 'text-red-400' : isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                          {fromBalance} USDC
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={handleMaxClick}
                        className="text-[#C8922A] hover:underline font-extrabold text-[11px] ml-1 cursor-pointer"
                      >
                        MAX
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 my-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={amount}
                      onChange={handleInputChange}
                      className={`min-w-0 flex-1 bg-transparent text-2xl sm:text-3xl md:text-4xl font-black ${textPrimary} focus:outline-none placeholder-slate-600 tabular-nums ${
                        amountError ? 'text-red-400' : ''
                      }`}
                    />

                    <ChainPicker
                      label="FROM"
                      selectedChain={fromChain}
                      onSelect={setFromChain}
                      disabledChains={[toChain.id]}
                      theme={theme}
                    />
                  </div>

                  <div className={`flex items-center justify-between text-[11px] font-bold ${textMuted}`}>
                    <span>${usdValue.toFixed(2)} USD</span>
                  </div>
                </div>

                {/* Floating swap button */}
                <div className="flex justify-center -my-3 z-20">
                  <SwapChainsBtn onClick={handleSwapChains} disabled={false} />
                </div>

                {/* 2. DESTINATION CONTAINER (TO) */}
                <div className={`${inputBg} border rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between min-h-[110px] sm:min-h-[120px] transition-all duration-200`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-black ${textMuted} uppercase tracking-wider`}>You Receive</span>
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-1">
                      <Zap className="h-3 w-3" /> Auto Minted
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 my-1">
                    <input
                      type="text"
                      readOnly
                      placeholder="0.00"
                      value={receiveAmountDisplay}
                      className={`min-w-0 flex-1 bg-transparent text-2xl sm:text-3xl md:text-4xl font-black ${textPrimary} focus:outline-none placeholder-slate-600 tabular-nums`}
                    />

                    <ChainPicker
                      label="TO"
                      selectedChain={toChain}
                      onSelect={setToChain}
                      disabledChains={[fromChain.id]}
                      theme={theme}
                    />
                  </div>

                  <div className={`flex items-center justify-between text-[11px] font-bold ${textMuted}`}>
                    <span>
                      ${receiveAmountDisplay ? (parseFloat(receiveAmountDisplay) * 1.0).toFixed(2) : '0.00'} USD
                    </span>
                    {isLoadingToBalance ? (
                      <span className={`h-3.5 w-10 ${isDark ? 'bg-slate-800' : 'bg-slate-200'} animate-pulse rounded-md`} />
                    ) : (
                      <span className={`text-[10px] ${textMuted}`}>
                        Dest: {toBalance} USDC
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Amount Validation Alert */}
              <AnimatePresence>
                {amountError && amountErrorMsg && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.15 }}
                    className="mb-3 overflow-hidden"
                  >
                    <div className={`text-[11px] font-bold px-3.5 py-2.5 rounded-2xl flex items-center gap-2 ${
                      isDark ? 'bg-red-950/40 border border-red-900/50 text-red-300' : 'bg-red-50 border border-red-200 text-red-600'
                    }`}>
                      <Info className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>{amountErrorMsg}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Fee breakdown panel */}
              <FeeBreakdownPanel
                amount={amount}
                fromChainId={fromChain.id}
                toChainId={toChain.id}
                speedMode={speedMode}
                onSpeedModeChange={setSpeedMode}
                quote={quote}
                theme={theme}
              />

              {/* Error Recovery Panel */}
              <AnimatePresence>
                {status === 'error' && bridgeError && (
                  <ErrorRecoveryPanel
                    errorMessage={bridgeError}
                    onRetry={handleRetry}
                    onReset={handleResetAll}
                    fromChainId={fromChain.id}
                    theme={theme}
                  />
                )}
              </AnimatePresence>

              {/* Solana Wallet Connect Banner */}
              {(toChain.isSolana || fromChain.isSolana) && !solanaWallet.connected && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mb-3 overflow-hidden"
                >
                  <div
                    className="flex items-center justify-between gap-3 px-3.5 py-3 rounded-2xl border border-purple-800/40 bg-purple-950/40 text-purple-300 cursor-pointer hover:border-purple-700/60 transition-all"
                    onClick={() => solanaWallet.select && solanaWallet.select('Phantom' as any)}
                  >
                    <div className="flex items-center gap-2 text-[11px] font-bold">
                      <img
                        src="https://icons.llamao.fi/icons/chains/rsz_solana.jpg"
                        alt="Solana"
                        className="w-4 h-4 rounded-full flex-shrink-0"
                      />
                      <span>
                        {toChain.isSolana
                          ? 'Connect Phantom to receive USDC on Solana'
                          : 'Connect Phantom to send USDC from Solana'}
                      </span>
                    </div>
                    <span className="text-[10px] font-black text-purple-300 bg-purple-900/50 px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0">
                      CONNECT
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Action Button CTA */}
              <BridgeButton
                fromChainId={fromChain.id}
                toChainId={toChain.id}
                status={status}
                activeStepIndex={activeStepIndex}
                amount={amount}
                isValidAmount={hasValidAmount}
                onBridge={handleBridgeSubmit}
                disabled={pauseState.isPaused}
              />
            </motion.div>
          )}

          {/* STATE B: BRIDGING PROGRESS */}
          {status === 'bridging' && (
            <motion.div
              key="bridge-steps"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <StepTracker
                steps={steps}
                elapsedSeconds={elapsedSeconds}
                attestationElapsed={attestationElapsed}
                amount={amount}
                sourceChainName={fromChain.name}
                destChainName={toChain.name}
                error={bridgeError}
                theme={theme}
              />
            </motion.div>
          )}

          {/* STATE C: SUCCESS COMPLETED */}
          {status === 'success' && (
            <motion.div
              key="bridge-success"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <SuccessView
                amount={`${amount} USDC`}
                fromChainId={fromChain.id}
                toChainId={toChain.id}
                sourceTxHash={sourceTxHash}
                destTxHash={destTxHash}
                elapsedSeconds={elapsedSeconds}
                onReset={handleResetAll}
                theme={theme}
                isRelayed={false}
                userAddress={address}
              />
            </motion.div>
          )}

        </AnimatePresence>

      </div>
    </div>
  );
}
