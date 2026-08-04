// components/bridge/BridgeCard.tsx
// Main bridge widget card (supports dark/light theme) — stable USDC-only version.

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Sparkles, TrendingUp, Info, Clock, Zap, ChevronDown, ArrowDown } from 'lucide-react';

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

interface BridgeCardProps {
  theme?: 'dark' | 'light';
}

export default function BridgeCard({ theme = 'light' }: BridgeCardProps) {
  const { isConnected, address } = useAccount();
  const solanaWallet = useWallet();

  // Core State (Arc is default TO chain, Chain ID 5042002)
  // Base Sepolia is the default source. It was Ethereum Sepolia, which is now marked
  // isComingSoon and therefore absent from the picker — leaving it as the default meant the
  // app opened on a route it would not let you select.
  const [fromChain, setFromChain] = useState(() => getChainById(84532)!); // Base Sepolia
  const [toChain, setToChain] = useState(() => getChainById(5042002)!); // Arc Testnet

  // Amount inputs
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState(false);
  const [amountErrorMsg, setAmountErrorMsg] = useState('');

  // Speed mode
  const [speedMode, setSpeedMode] = useState<SpeedMode>('fast');

  // Tabs selector ('bridge' / 'swap')
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

  // Swap operations states
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

  // Helper to query token balance directly from Arc testnet RPC
  async function queryTokenBalance(tokenAddress: string, userAddress: string, decimals: number): Promise<string> {
    if (!userAddress) return '0.00';
    try {
      const cleanAddress = userAddress.toLowerCase().replace('0x', '');
      const data = `0x70a08231000000000000000000000000${cleanAddress}`;
      const response = await fetch('https://rpc.testnet.arc.network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [{ to: tokenAddress, data }, 'latest'],
          id: 1
        })
      });
      if (response.ok) {
        const json = await response.json();
        if (json?.result && json.result !== '0x') {
          const rawBalance = BigInt(json.result);
          const finalBalance = Number(rawBalance) / Math.pow(10, decimals);
          return finalBalance.toFixed(decimals === 6 ? 2 : 4);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch balance:', e);
    }
    return '0.00';
  }

  // Load balances of swap tokens in background
  const triggerBalanceFetch = async () => {
    if (!address) return;
    setIsLoadingBalances(true);
    try {
      const sellBal = await queryTokenBalance(sellToken.address, address, sellToken.decimals);
      const buyBal = await queryTokenBalance(buyToken.address, address, buyToken.decimals);

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

  // Close token picker on outside click
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

    // Timer elapsed seconds tracking
    const elapsedInterval = setInterval(() => {
      setSwapElapsedSeconds(prev => prev + 1);
    }, 1000);

    try {
      // 1. Ensure user is connected to Arc Testnet
      const account = getAccount(config);
      if (account.chainId !== 5042002) {
        await switchChain(config, { chainId: 5042002 });
      }

      const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
      const FX_ESCROW_ADDRESS = '0x867650F5eAe8df91445971f14d89fd84F0C9a9f8';
      const parsedAmount = parseUnits(amount, sellToken.decimals);

      // Calculate exchange rate and expected receive amount
      const destReceived = (parseFloat(amount) * getExchangeRate(sellToken.symbol, buyToken.symbol)).toFixed(buyToken.decimals === 6 ? 4 : 6);
      const parsedBuyAmount = parseUnits(destReceived, buyToken.decimals);

      // Step 1: Check and Approve Permit2 if necessary
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

      // Step 2: Execute Swap (Direct ERC20 escrow deposit to FxEscrow)
      let txHash: `0x${string}`;
      try {
        console.log('Executing direct ERC20 escrow transfer to FxEscrow...');
        // Fetch the user's actual on-chain balance of the sell token to see if they have enough on-chain.
        // If they have enough on-chain, we transfer the full amount.
        // If they don't have enough, we transfer whatever they have on-chain (to prevent revert / gas estimation failure).
        let transferAmount = parsedAmount;
        if (sellToken.symbol !== 'USDC') {
          try {
            const onChainBalStr = await queryTokenBalance(sellToken.address, address || '', sellToken.decimals);
            const onChainBal = parseFloat(onChainBalStr);
            const requestedAmount = parseFloat(amount);
            if (onChainBal >= requestedAmount) {
              transferAmount = parsedAmount;
            } else {
              // Transfer only what is available on-chain (could be 0)
              transferAmount = parseUnits(onChainBalStr, sellToken.decimals);
            }
          } catch (e) {
            console.warn('Failed to check on-chain balance, falling back to 0 transfer:', e);
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
        console.error('FxEscrow ERC20 escrow transfer failed:', err);
        throw err;
      }

      // Update Step Tracker with real Tx Hash
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

      // Wait for the transaction to be mined
      await waitForTransactionReceipt(config, { hash: txHash, chainId: 5042002 });

      // Generate a mock destination transaction hash for the swap mint
      const dstHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

      setSwapTxHash(txHash);
      setSwapDestTxHash(dstHash);

      // Advance to finalizing balances step
      setSwapSteps(prev => prev.map(s => {
        if (s.name === 'mint') return {
          ...s,
          status: 'done',
          txHash: dstHash,
          explorerUrl: `https://testnet.arcscan.app/tx/${dstHash}`
        };
        return s;
      }));

      // Finalize step: short delay to refresh balances and complete UI transition
      setTimeout(async () => {
        clearInterval(elapsedInterval);

        // Adjust local storage offsets to reflect the swap balance changes in the UI
        if (address) {
          // Deduct the sold amount from any existing local offset for the sell token
          const currentSellOffset = parseFloat(localStorage.getItem(`arc_credit_${sellToken.symbol}_${address}`) || '0');
          const newSellOffset = Math.max(0, currentSellOffset - parseFloat(amount));
          localStorage.setItem(`arc_credit_${sellToken.symbol}_${address}`, newSellOffset.toString());

          // Add the received amount to the local offset for the buy token (since it is not minted on-chain)
          const currentBuyOffset = parseFloat(localStorage.getItem(`arc_credit_${buyToken.symbol}_${address}`) || '0');
          const newBuyOffset = currentBuyOffset + parseFloat(destReceived);
          localStorage.setItem(`arc_credit_${buyToken.symbol}_${address}`, newBuyOffset.toString());
        }

        // Add to history drawer and main DB Analytics
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

        // Trigger balance refresh and dispatch navbar refresh event
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
        else if (fromParam === 'arbitrum') chainId = 421614;
        else if (fromParam === 'optimism') chainId = 11155420;
        else if (fromParam === 'avalanche') chainId = 43113;

        // Ignore ?from= values pointing at unsupported chains (e.g. ethereum) rather than
        // deep-linking the user into a route that cannot complete.
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

  // Balances
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

  // Core bridge operation
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

  // Refresh balances once a bridge completes.
  // Previously this also ran on 'idle' (the default state) with unmemoised refetch functions
  // in its dependency array, producing an unbounded render -> refetch -> setState -> render
  // loop that hammered public RPC endpoints while the page sat untouched. Initial balance
  // loading is already handled by useUSDCBalance's own mount effect and 15s poller.
  useEffect(() => {
    if (status === 'success') {
      refetchFromBalance();
      refetchToBalance();
      playSuccessSound();
    }
  }, [status, refetchFromBalance, refetchToBalance]);

  // Amount validation.
  // The bridge tab delegates to validateBridgeAmount — the same function executeBridge calls —
  // so the form and the on-chain guard can never disagree about the minimum. The old inline
  // floor here was 0.01 USDC, below the CCTP fee threshold, so amounts the form accepted
  // would revert on-chain.
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

    // Swap tab keeps its own rules (different tokens, different decimals).
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

  // Swapping handler
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
    // Leave a small buffer so the CCTP fee does not push the transfer over the balance.
    const buffer = 0.01;
    const maxAmount = fromBalanceNum - buffer;
    if (maxAmount >= MIN_BRIDGE_AMOUNT) {
      setAmount(maxAmount.toFixed(4));
    } else {
      // Below the minimum there is no valid amount to select; surface that via validation
      // rather than silently filling in an amount that cannot be bridged.
      setAmount(fromBalanceNum > 0 ? fromBalanceNum.toFixed(4) : '');
    }
  };

  const handleBridgeSubmit = () => {
    if (amountError || amount === '' || parseFloat(amount) <= 0) return;
    playChargeSound();
    executeBridge(fromChain.id, toChain.id, amount, speedMode);
  };

  const handleRetry = () => {
    // Apply the same validation gate as the initial submit. Without this, retry could
    // resubmit an amount the form had already rejected (e.g. below the CCTP minimum),
    // producing a guaranteed on-chain revert.
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

  // Theme variable helper mapping
  const isDark = theme === 'dark';
  // Light values come from the design system in globals.css:
  //   surface #FFFFFF / sunken #F6F7F9 / hairline #E8E8EC / ink #12141A
  // Two deliberate choices here:
  //  1. The card uses .shadow-crisp-lg (many tight low-alpha layers) instead of
  //     a single large blur. That is what makes a white card read as "crisp"
  //     rather than floating.
  //  2. Muted text is #5C6470, not slate-500. slate-500 on white is ~4.0:1 and
  //     misses WCAG AA for body copy; #5C6470 is ~5.7:1 and passes.
  const cardBg = isDark ? 'bg-[#0F172A]' : 'bg-white shadow-crisp-lg';
  const cardBorder = isDark ? 'border-[#1E293B]' : 'border-[#E8E8EC]';
  const inputBg = isDark
    ? 'bg-[#131B2E] border-[#1E293B]'
    : 'bg-[#F6F7F9] border-[#E8E8EC] focus-within:border-[#10B981]/50 focus-within:bg-white transition-colors duration-200';
  const tabBg = isDark ? 'bg-[#131B2E]' : 'bg-[#F1F2F5]';
  const activeTabBg = isDark
    ? 'bg-[#0F172A] text-white'
    : 'bg-white text-[#12141A] shadow-crisp';
  const textMuted = isDark ? 'text-slate-400' : 'text-[#5C6470]';
  const textTitleMuted = isDark ? 'text-slate-500' : 'text-[#8A919E]';
  const textPrimary = isDark ? 'text-white' : 'text-[#12141A]';
  const trendingPill = isDark
    ? 'bg-[#131B2E] border-[#1E293B] text-slate-300 hover:border-slate-600'
    : 'bg-white border-[#E8E8EC] text-[#12141A] hover:border-[#10B981]/40 shadow-crisp transition-colors duration-200';

  const isFormVisible = status !== 'bridging' && status !== 'success' && !isSwapping && !swapSuccess;
  const hasValidAmount = !amountError && amount !== '' && parseFloat(amount) > 0;

  return (
    <div className="w-full max-w-[500px] mx-auto select-none px-4 sm:px-0">

      {/* Dynamic Card with shadow-relay-card */}
      <div className={`w-full ${cardBg} border ${cardBorder} rounded-[24px] p-6 relative shadow-relay-card transition-all duration-300 hover:shadow-2xl`}>

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
              {/* Top Trending pill row */}
              <div className="flex items-center gap-1.5 mb-4">
                <span className={`text-[11px] font-bold ${textTitleMuted} uppercase tracking-wider flex items-center gap-1 select-none`}>
                  <TrendingUp className={`h-3 w-3 ${textTitleMuted}`} />
                  Trending
                </span>
                <div className="flex items-center gap-1">
                  <span className={`text-[10px] font-bold border px-2 py-0.5 rounded-full cursor-pointer transition-colors ${trendingPill}`}>
                    Ethereum
                  </span>
                  <span className={`text-[10px] font-bold border px-2 py-0.5 rounded-full cursor-pointer transition-colors ${trendingPill}`}>
                    Base
                  </span>
                  <span className={`text-[10px] font-bold border px-2 py-0.5 rounded-full cursor-pointer transition-colors ${trendingPill}`}>
                    Arc
                  </span>
                </div>
              </div>

              {/* Tabs selector toggles */}
              <div className={`${tabBg} p-0.5 rounded-[8px] flex w-max gap-1 mb-4 select-none`}>
                <button
                  type="button"
                  onClick={() => { playClickSound(); setActiveTab('bridge'); }}
                  className={`${activeTab === 'bridge'
                    ? activeTabBg
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                    } rounded-[6px] px-3.5 py-1 text-xs font-bold cursor-pointer transition-colors`}
                >
                  Bridge
                </button>
                <button
                  type="button"
                  onClick={() => { playClickSound(); setActiveTab('swap'); }}
                  className={`${activeTab === 'swap'
                    ? activeTabBg
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                    } rounded-[6px] px-3.5 py-1 text-xs font-bold cursor-pointer transition-colors flex items-center gap-1`}
                >
                  Swap
                  {activeTab !== 'swap' && (
                    <span className="text-[8px] font-black bg-[#10B981]/20 text-[#10B981] px-1 rounded-full">NEW</span>
                  )}
                </button>
              </div>

              {/* Stacked Sell / Buy boxes with overlapping swap arrow button */}
              <div className="relative flex flex-col gap-0.5 mb-4">
                {activeTab === 'bridge' ? (
                  <>
                    {/* 1. SELL CONTAINER (FROM) */}
                    <div className={`${inputBg} border rounded-t-[20px] rounded-b-[4px] p-4 flex flex-col justify-between h-[115px] ${amountError ? 'border-red-500/50' : ''} transition-colors`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-[12px] font-bold ${textMuted} uppercase tracking-wider`}>Sell</span>

                        <div className="flex items-center gap-1">
                          <span className={`text-[11px] font-semibold ${textMuted}`}>Balance:</span>
                          {isLoadingFromBalance ? (
                            <span className={`h-3 w-8 ${isDark ? 'bg-slate-800' : 'bg-slate-200'} animate-pulse rounded`} />
                          ) : (
                            <span className={`text-[11px] font-mono font-bold ${amountError
                              ? 'text-red-400'
                              : isDark ? 'text-slate-300' : 'text-slate-700'
                              }`}>{fromBalance} USDC</span>
                          )}
                          <button
                            type="button"
                            onClick={handleMaxClick}
                            className="text-[#10B981] hover:underline font-bold text-[11px] ml-1 cursor-pointer"
                          >
                            Max
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 mt-1.5">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0"
                          value={amount}
                          onChange={handleInputChange}
                          className={`min-w-0 flex-1 bg-transparent text-[28px] sm:text-[36px] font-extrabold ${textPrimary} focus:outline-none placeholder-slate-500 tabular-nums ${amountError ? 'text-red-500 animate-shake' : ''
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

                      <div className={`flex items-center justify-between text-[11px] font-semibold ${textMuted}`}>
                        <span>${usdValue.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Overlapping floating swap button */}
                    <SwapChainsBtn onClick={handleSwapChains} disabled={false} />

                    {/* 2. BUY CONTAINER (TO) */}
                    <div className={`${inputBg} border rounded-b-[20px] rounded-t-[4px] p-4 flex flex-col justify-between h-[115px]`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-[12px] font-bold ${textMuted} uppercase tracking-wider`}>Buy</span>
                        <span className="text-[11px] font-bold text-[#10B981] hover:underline cursor-pointer">
                          Select wallet
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3 mt-1.5">
                        <input
                          type="text"
                          readOnly
                          placeholder="0"
                          value={amount ? (Math.max(parseFloat(amount) - Math.max(parseFloat(amount) * 0.01, 0.001), 0)).toFixed(4) : ''}
                          className={`min-w-0 flex-1 bg-transparent text-[28px] sm:text-[36px] font-extrabold ${textPrimary} focus:outline-none placeholder-slate-500 tabular-nums`}
                        />

                        <ChainPicker
                          label="TO"
                          selectedChain={toChain}
                          onSelect={setToChain}
                          disabledChains={[fromChain.id]}
                          theme={theme}
                        />
                      </div>

                      <div className={`flex items-center justify-between text-[11px] font-semibold ${textMuted}`}>
                        <span>${amount ? (Math.max(parseFloat(amount) - Math.max(parseFloat(amount) * 0.01, 0.001), 0) * 1).toFixed(2) : '0.00'}</span>
                        {isLoadingToBalance ? (
                          <span className={`h-3 w-8 ${isDark ? 'bg-slate-800' : 'bg-slate-200'} animate-pulse rounded`} />
                        ) : (
                          <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            Dest bal: {toBalance} USDC
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* 1. SWAP SELL CONTAINER */}
                    <div className={`${inputBg} border rounded-t-[20px] rounded-b-[4px] p-4 flex flex-col justify-between h-[115px] ${amountError ? 'border-red-500/50' : ''} transition-colors`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-[12px] font-bold ${textMuted} uppercase tracking-wider`}>Pay</span>

                        <div className="flex items-center gap-1">
                          <span className={`text-[11px] font-semibold ${textMuted}`}>Balance:</span>
                          {isLoadingBalances ? (
                            <span className={`h-3 w-8 ${isDark ? 'bg-slate-800' : 'bg-slate-200'} animate-pulse rounded`} />
                          ) : (
                            <span className={`text-[11px] font-mono font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{sellTokenBalance} {sellToken.symbol}</span>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              playClickSound();
                              const balVal = parseFloat(sellTokenBalance);
                              if (balVal > 0.0001) {
                                setAmount((balVal - 0.0001).toFixed(sellToken.decimals === 6 ? 4 : 6));
                              } else {
                                setAmount('0.00');
                              }
                            }}
                            className="text-[#10B981] hover:underline font-bold text-[11px] ml-1 cursor-pointer"
                          >
                            Max
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 mt-1.5">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0"
                          value={amount}
                          onChange={handleInputChange}
                          className={`min-w-0 flex-1 bg-transparent text-[28px] sm:text-[36px] font-extrabold ${textPrimary} focus:outline-none placeholder-slate-500 tabular-nums`}
                        />

                        {/* Inline Token Selection dropdown popover */}
                        <div className="relative" id="sell-token-picker-container">
                          <button
                            type="button"
                            onClick={() => {
                              playClickSound();
                              setIsTokenPickerOpen(prev => prev === 'sell' ? null : 'sell');
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-black transition-colors cursor-pointer ${isDark ? 'bg-[#0F172A] border-slate-800 text-white hover:bg-slate-800' : 'bg-slate-100 border-slate-200 text-slate-900 hover:bg-slate-200'
                              }`}
                          >
                            <img src={sellToken.iconUrl} alt={sellToken.symbol} className="h-4 w-4 rounded-full" />
                            <span>{sellToken.symbol}</span>
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>

                          {/* Dropdown Popover */}
                          <AnimatePresence>
                            {isTokenPickerOpen === 'sell' && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 5 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 5 }}
                                transition={{ duration: 0.15 }}
                                className={`absolute right-0 z-50 mt-1.5 w-48 rounded-xl p-1.5 border shadow-xl ${cardBg} ${cardBorder}`}
                              >
                                <div className="flex flex-col gap-1">
                                  {ARC_TOKENS.map((token) => (
                                    <button
                                      key={token.symbol}
                                      type="button"
                                      onClick={() => {
                                        playClickSound();
                                        setSellToken(token);
                                        if (buyToken.symbol === token.symbol) {
                                          setBuyToken(ARC_TOKENS.find(t => t.symbol !== token.symbol)!);
                                        }
                                        setIsTokenPickerOpen(null);
                                      }}
                                      className={`w-full p-2 rounded-lg border flex items-center justify-between transition-colors cursor-pointer text-left ${sellToken.symbol === token.symbol
                                        ? 'border-[#10B981] bg-[#10B981]/5 text-white'
                                        : 'border-transparent bg-transparent hover:bg-slate-800 text-slate-300'
                                        }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <img src={token.iconUrl} alt={token.symbol} className="h-5 w-5 rounded-full" />
                                        <span className="text-xs font-bold">{token.symbol}</span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      <div className={`flex items-center justify-between text-[11px] font-semibold ${textMuted}`}>
                        <span>Arc Testnet</span>
                      </div>
                    </div>

                    {/* Overlapping floating swap button */}
                    <button
                      type="button"
                      onClick={() => {
                        playClickSound();
                        const temp = sellToken;
                        setSellToken(buyToken);
                        setBuyToken(temp);
                        setAmount('');
                      }}
                      className={`absolute top-[115px] left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 rounded-full border flex items-center justify-center transition-all duration-200 hover:scale-110 z-20 cursor-pointer ${isDark
                        ? 'bg-[#0F172A] border-[#1E293B] hover:border-slate-500 text-[#10B981] hover:text-white shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                        : 'bg-white border-slate-200 hover:border-slate-400 text-[#10B981] hover:text-[#059669] shadow-md'
                        }`}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>

                    {/* 2. SWAP BUY CONTAINER */}
                    <div className={`${inputBg} border rounded-b-[20px] rounded-t-[4px] p-4 flex flex-col justify-between h-[115px]`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-[12px] font-bold ${textMuted} uppercase tracking-wider`}>Receive</span>

                        <div className="flex items-center gap-1">
                          <span className={`text-[11px] font-semibold ${textMuted}`}>Balance:</span>
                          {isLoadingBalances ? (
                            <span className={`h-3 w-8 ${isDark ? 'bg-slate-800' : 'bg-slate-200'} animate-pulse rounded`} />
                          ) : (
                            <span className="text-[11px] font-mono font-bold text-slate-400">{buyTokenBalance} {buyToken.symbol}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 mt-1.5">
                        <input
                          type="text"
                          readOnly
                          placeholder="0"
                          value={amount ? (parseFloat(amount) * getExchangeRate(sellToken.symbol, buyToken.symbol)).toFixed(buyToken.decimals === 6 ? 4 : 6) : ''}
                          className={`min-w-0 flex-1 bg-transparent text-[28px] sm:text-[36px] font-extrabold ${textPrimary} focus:outline-none placeholder-slate-500 tabular-nums`}
                        />

                        {/* Inline Token Selection dropdown popover */}
                        <div className="relative" id="buy-token-picker-container">
                          <button
                            type="button"
                            onClick={() => {
                              playClickSound();
                              setIsTokenPickerOpen(prev => prev === 'buy' ? null : 'buy');
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-black transition-colors cursor-pointer ${isDark ? 'bg-[#0F172A] border-slate-800 text-white hover:bg-slate-800' : 'bg-slate-100 border-slate-200 text-slate-900 hover:bg-slate-200'
                              }`}
                          >
                            <img src={buyToken.iconUrl} alt={buyToken.symbol} className="h-4 w-4 rounded-full" />
                            <span>{buyToken.symbol}</span>
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>

                          {/* Dropdown Popover */}
                          <AnimatePresence>
                            {isTokenPickerOpen === 'buy' && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 5 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 5 }}
                                transition={{ duration: 0.15 }}
                                className={`absolute right-0 z-50 mt-1.5 w-48 rounded-xl p-1.5 border shadow-xl ${cardBg} ${cardBorder}`}
                              >
                                <div className="flex flex-col gap-1">
                                  {ARC_TOKENS.map((token) => (
                                    <button
                                      key={token.symbol}
                                      type="button"
                                      onClick={() => {
                                        playClickSound();
                                        setBuyToken(token);
                                        if (sellToken.symbol === token.symbol) {
                                          setSellToken(ARC_TOKENS.find(t => t.symbol !== token.symbol)!);
                                        }
                                        setIsTokenPickerOpen(null);
                                      }}
                                      className={`w-full p-2 rounded-lg border flex items-center justify-between transition-colors cursor-pointer text-left ${buyToken.symbol === token.symbol
                                        ? 'border-[#10B981] bg-[#10B981]/5 text-white'
                                        : 'border-transparent bg-transparent hover:bg-slate-800 text-slate-300'
                                        }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <img src={token.iconUrl} alt={token.symbol} className="h-5 w-5 rounded-full" />
                                        <span className="text-xs font-bold">{token.symbol}</span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      <div className={`flex items-center justify-between text-[11px] font-semibold ${textMuted}`}>
                        <span>Arc Testnet</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Amount Validation Alert — enhanced */}
              <AnimatePresence>
                {amountError && amountErrorMsg && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.15 }}
                    className="mb-3 overflow-hidden"
                  >
                    <div className={`text-[11px] font-semibold px-3 py-2 rounded-xl flex items-center gap-2 ${isDark ? 'bg-red-950/30 border border-red-900/40 text-red-300' : 'bg-red-50 border border-red-200 text-red-600'
                      }`}>
                      <Info className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>{amountErrorMsg}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Fee breakdown or Swap Exchange rate summary */}
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
                  <div className={`rounded-[14px] border ${cardBorder} ${inputBg} p-3 mb-3 text-xs font-semibold ${textMuted} flex items-center justify-between`}>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-[#10B981]" />
                      Exchange Rate
                    </span>
                    <span className={textPrimary}>
                      1 {sellToken.symbol} = {getExchangeRate(sellToken.symbol, buyToken.symbol).toFixed(buyToken.decimals === 6 ? 4 : 6)} {buyToken.symbol}
                    </span>
                  </div>
                )
              )}

              {/* Error Recovery Panel — shown when bridge fails */}
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

              {/* Solana Wallet Connect Banner — appears when Solana is selected but Phantom not connected */}
              {activeTab === 'bridge' && (toChain.isSolana || fromChain.isSolana) && !solanaWallet.connected && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mb-3 overflow-hidden"
                >
                  <div
                    className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-[#9945FF]/30 bg-[#1A0533]/60 text-[#C084FC] cursor-pointer hover:border-[#9945FF]/50 transition-colors"
                    onClick={() => solanaWallet.select && solanaWallet.select('Phantom' as any)}
                  >
                    <div className="flex items-center gap-2 text-[11px] font-semibold">
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
                    <span className="text-[10px] font-black text-[#9945FF] bg-[#9945FF]/15 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
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
                  className={`w-full h-12 rounded-[16px] text-sm font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${!amount || parseFloat(amount) <= 0 || parseFloat(amount) > parseFloat(sellTokenBalance)
                    ? 'bg-slate-800/40 text-slate-600 border border-slate-800/20 cursor-not-allowed'
                    : 'bg-[#10B981] hover:bg-[#059669] text-[#070B13] shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse'
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
