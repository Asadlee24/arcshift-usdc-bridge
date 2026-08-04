// components/bridge/FaucetHubModal.tsx
// Interactive, beautifully designed multi-chain Faucet Hub Modal (Supports dark/light themes)

'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, HelpCircle, Droplet, DollarSign } from 'lucide-react';
import { SUPPORTED_CHAINS, ChainMetadata } from '../../constants/chains';

interface FaucetHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light';
}

interface FaucetLink {
  name: string;
  url: string;
  type: 'gas' | 'usdc';
}

const getFaucetsForChain = (chain: ChainMetadata): FaucetLink[] => {
  const isArc = chain.id === 5042002;
  
  if (isArc) {
    return [
      { name: 'Circle USDC Faucet (Arc Gas)', url: 'https://faucet.circle.com/', type: 'usdc' },
    ];
  }

  const faucets: FaucetLink[] = [
    { name: 'Circle USDC Faucet', url: 'https://faucet.circle.com/', type: 'usdc' }
  ];

  switch (chain.id) {
    case 11155111: // Ethereum Sepolia
      faucets.unshift({ name: 'Alchemy Sepolia ETH Faucet', url: 'https://sepoliafaucet.com/', type: 'gas' });
      faucets.unshift({ name: 'QuickNode Sepolia ETH', url: 'https://faucet.quicknode.com/ethereum/sepolia', type: 'gas' });
      break;
    case 84532: // Base Sepolia
      faucets.unshift({ name: 'Base Sepolia Gas Faucet', url: 'https://basefaucet.com/', type: 'gas' });
      faucets.unshift({ name: 'QuickNode Base Sepolia', url: 'https://faucet.quicknode.com/base/sepolia', type: 'gas' });
      break;
    case 421614: // Arbitrum Sepolia
      faucets.unshift({ name: 'Arbitrum Sepolia Faucet', url: 'https://faucet.quicknode.com/arbitrum/sepolia', type: 'gas' });
      break;
    case 43113: // Avalanche Fuji
      faucets.unshift({ name: 'Core Avalanche Fuji Faucet', url: 'https://faucet.avax.network/', type: 'gas' });
      break;
    case 11155420: // OP Sepolia
      faucets.unshift({ name: 'Optimism Sepolia Faucet', url: 'https://faucet.quicknode.com/optimism/sepolia', type: 'gas' });
      break;
    case 59141: // Linea Sepolia
      faucets.unshift({ name: 'Infura Linea Faucet', url: 'https://www.infura.io/faucet/linea', type: 'gas' });
      break;
    case 80002: // Polygon Amoy
      faucets.unshift({ name: 'Polygon Amoy POL Faucet', url: 'https://faucet.polygon.technology/', type: 'gas' });
      break;
    case 1301: // Unichain Sepolia
      faucets.unshift({ name: 'Uniswap Unichain Faucet', url: 'https://faucet.uniswap.org', type: 'gas' });
      faucets.unshift({ name: 'ETHGlobal Unichain Faucet', url: 'https://faucet.ethglobal.com', type: 'gas' });
      break;
    case 14601: // Sonic Testnet
      faucets.unshift({ name: 'Official Sonic Faucet', url: 'https://testnet.soniclabs.com/account', type: 'gas' });
      break;
    case 998: // HyperEVM Testnet
      faucets.unshift({ name: 'Hyperliquid Faucet', url: 'https://faucet.hyperliquid.xyz', type: 'gas' });
      break;
    case 10143: // Monad Testnet
      faucets.unshift({ name: 'Official Monad Faucet', url: 'https://faucet.monad.xyz', type: 'gas' });
      break;
    case 763373: // Ink Sepolia
      faucets.unshift({ name: 'Official Ink Faucet', url: 'https://faucet.inkonchain.com', type: 'gas' });
      break;
    case 1328: // Sei Testnet
      faucets.unshift({ name: 'Official Sei Faucet', url: 'https://faucet.sei.io', type: 'gas' });
      break;
    case 4801: // World Chain Sepolia
      faucets.unshift({ name: 'QuickNode World Chain', url: 'https://faucet.quicknode.com/worldchain/sepolia', type: 'gas' });
      break;
    case 688689: // Pharos Atlantic Testnet
      faucets.unshift({ name: 'ZAN Pharos Faucet', url: 'https://faucet.zan.top/pharos', type: 'gas' });
      faucets.unshift({ name: 'Gas.zip Pharos Faucet', url: 'https://gas.zip', type: 'gas' });
      break;
    case 656476: // Codex Testnet
      faucets.unshift({ name: 'Gelato Faucet (EDU)', url: 'https://faucet.gelato.digital', type: 'gas' });
      break;
    case 3456: // EDGE Testnet
      faucets.unshift({ name: 'Official EDGE Faucet', url: 'https://faucet.layeredge.io', type: 'gas' });
      break;
    case 1439: // Injective Testnet
      faucets.unshift({ name: 'Injective Testnet Faucet', url: 'https://testnet.faucet.injective.network', type: 'gas' });
      break;
    case 2810: // Morph Testnet
      faucets.unshift({ name: 'Official Morph Faucet', url: 'https://faucet.morphl2.io', type: 'gas' });
      break;
    case 98867: // Plume Testnet
      faucets.unshift({ name: 'Official Plume Faucet', url: 'https://faucet.plume.org', type: 'gas' });
      break;
    case 51: // XDC Apothem
      faucets.unshift({ name: 'XDC Apothem Faucet', url: 'https://faucet.apothem.network', type: 'gas' });
      break;
  }

  return faucets;
};

