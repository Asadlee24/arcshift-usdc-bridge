// components/bridge/BridgeButton.tsx
// Ultra-sleek unified bridge CTA button

import React from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { Loader2, ArrowRight, Wallet, ShieldAlert, Check, RotateCw, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { getChainById } from '../../constants/chains';
import { useWallet } from '@solana/wallet-adapter-react';

interface BridgeButtonProps {
  fromChainId: number;
  toChainId: number;
  status: 'idle' | 'bridging' | 'success' | 'error';
  activeStepIndex: number;
  amount: string;
  isValidAmount: boolean;
  onBridge: () => void;
  disabled?: boolean;
}

export default function BridgeButton({
  fromChainId,
  toChainId,
  status,
  activeStepIndex,
  amount,
  isValidAmount,
  onBridge,
  disabled = false,
}: BridgeButtonProps) {
  const { isConnected, chainId } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChain } = useSwitchChain();
  const solanaWallet = useWallet();

  const fromChain = getChainById(fromChainId);
  const toChain = getChainById(toChainId);

  const isSolanaFrom = fromChain?.isSolana || false;
  const isSolanaTo = toChain?.isSolana || false;
  const isSolanaRoute = isSolanaFrom || isSolanaTo;

  const isWrongChain = !isSolanaFrom && isConnected && chainId !== fromChainId;

  const heightClass = "h-13 sm:h-14";
  const roundedClass = "rounded-2xl";
  const textClass = "text-sm font-black tracking-wider uppercase";

  // 1a. SOLANA SOURCE — wallet not connected
  if (isSolanaFrom && !solanaWallet.connected) {
    return (
      <motion.button
        type="button"
        onClick={async () => {
          try {
            if (!solanaWallet.wallet) {
              solanaWallet.select('Phantom' as any);
            }
            await solanaWallet.connect();
          } catch (e) {
            console.log('Solana wallet connect trigger:', e);
          }
        }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className={`w-full ${heightClass} ${roundedClass} ${textClass} bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-purple-900/30 transition-all`}
      >
        <Wallet className="h-4 w-4" />
        <span>CONNECT PHANTOM WALLET</span>
      </motion.button>
    );
  }

  // 1b. EVM → SOLANA — EVM wallet not connected
  if (!isSolanaFrom && isSolanaTo && !isConnected) {
    return (
      <motion.button
        type="button"
        onClick={openConnectModal}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className={`w-full ${heightClass} ${roundedClass} ${textClass} bg-gradient-to-r from-[#C8922A] via-[#D4A043] to-[#E8A830] hover:brightness-110 text-white flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#C8922A]/25 transition-all`}
      >
        <Wallet className="h-4 w-4" />
        <span>CONNECT EVM WALLET</span>
      </motion.button>
    );
  }

  // 1c. EVM → SOLANA — EVM connected but Solana receiver wallet not connected
  if (!isSolanaFrom && isSolanaTo && isConnected && !solanaWallet.connected) {
    return (
      <motion.button
        type="button"
        onClick={async () => {
          try {
            if (!solanaWallet.wallet) {
              solanaWallet.select('Phantom' as any);
            }
            await solanaWallet.connect();
          } catch (e) {
            console.log('Solana receiver wallet connect trigger:', e);
          }
        }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className={`w-full ${heightClass} ${roundedClass} ${textClass} bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-purple-900/30 transition-all`}
      >
        <Wallet className="h-4 w-4" />
        <span>CONNECT SOLANA RECEIVER</span>
      </motion.button>
    );
  }

  // 1d. STANDARD EVM — wallet not connected
  if (!isSolanaRoute && !isConnected) {
    return (
      <motion.button
        type="button"
        onClick={openConnectModal}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className={`w-full ${heightClass} ${roundedClass} ${textClass} bg-gradient-to-r from-[#C8922A] via-[#D4A043] to-[#E8A830] hover:brightness-110 text-white flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#C8922A]/25 transition-all`}
      >
        <Wallet className="h-4 w-4" />
        <span>CONNECT WALLET</span>
      </motion.button>
    );
  }

  // 2. WRONG CHAIN / NETWORK MISMATCH STATE
  if (isWrongChain && fromChain) {
    return (
      <motion.button
        type="button"
        onClick={() => switchChain({ chainId: fromChainId })}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className={`w-full ${heightClass} ${roundedClass} ${textClass} bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 transition-all`}
      >
        <ShieldAlert className="h-4 w-4 animate-bounce" />
        <span>Switch Network to {fromChain.shortName}</span>
      </motion.button>
    );
  }

  const isBridging = status === 'bridging';
  const isSuccess = status === 'success';
  const isError = status === 'error';

  const isBtnDisabled = disabled || isBridging || !isValidAmount || parseFloat(amount) <= 0;

  if (isSuccess) {
    return (
      <motion.button
        type="button"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`w-full ${heightClass} ${roundedClass} ${textClass} bg-emerald-500 text-white flex items-center justify-center gap-2 cursor-default shadow-lg shadow-emerald-500/20`}
      >
        <Check className="h-4 w-4 text-white" />
        <span>Bridge Complete</span>
      </motion.button>
    );
  }

  if (isError) {
    return (
      <motion.button
        type="button"
        onClick={onBridge}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className={`w-full ${heightClass} ${roundedClass} ${textClass} bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-red-600/20 transition-all`}
      >
        <RotateCw className="h-4 w-4" />
        <span>Try Again</span>
      </motion.button>
    );
  }

  return (
    <motion.button
      type="button"
      disabled={isBtnDisabled}
      onClick={onBridge}
      whileHover={isBtnDisabled ? {} : { scale: 1.01 }}
      whileTap={isBtnDisabled ? {} : { scale: 0.98 }}
      className={`w-full ${heightClass} ${roundedClass} ${textClass} flex items-center justify-center gap-2 transition-all duration-200 ${
        isBtnDisabled
          ? "bg-slate-800/50 text-slate-500 border border-slate-800 cursor-not-allowed"
          : `bg-gradient-to-r from-[#C8922A] via-[#D4A043] to-[#E8A830] hover:brightness-110 text-white cursor-pointer shadow-xl shadow-[#C8922A]/25`
      }`}
      style={{ outline: 'none' }}
    >
      <Zap className="h-4 w-4" />
      <span>Bridge to {toChain?.shortName || 'Destination'}</span>
      {isBridging ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <ArrowRight className="h-4 w-4" />
      )}
    </motion.button>
  );
}
