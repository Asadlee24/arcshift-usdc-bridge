// components/bridge/BridgeCard.tsx
// Ultra-sleek Bridge Card component — stable USDC CCTP v2 auto-relay & token swap

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Sparkles, TrendingUp, Info, Clock, Zap, ChevronDown, ArrowDown, ArrowRightLeft } from 'lucide-react';

import ChainPicker from './ChainPicker';
import SwapChainsBtn from './SwapChainsBtn';
import BridgeButton from './BridgeButton';
import StepTracker from './StepTracker';
import SuccessView from './SuccessView';
import FeeBreakdownPanel, { SpeedMode } from './FeeBreakdownPanel';
import CircleOnRampModal from './CircleOnRampModal';
import ErrorRecoveryPanel from './ErrorRecoveryPanel';

import { getChainById } from '../../constants/chains';
import { useUSDCBalance } from '../../hooks/useUSDCBalance';
import { useBridge, BridgeStep, validateBridgeAmount, MIN_BRIDGE_AMOUNT } from '../../hooks/useBridge';
import { useAccount } from 'wagmi';
import { useWallet } from '@solana/wallet-adapter-react';
import { playClickSound, playChargeSound, playSuccessSound } from '../../lib/audio';
import { addTransaction } from '../../hooks/useTransactionHistory';

import { readContract, writeContract, waitForTransactionReceipt, getAccount, switchChain } from '@wagmi/core';
import { config } from '../../lib/wagmi';
import { parseUnits } from 'viem';
import { readErc20Balance } from '../../lib/rpcClient';

const ARC_CHAIN_ID = 5042002;

interface BridgeCardProps {
  theme?: 'dark' | 'light';
}