export default function FaucetHubModal({ isOpen, onClose, theme = 'light' }: FaucetHubModalProps) {
  const isDark = theme === 'dark';

  const modalBg = isDark ? 'bg-[#0F172A] border-[#1E293B]' : 'bg-white border-slate-200';
  const overlayBg = 'bg-black/60 backdrop-blur-sm';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';
  const closeBtn = isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100';
  
  const chainCardBg = isDark ? 'bg-[#131B2E]/60 border-[#1E293B]' : 'bg-slate-50 border-slate-200';
  const faucetItemBg = isDark ? 'bg-[#0F172A]/80 hover:bg-[#0F172A]' : 'bg-white hover:bg-slate-100/50';
  const faucetItemBorder = isDark ? 'border-[#1E293B]' : 'border-slate-200/80';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className={`fixed inset-0 ${overlayBg}`}
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className={`relative w-full max-w-2xl rounded-2xl border p-5 sm:p-6 shadow-2xl flex flex-col gap-4 select-none z-10 ${modalBg} max-h-[85vh]`}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-dashed border-slate-700/20">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-full bg-[#10B981]/15 text-[#10B981] flex items-center justify-center">
                  <Droplet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className={`text-[16px] font-black tracking-tight ${textPrimary}`}>
                    Multi-Chain Faucet Hub
                  </h3>
                  <p className={`text-[11px] font-semibold ${textMuted}`}>
                    Claim free testnet gas tokens and USDC to test your transfers
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${closeBtn}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Faucet List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-4.5">
              {SUPPORTED_CHAINS.map((chain) => {
                const faucets = getFaucetsForChain(chain);
                
                return (
                  <div
                    key={chain.id}
                    className={`border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${chainCardBg}`}
                  >
                    {/* Chain Header */}
                    <div className="flex items-center gap-2.5 min-w-[150px]">
                      <div className="h-8 w-8 rounded-full bg-slate-950/20 border border-slate-700/10 p-0.5 flex items-center justify-center flex-shrink-0">
                        <img
                          src={chain.iconUrl}
                          alt={chain.name}
                          className="h-full w-full object-contain rounded-full bg-slate-950"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className={`text-[13px] font-extrabold ${textPrimary}`}>
                          {chain.name}
                        </span>
                        <span className={`text-[10px] font-semibold ${textMuted}`}>
                          ID: {chain.id}
                        </span>
                      </div>
                    </div>

                    {/* Faucet Links */}
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {faucets.map((faucet, idx) => (
                        <a
                          key={idx}
                          href={faucet.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center justify-between border rounded-[8px] px-3 py-2 text-[11px] font-bold transition-all cursor-pointer ${faucetItemBg} ${faucetItemBorder}`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {faucet.type === 'gas' ? (
                              <Droplet className="h-3.5 w-3.5 text-[#10B981] flex-shrink-0" />
                            ) : (
                              <DollarSign className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                            )}
                            <span className={`truncate ${isDark ? 'text-slate-300 hover:text-white' : 'text-slate-700 hover:text-slate-900'}`}>
                              {faucet.name}
                            </span>
                          </div>
                          <ExternalLink className="h-3 w-3 text-slate-500 flex-shrink-0 ml-1.5" />
                        </a>
                      ))}
                    </div>

                  </div>
                );
              })}
            </div>

            {/* Info Footer */}
            <div className="text-[10px] font-semibold text-slate-500 text-center flex items-center justify-center gap-1.5 pt-2 border-t border-dashed border-slate-700/20 select-none">
              <HelpCircle className="h-3.5 w-3.5" />
              <span>
                Note: Faucets require a connected wallet address. Arc Network uses USDC directly for gas fees.
              </span>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
