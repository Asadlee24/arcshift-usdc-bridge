// components/layout/Navbar.tsx
// Header navbar featuring custom theme support, large un-squished logo, emoji-free stats, and dynamic consolidated wallet controls (Touch-enabled for mobile)

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useDisconnect } from 'wagmi';
import { LogOut, ChevronDown, Copy, Check, Sun, Moon, History, Volume2, VolumeX, Wallet } from 'lucide-react';
import { getChainById } from '../../constants/chains';
import { useUSDCBalance } from '../../hooks/useUSDCBalance';
import TransactionHistoryDrawer from '../bridge/TransactionHistoryDrawer';
import { getMuteState, toggleMuted, playClickSound } from '../../lib/audio';
import { useWallet } from '@solana/wallet-adapter-react';

interface NavbarProps {
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  onOpenHistory?: () => void;
  onOpenFaucet?: () => void;
  onOpenGuide?: () => void;
  onOpenPortfolio?: () => void;
  onOpenDevPortal?: () => void;
}

export default function Navbar({ 
  theme = 'light', 
  onToggleTheme, 
  onOpenHistory, 
  onOpenFaucet, 
  onOpenGuide, 
  onOpenPortfolio,
  onOpenDevPortal 
}: NavbarProps) {
  const { isConnected, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const solanaWallet = useWallet();
  const solanaAddress = solanaWallet.publicKey?.toBase58();
  const solanaShort = solanaAddress ? `${solanaAddress.slice(0, 4)}...${solanaAddress.slice(-4)}` : '';

  const [copied, setCopied] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch native Arc chain USDC wallet balance (Arc Testnet Chain ID is 5042002)
  const { formattedBalance: arcBalance, isLoading: isLoadingArc } = useUSDCBalance(5042002);

  const handleCopyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isDark = theme === 'dark';
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setMuted(getMuteState());
  }, []);

  const handleToggleMute = () => {
    const nextMute = toggleMuted();
    setMuted(nextMute);
    if (!nextMute) {
      setTimeout(() => playClickSound(), 50);
    }
  };

  // Dynamic style mappings
  const navBg = isDark 
    ? 'bg-[#070B13]/95 border-[#1E293B]' 
    : 'bg-white/95 border-slate-200 shadow-sm';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const statsBg = isDark ? 'bg-[#0F172A] border-[#1E293B]' : 'bg-slate-50 border-slate-200';
  const statsPipe = isDark ? 'text-[#1E293B]' : 'text-slate-200';
  const activeLink = isDark ? 'text-white border-[#10B981]' : 'text-slate-900 border-[#059669]';
  const pillBg = isDark ? 'bg-[#0F172A] border-[#1E293B]' : 'bg-slate-50 border-slate-200';
  const hoverBg = isDark ? 'hover:bg-[#131B2E]' : 'hover:bg-slate-100';
  const activePillBg = isDark 
    ? 'bg-[#0F172A] border-[#1E293B] text-white hover:bg-[#131B2E]' 
    : 'bg-slate-50 border-slate-200 text-slate-900 hover:bg-slate-100';
  const dropdownMenuBg = isDark 
    ? 'bg-[#0F172A] border-[#1E293B]' 
    : 'bg-white border-slate-200 shadow-lg';
  const dropdownItem = isDark 
    ? 'text-slate-300 hover:bg-[#131B2E] hover:text-white' 
    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900';

  return (
    <nav className={`sticky top-0 z-50 w-full border-b ${navBg} backdrop-blur-xl transition-all duration-300 select-none`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between gap-4">

          {/* LEFT: Logo & Brand Links */}
          <div className="flex items-center gap-6">
            <div className="flex items-center cursor-pointer group relative">
              <img
                src="https://i.ibb.co/x8BwmWJR/6ceb4b2f-4218-408d-b61a-c34d0f3f181e.png"
                alt="ArcShift Logo"
                className="h-[72px] sm:h-[85px] w-auto object-contain scale-[1.3] origin-left transition-transform duration-300 group-hover:scale-[1.35]"
              />
            </div>

            {/* Menu Items */}
            <div className={`hidden md:flex items-center gap-6 text-sm font-semibold pl-4 border-l ${isDark ? 'border-[#1E293B]' : 'border-slate-200'} ${textMuted}`}>
              <span className={`${activeLink} border-b-2 py-1 cursor-default`}>Bridge</span>
              <a
                href="/analytics"
                className="hover:text-[#10B981] transition-colors py-1 cursor-pointer"
              >
                Analytics
              </a>
              <a
                href="https://testnet.arcscan.app"
                target="_blank"
                rel="noopener noreferrer"
                className={`hover:text-[#10B981] transition-colors py-1 cursor-pointer`}
              >
                Explorer
              </a>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  if (onOpenFaucet) onOpenFaucet();
                }}
                className="hover:text-[#10B981] transition-colors py-1 cursor-pointer bg-transparent border-none font-semibold text-sm outline-none text-left"
              >
                Faucet
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  if (onOpenGuide) onOpenGuide();
                }}
                className="hover:text-[#10B981] transition-colors py-1 cursor-pointer bg-transparent border-none font-semibold text-sm outline-none text-left"
              >
                Guide
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  if (onOpenDevPortal) onOpenDevPortal();
                }}
                className="hover:text-[#10B981] transition-colors py-1 cursor-pointer bg-transparent border-none font-semibold text-sm outline-none text-left"
              >
                Developers
              </button>
            </div>
          </div>



          {/* RIGHT: Consolidated wallet controls */}
          <div className="flex items-center gap-3">

            {/* History Toggle Button */}
            <button
              onClick={() => {
                playClickSound();
                if (onOpenHistory) onOpenHistory();
              }}
              type="button"
              className={`flex h-9 w-9 items-center justify-center rounded-[8px] border transition-colors cursor-pointer ${
                isDark
                  ? 'bg-[#0F172A] border-[#1E293B] text-slate-400 hover:bg-[#131B2E] hover:text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
              title="View Transaction History"
            >
              <History className="h-4 w-4" />
            </button>

            {/* Portfolio Toggle Button */}
            <button
              onClick={() => {
                playClickSound();
                if (onOpenPortfolio) onOpenPortfolio();
              }}
              type="button"
              className={`flex h-9 w-9 items-center justify-center rounded-[8px] border transition-colors cursor-pointer ${
                isDark
                  ? 'bg-[#0F172A] border-[#1E293B] text-slate-400 hover:bg-[#131B2E] hover:text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
              title="View Unified USDC Portfolio"
            >
              <Wallet className="h-4 w-4" />
            </button>

            {/* Solana Wallet Button / Indicator */}
            {solanaWallet.connected && solanaAddress ? (
              <div className={`flex items-center gap-1.5 h-9 pl-3 pr-2 rounded-[8px] bg-[#1A0533] border border-[#9945FF]/30 text-[#C084FC] text-xs font-semibold select-none`}>
                <span className="h-1.5 w-1.5 rounded-full bg-[#9945FF] animate-pulse flex-shrink-0" />
                <img
                  src="https://icons.llamao.fi/icons/chains/rsz_solana.jpg"
                  alt="Solana"
                  className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                />
                <span className="hidden sm:inline font-mono">{solanaShort}</span>
                <button
                  onClick={() => solanaWallet.disconnect()}
                  type="button"
                  className="p-1 rounded-[4px] hover:bg-[#9945FF]/20 text-[#9945FF] hover:text-white transition-colors cursor-pointer ml-0.5"
                  title="Disconnect Solana Wallet"
                >
                  <LogOut className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={async () => {
                  try {
                    if (!solanaWallet.wallet) {
                      solanaWallet.select('Phantom' as any);
                    }
                    await solanaWallet.connect();
                  } catch (e) {
                    console.log('Solana navbar connect trigger:', e);
                  }
                }}
                type="button"
                className="hidden sm:flex items-center gap-1.5 h-9 px-3 rounded-[8px] bg-[#1A0533] hover:bg-[#2A0852] border border-[#9945FF]/40 text-[#C084FC] hover:text-white text-xs font-bold transition-colors cursor-pointer"
                title="Connect Phantom / Solana Wallet"
              >
                <img
                  src="https://icons.llamao.fi/icons/chains/rsz_solana.jpg"
                  alt="Solana"
                  className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                />
                <span>Phantom</span>
              </button>
            )}


            {/* Theme Toggle Button */}
            {onToggleTheme && (
              <button
                onClick={() => {
                  playClickSound();
                  if (onToggleTheme) onToggleTheme();
                }}
                type="button"
                className={`flex h-9 w-9 items-center justify-center rounded-[8px] border transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-[#0F172A] border-[#1E293B] text-amber-400 hover:bg-[#131B2E] hover:text-amber-300'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
                title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {isDark ? (
                  <Sun className="h-4 w-4 fill-amber-400/20" />
                ) : (
                  <Moon className="h-4 w-4 fill-slate-600/10" />
                )}
              </button>
            )}
            
            <ConnectButton.Custom>
              {({
                account,
                chain,
                openAccountModal,
                openChainModal,
                openConnectModal,
                mounted,
              }) => {
                const ready = mounted;
                const connected = ready && account && chain;

                return (
                  <div
                    {...(!ready && {
                      'aria-hidden': true,
                      style: {
                        opacity: 0,
                        pointerEvents: 'none',
                        userSelect: 'none',
                      },
                    })}
                  >
                    {!connected ? (
                      <button
                        onClick={openConnectModal}
                        type="button"
                        className="h-9 px-4 rounded-[8px] bg-[#10B981] hover:bg-[#059669] text-[#070B13] text-xs font-black tracking-wider transition-colors cursor-pointer animate-pulse"
                      >
                        CONNECT WALLET
                      </button>
                    ) : chain.unsupported ? (
                      <button
                        onClick={openChainModal}
                        type="button"
                        className="h-9 px-4 rounded-[8px] bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors cursor-pointer"
                      >
                        Wrong Network
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        
                        {/* UNIFIED WALLET PILL: Compact balance, copy address and address display */}
                        <div className={`flex items-center gap-2 h-9 pl-3 pr-2 rounded-[8px] ${pillBg} ${isDark ? 'text-slate-300' : 'text-slate-700'} text-xs font-semibold select-none`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-pulse" />
                          <span className="hidden sm:inline">Arc: <span className="text-[#10B981] font-bold font-mono">{isLoadingArc ? '...' : `${arcBalance} USDC`}</span></span>
                          <span className={`hidden sm:inline ${statsPipe}`}>|</span>
                          <span className={`${textPrimary} font-mono font-medium`}>{account.displayName}</span>
                          <button
                            onClick={() => handleCopyAddress(account.address)}
                            type="button"
                            className={`p-1 rounded-[4px] ${hoverBg} text-slate-400 hover:text-white transition-colors cursor-pointer ml-0.5`}
                            title="Copy wallet address"
                          >
                            {copied ? (
                              <Check className="h-3.5 w-3.5 text-[#10B981]" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>

                        {/* Active network pill */}
                        <button
                          onClick={openChainModal}
                          type="button"
                          className={`hidden md:flex items-center gap-1.5 h-9 px-3.5 rounded-[8px] ${activePillBg} text-xs font-bold transition-colors cursor-pointer`}
                        >
                          {chain.hasIcon && chain.iconUrl && (
                            <img
                              alt={chain.name ?? 'Chain icon'}
                              src={chain.iconUrl}
                              className="w-4 h-4 rounded-full mr-1"
                            />
                          )}
                          <span>{chain.name}</span>
                          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                        </button>

                        {/* Touch/Click Enabled Dropdown Menu for Mobile & Desktop */}
                        <div className="relative" ref={dropdownRef}>
                          <button
                            onClick={() => setIsOpenDropdown(!isDropdownOpen)}
                            type="button"
                            className={`flex items-center justify-center h-9 w-9 rounded-[8px] ${pillBg} ${isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'} ${hoverBg} transition-colors cursor-pointer`}
                          >
                            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                          </button>

                          {/* Dropdown Menu Options */}
                          <div className={`absolute right-0 top-full mt-1.5 w-48 ${dropdownMenuBg} rounded-[8px] py-1 shadow-relay-dropdown z-50 ${isDropdownOpen ? 'block' : 'hidden'}`}>
                            <button
                              onClick={() => {
                                openAccountModal();
                                setIsOpenDropdown(false);
                              }}
                              type="button"
                              className={`flex w-full items-center px-4 py-2 text-left text-xs font-semibold ${dropdownItem} transition-colors`}
                            >
                              Account details
                            </button>
                            <div className={`h-[1px] ${isDark ? 'bg-[#1E293B]' : 'bg-slate-100'} my-1`} />
                            <button
                              onClick={() => {
                                disconnect();
                                setIsOpenDropdown(false);
                              }}
                              type="button"
                              className={`flex w-full items-center gap-2 px-4 py-2 text-left text-xs font-semibold text-red-400 hover:bg-red-950/30 transition-colors`}
                            >
                              <LogOut className="h-3.5 w-3.5" />
                              <span>Disconnect</span>
                            </button>
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                );
              }}
            </ConnectButton.Custom>
          </div>

        </div>
      </div>
    </nav>
  );

  // Helper toggle to avoid React state naming bugs
  function setIsOpenDropdown(open: boolean) {
    setIsDropdownOpen(open);
  }
}