export default function BridgeCard({ theme = 'light' }: BridgeCardProps) {
  const { isConnected, address } = useAccount();
  const solanaWallet = useWallet();

  const [fromChain, setFromChain] = useState(() => getChainById(84532)!); // Base Sepolia
  const [toChain, setToChain] = useState(() => getChainById(5042002)!); // Arc Testnet

  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState(false);
  const [amountErrorMsg, setAmountErrorMsg] = useState('');

  const [speedMode, setSpeedMode] = useState<SpeedMode>('fast');

  const [activeTab, setActiveTab] = useState<'bridge' | 'swap'>('bridge');
  const [showOnRamp, setShowOnRamp] = useState(false);

  const ARC_TOKENS = [
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0x3600000000000000000000000000000000000000',
      decimals: 6,
      iconUrl: 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/usdc.png',
    },
    {
      symbol: 'EURC',
      name: 'Euro Coin',
      address: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',
      decimals: 6,
      iconUrl: 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/eur.png',
    },
    {
      symbol: 'cirBTC',
      name: 'Circle Wrapped BTC',
      address: '0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF',
      decimals: 8,
      iconUrl: 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/btc.png',
    }
  ];

  const [sellToken, setSellToken] = useState(ARC_TOKENS[0]);
  const [buyToken, setBuyToken] = useState(ARC_TOKENS[1]);
  const [isTokenPickerOpen, setIsTokenPickerOpen] = useState<'sell' | 'buy' | null>(null);
  const [sellTokenBalance, setSellTokenBalance] = useState('0.00');
  const [buyTokenBalance, setBuyTokenBalance] = useState('0.00');
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);

  const [isSwapping, setIsSwapping] = useState(false);
  const [swapSuccess, setSwapSuccess] = useState(false);
  const [swapTxHash, setSwapTxHash] = useState('');
  const [swapDestTxHash, setSwapDestTxHash] = useState('');
  const [swapElapsedSeconds, setSwapElapsedSeconds] = useState(0);
  const [swapSteps, setSwapSteps] = useState<BridgeStep[]>([
    { name: 'approve', status: 'pending', label: 'Approve Token', description: 'Allowing swap contract to spend' },
    { name: 'burn', status: 'pending', label: 'Execute Swap', description: 'Executing swap on Arc Network' },
    { name: 'mint', status: 'pending', label: 'Finalize Balances', description: 'Updating balances and ledger' }
  ]);

  const getExchangeRate = (sellSymbol: string, buySymbol: string) => {
    if (sellSymbol === buySymbol) return 1;
    if (sellSymbol === 'USDC' && buySymbol === 'EURC') return 0.92;
    if (sellSymbol === 'EURC' && buySymbol === 'USDC') return 1.09;
    if (sellSymbol === 'USDC' && buySymbol === 'cirBTC') return 0.000010;
    if (sellSymbol === 'cirBTC' && buySymbol === 'USDC') return 100000;
    if (sellSymbol === 'EURC' && buySymbol === 'cirBTC') return 0.0000092;
    if (sellSymbol === 'cirBTC' && buySymbol === 'EURC') return 108695;
    return 1;
  };

  async function queryTokenBalance(tokenAddress: string, userAddress: string, decimals: number): Promise<string> {
    if (!userAddress) return '0.00';
    const balance = await readErc20Balance(ARC_CHAIN_ID, tokenAddress, userAddress, decimals);
    if (balance === null) return '0.00';
    return balance.toFixed(decimals === 6 ? 2 : 4);
  }

  const triggerBalanceFetch = async () => {
    if (!address) return;
    setIsLoadingBalances(true);
    try {
      const [sellBal, buyBal] = await Promise.all([
        queryTokenBalance(sellToken.address, address, sellToken.decimals),
        queryTokenBalance(buyToken.address, address, buyToken.decimals),
      ]);

      const localSellOffset = parseFloat(localStorage.getItem(`arc_credit_${sellToken.symbol}_${address}`) || '0');
      const localBuyOffset = parseFloat(localStorage.getItem(`arc_credit_${buyToken.symbol}_${address}`) || '0');

      const parsedSellBal = Math.max(0, parseFloat(sellBal) + localSellOffset);
      const parsedBuyBal = Math.max(0, parseFloat(buyBal) + localBuyOffset);

      setSellTokenBalance(parsedSellBal.toFixed(sellToken.symbol === 'cirBTC' ? 6 : sellToken.decimals === 6 ? 2 : 4));
      setBuyTokenBalance(parsedBuyBal.toFixed(buyToken.symbol === 'cirBTC' ? 6 : buyToken.decimals === 6 ? 2 : 4));
    } catch (e) {
      console.warn('Failed to parse offsets:', e);
    } finally {
      setIsLoadingBalances(false);
    }
  };

  useEffect(() => {
    if (!address || activeTab !== 'swap') return;
    let isMounted = true;
    triggerBalanceFetch();
    const interval = setInterval(() => {
      if (isMounted) triggerBalanceFetch();
    }, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [address, sellToken.address, buyToken.address, activeTab]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const sellContainer = document.getElementById('sell-token-picker-container');
      const buyContainer = document.getElementById('buy-token-picker-container');
      if (
        isTokenPickerOpen &&
        sellContainer && !sellContainer.contains(event.target as Node) &&
        buyContainer && !buyContainer.contains(event.target as Node)
      ) {
        setIsTokenPickerOpen(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isTokenPickerOpen]);

  const handleSwapSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) return;

    playChargeSound();
    setIsSwapping(true);
    setSwapElapsedSeconds(0);
    setSwapSteps([
      { name: 'approve', status: 'active', label: 'Approve Token', description: `Approving ${sellToken.symbol} spend` },
      { name: 'burn', status: 'pending', label: 'Execute Swap', description: `Swapping ${sellToken.symbol} to ${buyToken.symbol}` },
      { name: 'mint', status: 'pending', label: 'Finalize Balances', description: 'Updating balances and ledger' }
    ]);

    const elapsedInterval = setInterval(() => {
      setSwapElapsedSeconds(prev => prev + 1);
    }, 1000);

    try {
      const account = getAccount(config);
      if (account.chainId !== 5042002) {
        await switchChain(config, { chainId: 5042002 });
      }

      const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
      const FX_ESCROW_ADDRESS = '0x867650F5eAe8df91445971f14d89fd84F0C9a9f8';
      const parsedAmount = parseUnits(amount, sellToken.decimals);

      const destReceived = (parseFloat(amount) * getExchangeRate(sellToken.symbol, buyToken.symbol)).toFixed(buyToken.decimals === 6 ? 4 : 6);

      let currentAllowance = BigInt(0);
      try {
        currentAllowance = await readContract(config, {
          address: sellToken.address as `0x${string}`,
          abi: [
            {
              name: 'allowance',
              type: 'function',
              stateMutability: 'view',
              inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
              outputs: [{ name: '', type: 'uint256' }],
            }
          ],
          functionName: 'allowance',
          args: [account.address!, PERMIT2_ADDRESS],
          chainId: 5042002
        });
      } catch (err) {
        console.warn('Failed to read Permit2 allowance:', err);
      }

      let approveHash: `0x${string}` | undefined;
      if (currentAllowance < parsedAmount) {
        try {
          approveHash = await writeContract(config, {
            address: sellToken.address as `0x${string}`,
            abi: [
              {
                name: 'approve',
                type: 'function',
                stateMutability: 'nonpayable',
                inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
                outputs: [{ name: '', type: 'bool' }],
              }
            ],
            functionName: 'approve',
            args: [PERMIT2_ADDRESS, parsedAmount],
            chainId: 5042002
          });

          setSwapSteps(prev => prev.map(s => {
            if (s.name === 'approve') return {
              ...s,
              status: 'done',
              txHash: approveHash,
              explorerUrl: `https://testnet.arcscan.app/tx/${approveHash}`
            };
            if (s.name === 'burn') return { ...s, status: 'active' };
            return s;
          }));

          await waitForTransactionReceipt(config, { hash: approveHash, chainId: 5042002 });
        } catch (approveErr) {
          console.error('Permit2 approval failed or rejected:', approveErr);
          throw approveErr;
        }
      } else {
        setSwapSteps(prev => prev.map(s => {
          if (s.name === 'approve') return {
            ...s,
            status: 'done',
            label: 'Permit2 Spender Approved',
            description: `Permit2 already approved for ${sellToken.symbol}`
          };
          if (s.name === 'burn') return { ...s, status: 'active' };
          return s;
        }));
      }

      let txHash: `0x${string}`;
      try {
        let transferAmount = parsedAmount;
        if (sellToken.symbol !== 'USDC') {
          try {
            const onChainBalStr = await queryTokenBalance(sellToken.address, address || '', sellToken.decimals);
            const onChainBal = parseFloat(onChainBalStr);
            const requestedAmount = parseFloat(amount);
            if (onChainBal >= requestedAmount) {
              transferAmount = parsedAmount;
            } else {
              transferAmount = parseUnits(onChainBalStr, sellToken.decimals);
            }
          } catch (e) {
            console.warn('Failed to check on-chain balance:', e);
            transferAmount = BigInt(0);
          }
        }

        txHash = await writeContract(config, {
          address: sellToken.address as `0x${string}`,
          abi: [
            {
              name: 'transfer',
              type: 'function',
              stateMutability: 'nonpayable',
              inputs: [{ name: 'recipient', type: 'address' }, { name: 'amount', type: 'uint256' }],
              outputs: [{ name: '', type: 'bool' }],
            }
          ],
          functionName: 'transfer',
          args: [FX_ESCROW_ADDRESS, transferAmount],
          chainId: 5042002
        });
      } catch (err) {
        console.error('FxEscrow transfer failed:', err);
        throw err;
      }

      setSwapSteps(prev => prev.map(s => {
        if (s.name === 'burn') return {
          ...s,
          status: 'done',
          txHash,
          explorerUrl: `https://testnet.arcscan.app/tx/${txHash}`
        };
        if (s.name === 'mint') return { ...s, status: 'active' };
        return s;
      }));

      await waitForTransactionReceipt(config, { hash: txHash, chainId: 5042002 });
      const dstHash = txHash;

      setSwapTxHash(txHash);
      setSwapDestTxHash(dstHash);

      setSwapSteps(prev => prev.map(s => {
        if (s.name === 'mint') return {
          ...s,
          status: 'done',
          label: 'Escrow Confirmed (Simulation)',
          txHash: txHash.substring(0, 10) + '...',
          explorerUrl: `https://testnet.arcscan.app/tx/${txHash}`
        };
        return s;
      }));

      setTimeout(async () => {
        clearInterval(elapsedInterval);

        if (address) {
          const currentSellOffset = parseFloat(localStorage.getItem(`arc_credit_${sellToken.symbol}_${address}`) || '0');
          const newSellOffset = Math.max(0, currentSellOffset - parseFloat(amount));
          localStorage.setItem(`arc_credit_${sellToken.symbol}_${address}`, newSellOffset.toString());

          const currentBuyOffset = parseFloat(localStorage.getItem(`arc_credit_${buyToken.symbol}_${address}`) || '0');
          const newBuyOffset = currentBuyOffset + parseFloat(destReceived);
          localStorage.setItem(`arc_credit_${buyToken.symbol}_${address}`, newBuyOffset.toString());
        }

        addTransaction({
          id: txHash,
          userAddress: account.address || address || '0x4444...5b05',
          fromChainId: 5042002,
          toChainId: 5042002,
          amount: `${amount} ${sellToken.symbol} → ${destReceived} ${buyToken.symbol}`,
          status: 'success',
          burnTxHash: txHash,
          mintTxHash: dstHash
        });

        await triggerBalanceFetch();
        window.dispatchEvent(new Event('bridge-success-refresh'));

        setIsSwapping(false);
        setSwapSuccess(true);
        playSuccessSound();
      }, 2000);

    } catch (err: any) {
      clearInterval(elapsedInterval);
      console.error('Swap execution failed', err);
      setIsSwapping(false);
      setAmountError(true);
      setAmountErrorMsg(err?.message || 'Transaction rejected by wallet');
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const fromParam = params.get('from');
      if (fromParam) {
        let chainId = 84532;
        if (fromParam === 'base') chainId = 84532;
        else if (fromParam === 'ethereum' || fromParam === 'sepolia') chainId = 11155111;
        else if (fromParam === 'arbitrum') chainId = 421614;
        else if (fromParam === 'optimism') chainId = 11155420;
        else if (fromParam === 'avalanche') chainId = 43113;

        const chain = getChainById(chainId);
        if (chain && !chain.isComingSoon) {
          setFromChain(chain);
          if (toChain.id === chain.id) {
            const defaultTo = getChainById(5042002);
            if (defaultTo) setToChain(defaultTo);
          }
        }
      }
    }
  }, []);

  const {
    formattedBalance: fromBalance,
    balanceNum: fromBalanceNum,
    isLoading: isLoadingFromBalance,
    refetch: refetchFromBalance
  } = useUSDCBalance(fromChain.id);

  const {
    formattedBalance: toBalance,
    isLoading: isLoadingToBalance,
    refetch: refetchToBalance
  } = useUSDCBalance(toChain.id);

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

  useEffect(() => {
    if (amount === '') {
      setAmountError(false);
      setAmountErrorMsg('');
      return;
    }

    if (activeTab === 'bridge') {
      const validationError = validateBridgeAmount(amount, fromBalanceNum);
      setAmountError(Boolean(validationError));
      setAmountErrorMsg(validationError ?? '');
      return;
    }

    const entered = parseFloat(amount);
    if (isNaN(entered) || entered <= 0) {
      setAmountError(true);
      setAmountErrorMsg('Please enter a valid amount greater than 0');
    } else if (entered > parseFloat(sellTokenBalance)) {
      setAmountError(true);
      setAmountErrorMsg(`Insufficient balance — you have ${sellTokenBalance} ${sellToken.symbol}`);
    } else {
      setAmountError(false);
      setAmountErrorMsg('');
    }
  }, [amount, fromBalanceNum, fromBalance, sellTokenBalance, sellToken, activeTab]);

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
    const buffer = 0.01;
    const maxAmount = fromBalanceNum - buffer;
    if (maxAmount >= MIN_BRIDGE_AMOUNT) {
      setAmount(maxAmount.toFixed(4));
    } else {
      setAmount(fromBalanceNum > 0 ? fromBalanceNum.toFixed(4) : '');
    }
  };

  const handleBridgeSubmit = () => {
    if (amountError || amount === '' || parseFloat(amount) <= 0) return;
    playChargeSound();
    executeBridge(fromChain.id, toChain.id, amount, speedMode);
  };

  const handleRetry = () => {
    if (amountError || amount === '' || parseFloat(amount) <= 0) return;
    playChargeSound();
    executeBridge(fromChain.id, toChain.id, amount, speedMode);
  };

  const handleResetAll = () => {
    playClickSound();
    setAmount('');
    resetBridgeState();
    setIsSwapping(false);
    setSwapSuccess(false);
    setSwapTxHash('');
    setSwapDestTxHash('');
    setSwapElapsedSeconds(0);
    setSwapSteps([
      { name: 'approve', status: 'pending', label: 'Approve Token', description: 'Allowing swap contract to spend' },
      { name: 'burn', status: 'pending', label: 'Execute Swap', description: 'Executing swap on Arc Network' },
      { name: 'mint', status: 'pending', label: 'Finalize Balances', description: 'Updating balances and ledger' }
    ]);
  };

  const usdValue = parseFloat(amount || '0') * 1.0;

  // Harmonized styling system
  const isDark = theme === 'dark';
  const cardBg = isDark
    ? 'bg-[#0D1B2E]/95 backdrop-blur-2xl border-slate-800/80 text-white shadow-2xl shadow-black/50'
    : 'bg-white/98 backdrop-blur-xl border-slate-200 text-slate-900 shadow-2xl shadow-slate-200/60';
  const inputBg = isDark
    ? 'bg-slate-900/60 border-slate-800 focus-within:border-[#C8922A]/50 focus-within:bg-slate-900/90'
    : 'bg-slate-50/90 border-slate-200 focus-within:border-[#C8922A] focus-within:bg-white';
  const tabContainerBg = isDark ? 'bg-slate-900/90 border border-slate-800' : 'bg-slate-100 border border-slate-200';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';

  const isFormVisible = status !== 'bridging' && status !== 'success' && !isSwapping && !swapSuccess;
  const hasValidAmount = !amountError && amount !== '' && parseFloat(amount) > 0;

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
              {/* Header Tab Bar */}
              <div className="flex items-center justify-between mb-5">
                <div className={`${tabContainerBg} p-1 rounded-2xl flex gap-1 select-none`}>
                  <button
                    type="button"
                    onClick={() => { playClickSound(); setActiveTab('bridge'); }}
                    className={`rounded-xl px-4 py-1.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                      activeTab === 'bridge'
                        ? 'bg-[#C8922A] text-white shadow-lg shadow-[#C8922A]/25'
                        : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Bridge
                  </button>
                  <button
                    type="button"
                    onClick={() => { playClickSound(); setActiveTab('swap'); }}
                    className={`rounded-xl px-4 py-1.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'swap'
                        ? 'bg-[#C8922A] text-white shadow-lg shadow-[#C8922A]/25'
                        : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Swap
                    {activeTab !== 'swap' && (
                      <span className="text-[8px] font-black bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">NEW</span>
                    )}
                  </button>
                </div>

                {/* Live Auto-Relay pill */}
                <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${
                  isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600'
                }`}>
                  <Zap className="h-3 w-3" /> Auto-Relay
                </div>
              </div>

              {activeTab === 'swap' && (
                <div className={`mb-4 p-3 rounded-2xl border flex items-start gap-2.5 text-left ${
                  isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-700'
                }`}>
                  <Info className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] font-medium leading-relaxed">
                    <strong>Simulation Mode:</strong> Swaps execute on Arc Testnet Escrow contract (<code className="font-mono text-[10px]">0x8676...a9f8</code>).
                  </p>
                </div>
              )}

              {/* Stacked Sell / Buy boxes */}
              <div className="relative flex flex-col gap-1 mb-4">
                {activeTab === 'bridge' ? (
                  <>
                    {/* 1. SELL CONTAINER (FROM) */}
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

                    {/* 2. BUY CONTAINER (TO) */}
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
                          value={amount ? (Math.max(parseFloat(amount) - Math.max(parseFloat(amount) * 0.01, 0.001), 0)).toFixed(4) : ''}
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
                        <span>${amount ? (Math.max(parseFloat(amount) - Math.max(parseFloat(amount) * 0.01, 0.001), 0) * 1).toFixed(2) : '0.00'} USD</span>
                        {isLoadingToBalance ? (
                          <span className={`h-3.5 w-10 ${isDark ? 'bg-slate-800' : 'bg-slate-200'} animate-pulse rounded-md`} />
                        ) : (
                          <span className={`text-[10px] ${textMuted}`}>
                            Dest: {toBalance} USDC
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* SWAP SELL */}
                    <div className={`${inputBg} border rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between min-h-[110px] sm:min-h-[120px] ${amountError ? 'border-red-500/60' : ''} transition-all duration-200`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-[11px] font-black ${textMuted} uppercase tracking-wider`}>Pay</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[11px] font-bold ${textMuted}`}>Balance:</span>
                          <span className={`text-[11px] font-mono font-black ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{sellTokenBalance} {sellToken.symbol}</span>
                          <button
                            type="button"
                            onClick={() => {
                              playClickSound();
                              const balVal = parseFloat(sellTokenBalance);
                              if (balVal > 0.0001) setAmount((balVal - 0.0001).toFixed(sellToken.decimals === 6 ? 4 : 6));
                              else setAmount('0.00');
                            }}
                            className="text-[#C8922A] hover:underline font-black text-[11px] ml-1 cursor-pointer"
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
                          className={`min-w-0 flex-1 bg-transparent text-3xl sm:text-4xl font-black ${textPrimary} focus:outline-none placeholder-slate-600 tabular-nums`}
                        />

                        <div className="relative" id="sell-token-picker-container">
                          <button
                            type="button"
                            onClick={() => {
                              playClickSound();
                              setIsTokenPickerOpen(prev => prev === 'sell' ? null : 'sell');
                            }}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-black transition-all cursor-pointer ${
                              isDark ? 'bg-slate-900 border-slate-800 text-white hover:bg-slate-800' : 'bg-slate-100 border-slate-200 text-slate-900 hover:bg-slate-200'
                            }`}
                          >
                            <img src={sellToken.iconUrl} alt={sellToken.symbol} className="h-4 w-4 rounded-full" />
                            <span>{sellToken.symbol}</span>
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>

                          {isTokenPickerOpen === 'sell' && (
                            <div className={`absolute right-0 top-full mt-2 w-52 rounded-2xl border p-1.5 shadow-2xl z-50 transition-all ${
                              isDark ? 'bg-[#0D1B2E] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
                            }`}>
                              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Token</div>
                              {ARC_TOKENS.map(t => (
                                <button
                                  key={t.symbol}
                                  type="button"
                                  onClick={() => {
                                    playClickSound();
                                    if (t.symbol === buyToken.symbol) {
                                      setBuyToken(sellToken);
                                    }
                                    setSellToken(t);
                                    setIsTokenPickerOpen(null);
                                  }}
                                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                    sellToken.symbol === t.symbol
                                      ? isDark ? 'bg-amber-500/20 text-[#C8922A]' : 'bg-amber-50 text-[#C8922A]'
                                      : isDark ? 'hover:bg-slate-800/80 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <img src={t.iconUrl} alt={t.symbol} className="h-4.5 w-4.5 rounded-full" />
                                    <div className="flex flex-col items-start">
                                      <span className="leading-none">{t.symbol}</span>
                                      <span className="text-[9px] font-medium text-slate-400 mt-0.5">{t.name}</span>
                                    </div>
                                  </div>
                                  {sellToken.symbol === t.symbol && <span className="text-[#C8922A] text-xs">✓</span>}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className={`flex items-center justify-between text-[11px] font-bold ${textMuted}`}>
                        <span>Arc Testnet</span>
                      </div>
                    </div>

                    {/* Swap button */}
                    <div className="flex justify-center -my-3 z-20">
                      <button
                        type="button"
                        onClick={() => {
                          playClickSound();
                          const temp = sellToken;
                          setSellToken(buyToken);
                          setBuyToken(temp);
                          setAmount('');
                        }}
                        className={`h-9 w-9 rounded-full border flex items-center justify-center transition-all duration-200 hover:scale-110 cursor-pointer shadow-md ${
                          isDark ? 'bg-slate-900 border-slate-800 text-[#C8922A] hover:bg-slate-800' : 'bg-white border-slate-200 text-[#C8922A] hover:bg-slate-50'
                        }`}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </div>

                    {/* SWAP BUY */}
                    <div className={`${inputBg} border rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between min-h-[110px] sm:min-h-[120px] transition-all duration-200`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-[11px] font-black ${textMuted} uppercase tracking-wider`}>Receive</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[11px] font-bold ${textMuted}`}>Balance:</span>
                          <span className={`text-[11px] font-mono font-black ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{buyTokenBalance} {buyToken.symbol}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 my-1">
                        <input
                          type="text"
                          readOnly
                          placeholder="0.00"
                          value={amount ? (parseFloat(amount) * getExchangeRate(sellToken.symbol, buyToken.symbol)).toFixed(buyToken.decimals === 6 ? 4 : 6) : ''}
                          className={`min-w-0 flex-1 bg-transparent text-3xl sm:text-4xl font-black ${textPrimary} focus:outline-none placeholder-slate-600 tabular-nums`}
                        />

                        <div className="relative" id="buy-token-picker-container">
                          <button
                            type="button"
                            onClick={() => {
                              playClickSound();
                              setIsTokenPickerOpen(prev => prev === 'buy' ? null : 'buy');
                            }}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-black transition-all cursor-pointer ${
                              isDark ? 'bg-slate-900 border-slate-800 text-white hover:bg-slate-800' : 'bg-slate-100 border-slate-200 text-slate-900 hover:bg-slate-200'
                            }`}
                          >
                            <img src={buyToken.iconUrl} alt={buyToken.symbol} className="h-4 w-4 rounded-full" />
                            <span>{buyToken.symbol}</span>
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>

                          {isTokenPickerOpen === 'buy' && (
                            <div className={`absolute right-0 top-full mt-2 w-52 rounded-2xl border p-1.5 shadow-2xl z-50 transition-all ${
                              isDark ? 'bg-[#0D1B2E] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
                            }`}>
                              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Token</div>
                              {ARC_TOKENS.map(t => (
                                <button
                                  key={t.symbol}
                                  type="button"
                                  onClick={() => {
                                    playClickSound();
                                    if (t.symbol === sellToken.symbol) {
                                      setSellToken(buyToken);
                                    }
                                    setBuyToken(t);
                                    setIsTokenPickerOpen(null);
                                  }}
                                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                    buyToken.symbol === t.symbol
                                      ? isDark ? 'bg-amber-500/20 text-[#C8922A]' : 'bg-amber-50 text-[#C8922A]'
                                      : isDark ? 'hover:bg-slate-800/80 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <img src={t.iconUrl} alt={t.symbol} className="h-4.5 w-4.5 rounded-full" />
                                    <div className="flex flex-col items-start">
                                      <span className="leading-none">{t.symbol}</span>
                                      <span className="text-[9px] font-medium text-slate-400 mt-0.5">{t.name}</span>
                                    </div>
                                  </div>
                                  {buyToken.symbol === t.symbol && <span className="text-[#C8922A] text-xs">✓</span>}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className={`flex items-center justify-between text-[11px] font-bold ${textMuted}`}>
                        <span>Arc Testnet</span>
                      </div>
                    </div>
                  </>
                )}
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
              {activeTab === 'bridge' ? (
                <FeeBreakdownPanel
                  amount={amount}
                  fromChainId={fromChain.id}
                  toChainId={toChain.id}
                  speedMode={speedMode}
                  onSpeedModeChange={setSpeedMode}
                  theme={theme}
                />
              ) : (
                amount && parseFloat(amount) > 0 && (
                  <div className={`rounded-2xl border ${inputBg} p-3.5 mb-3 text-xs font-bold ${textMuted} flex items-center justify-between`}>
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-[#C8922A]" />
                      Exchange Rate
                    </span>
                    <span className={textPrimary}>
                      1 {sellToken.symbol} = {getExchangeRate(sellToken.symbol, buyToken.symbol).toFixed(buyToken.decimals === 6 ? 4 : 6)} {buyToken.symbol}
                    </span>
                  </div>
                )
              )}

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
              {activeTab === 'bridge' && (toChain.isSolana || fromChain.isSolana) && !solanaWallet.connected && (
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
                          ? 'Connect Phantom to receive USDC on Solana Devnet'
                          : 'Connect Phantom to send USDC from Solana Devnet'}
                      </span>
                    </div>
                    <span className="text-[10px] font-black text-purple-300 bg-purple-900/50 px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0">
                      CONNECT
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Action Button CTA */}
              {activeTab === 'bridge' ? (
                <BridgeButton
                  fromChainId={fromChain.id}
                  toChainId={toChain.id}
                  status={status}
                  activeStepIndex={activeStepIndex}
                  amount={amount}
                  isValidAmount={hasValidAmount}
                  onBridge={handleBridgeSubmit}
                />
              ) : (
                <button
                  type="button"
                  onClick={handleSwapSubmit}
                  disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > parseFloat(sellTokenBalance)}
                  className={`w-full h-12 sm:h-14 rounded-2xl text-sm font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                    !amount || parseFloat(amount) <= 0 || parseFloat(amount) > parseFloat(sellTokenBalance)
                      ? 'bg-slate-800/50 text-slate-500 border border-slate-800 cursor-not-allowed'
                      : 'bg-gradient-to-r from-[#C8922A] via-[#D4A043] to-[#E8A830] hover:brightness-110 text-white shadow-xl shadow-[#C8922A]/25'
                  }`}
                >
                  {parseFloat(amount) > parseFloat(sellTokenBalance) ? `INSUFFICIENT ${sellToken.symbol}` : 'SWAP TOKENS'}
                </button>
              )}
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

          {/* STATE B: SWAPPING PROGRESS */}
          {isSwapping && (
            <motion.div
              key="swap-steps"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <StepTracker
                steps={swapSteps}
                elapsedSeconds={swapElapsedSeconds}
                attestationElapsed={0}
                amount={amount}
                sourceChainName="Arc Testnet"
                destChainName="Arc Testnet"
                error={null}
                theme={theme}
                isSwap={true}
                swapTokens={{ sell: sellToken.symbol, buy: buyToken.symbol }}
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

          {/* STATE C: SWAP SUCCESS COMPLETED */}
          {swapSuccess && (
            <motion.div
              key="swap-success"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <SuccessView
                amount={`${amount} ${sellToken.symbol} → ${(parseFloat(amount) * getExchangeRate(sellToken.symbol, buyToken.symbol)).toFixed(buyToken.decimals === 6 ? 2 : 4)} ${buyToken.symbol}`}
                fromChainId={5042002}
                toChainId={5042002}
                sourceTxHash={swapTxHash}
                elapsedSeconds={swapElapsedSeconds}
                onReset={handleResetAll}
                theme={theme}
                isRelayed={false}
                userAddress={address}
                isSwap={true}
              />
            </motion.div>
          )}

        </AnimatePresence>

      </div>

      {/* Circle On-Ramp Modal */}
      <CircleOnRampModal
        isOpen={showOnRamp}
        onClose={() => { setShowOnRamp(false); setActiveTab('bridge'); }}
        theme={theme}
      />
    </div>
  );
}
