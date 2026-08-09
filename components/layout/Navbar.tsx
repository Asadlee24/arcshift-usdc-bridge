// components/layout/Navbar.tsx
// Header navbar with clean unified dark/light themes, responsive logo, mobile drawer, and wallet controls

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useDisconnect } from 'wagmi';
import { LogOut, ChevronDown, Copy, Check, Sun, Moon, History, Wallet, Menu, X, ExternalLink, Zap, Shield, BookOpen, Code2 } from 'lucide-react';
import { getChainById } from '../../constants/chains';
import { useUSDCBalance } from '../../hooks/useUSDCBalance';
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { formattedBalance: arcBalance, isLoading: isLoadingArc } = useUSDCBalance(5042002);

  const handleCopyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

  // Harmonized theme mappings
  const navBg = isDark
    ? 'bg-[#060D1A]/95 border-slate-800/80 text-white'
    : 'bg-white/95 border-slate-200 shadow-sm text-slate-900';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const activeLink = 'text-[#C8922A] border-[#C8922A]';
  const pillBg = isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700';
  const hoverBg = isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-200';
  const activePillBg = isDark
    ? 'bg-slate-900 border-slate-800 text-white hover:bg-slate-800'
    : 'bg-slate-100 border-slate-200 text-slate-900 hover:bg-slate-200';
  const dropdownMenuBg = isDark
    ? 'bg-[#0D1B2E] border-slate-800 shadow-2xl'
    : 'bg-white border-slate-200 shadow-xl';
  const dropdownItem = isDark
    ? 'text-slate-300 hover:bg-slate-900 hover:text-white'
    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900';

  const mobileDrawerBg = isDark
    ? 'bg-[#060D1A]/98 border-slate-800 text-white'
    : 'bg-white/98 border-slate-200 text-slate-900';

  return (
    <nav className={`sticky top-0 z-50 w-full border-b ${navBg} backdrop-blur-2xl transition-all duration-300 select-none`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 sm:h-20 items-center justify-between gap-2 sm:gap-4">

          {/* LEFT: Logo & Brand Links */}
          <div className="flex items-center gap-3 sm:gap-6">
            <a href="/" className="flex items-center cursor-pointer group">
              <img
                src="/bridgr-logo-dark.svg"
                alt="Bridgr Logo"
                className="h-10 sm:h-12 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
              />
            </a>

            {/* Desktop Menu Items */}
            <div className={`hidden lg:flex items-center gap-5 text-sm font-bold pl-4 border-l ${isDark ? 'border-slate-800' : 'border-slate-200'} ${textMuted}`}>
              <span className={`${activeLink} border-b-2 py-1 cursor-default`}>Bridge</span>
              <a
                href="/analytics"
                className="hover:text-[#C8922A] transition-colors py-1 cursor-pointer"
              >
                Analytics
              </a>
              <a
                href="https://testnet.arcscan.app"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#C8922A] transition-colors py-1 cursor-pointer flex items-center gap-1"
              >
                Explorer
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  if (onOpenFaucet) onOpenFaucet();
                }}
                className="hover:text-[#C8922A] transition-colors py-1 cursor-pointer bg-transparent border-none font-bold text-sm outline-none text-left"
              >
                Faucet
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  if (onOpenGuide) onOpenGuide();
                }}
                className="hover:text-[#C8922A] transition-colors py-1 cursor-pointer bg-transparent border-none font-bold text-sm outline-none text-left"
              >
                Guide
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  if (onOpenDevPortal) onOpenDevPortal();
                }}
                className="hover:text-[#C8922A] transition-colors py-1 cursor-pointer bg-transparent border-none font-bold text-sm outline-none text-left"
              >
                Developers
              </button>
            </div>
          </div>

          {/* RIGHT: Consolidated controls */}
          <div className="flex items-center gap-1.5 sm:gap-3">

            {/* Desktop Quick Action: History Toggle */}
            <button
              onClick={() => {
                playClickSound();
                if (onOpenHistory) onOpenHistory();
              }}
              type="button"
              className={`hidden sm:flex h-9 w-9 items-center justify-center rounded-xl border transition-colors cursor-pointer ${pillBg} ${hoverBg}`}
              title="View Transaction History"
            >
              <History className="h-4 w-4" />
            </button>

            {/* Desktop Quick Action: Portfolio Toggle */}
            <button
              onClick={() => {
                playClickSound();
                if (onOpenPortfolio) onOpenPortfolio();
              }}
              type="button"
              className={`hidden sm:flex h-9 w-9 items-center justify-center rounded-xl border transition-colors cursor-pointer ${pillBg} ${hoverBg}`}
              title="View Unified USDC Portfolio"
            >
              <Wallet className="h-4 w-4" />
            </button>

            {/* Solana Wallet Button / Indicator */}
            {solanaWallet.connected && solanaAddress ? (
              <div className="hidden sm:flex items-center gap-1.5 h-9 pl-3 pr-2 rounded-xl bg-purple-950/40 border border-purple-800/40 text-purple-300 text-xs font-semibold select-none">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse flex-shrink-0" />
                <img
                  src="https://icons.llamao.fi/icons/chains/rsz_solana.jpg"
                  alt="Solana"
                  className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                />
                <span className="font-mono">{solanaShort}</span>
                <button
                  onClick={() => solanaWallet.disconnect()}
                  type="button"
                  className="p-1 rounded-md hover:bg-purple-900/50 text-purple-400 hover:text-white transition-colors cursor-pointer ml-0.5"
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
                className="hidden md:flex items-center gap-1.5 h-9 px-3 rounded-xl bg-purple-950/40 hover:bg-purple-900/50 border border-purple-800/40 text-purple-300 hover:text-white text-xs font-bold transition-colors cursor-pointer"
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
                className={`hidden sm:flex h-9 w-9 items-center justify-center rounded-xl border transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800'
                    : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
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
            
            {/* Primary Connect Button */}
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
                        className="h-9 px-4 rounded-xl bg-gradient-to-r from-[#C8922A] via-[#D4A043] to-[#E8A830] hover:brightness-110 text-white text-xs font-black tracking-wider transition-all cursor-pointer shadow-md shadow-[#C8922A]/20"
                      >
                        CONNECT WALLET
                      </button>
                    ) : chain.unsupported ? (
                      <button
                        onClick={openChainModal}
                        type="button"
                        className="h-9 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors cursor-pointer"
                      >
                        Wrong Network
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        
                        {/* Wallet Pill */}
                        <div className={`flex items-center gap-1.5 sm:gap-2 h-9 pl-3 pr-2 rounded-xl border ${pillBg} text-xs font-semibold select-none`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                          <span className="hidden md:inline text-[11px]">Arc: <span className="text-[#C8922A] font-bold font-mono">{isLoadingArc ? '...' : `${arcBalance} USDC`}</span></span>
                          <span className="hidden md:inline text-slate-500">|</span>
                          <span className={`${textPrimary} font-mono font-medium text-[11px] sm:text-xs`}>{account.displayName}</span>
                          <button
                            onClick={() => handleCopyAddress(account.address)}
                            type="button"
                            className={`p-1 rounded-md ${hoverBg} text-slate-400 hover:text-white transition-colors cursor-pointer`}
                            title="Copy wallet address"
                          >
                            {copied ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>

                        {/* Active network pill */}
                        <button
                          onClick={openChainModal}
                          type="button"
                          className={`hidden lg:flex items-center gap-1.5 h-9 px-3 rounded-xl border ${activePillBg} text-xs font-bold transition-colors cursor-pointer`}
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

                        {/* Account options dropdown toggle */}
                        <div className="relative" ref={dropdownRef}>
                          <button
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            type="button"
                            className={`flex items-center justify-center h-9 w-9 rounded-xl border ${pillBg} ${hoverBg} transition-colors cursor-pointer`}
                          >
                            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                          </button>

                          {/* Dropdown Menu Options */}
                          <div className={`absolute right-0 top-full mt-2 w-48 ${dropdownMenuBg} rounded-2xl p-1 shadow-2xl z-50 ${isDropdownOpen ? 'block' : 'hidden'}`}>
                            <button
                              onClick={() => {
                                openAccountModal();
                                setIsDropdownOpen(false);
                              }}
                              type="button"
                              className={`flex w-full items-center px-4 py-2 text-left text-xs font-bold ${dropdownItem} rounded-xl transition-colors`}
                            >
                              Account Details
                            </button>
                            <div className={`h-[1px] ${isDark ? 'bg-slate-800' : 'bg-slate-100'} my-1`} />
                            <button
                              onClick={() => {
                                disconnect();
                                setIsDropdownOpen(false);
                              }}
                              type="button"
                              className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs font-bold text-red-400 hover:bg-red-950/30 rounded-xl transition-colors"
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

            {/* Mobile Hamburger Toggle Button */}
            <button
              onClick={() => {
                playClickSound();
                setIsMobileMenuOpen(!isMobileMenuOpen);
              }}
              type="button"
              className={`lg:hidden flex h-9 w-9 items-center justify-center rounded-xl border transition-colors cursor-pointer ${pillBg}`}
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
            </button>

          </div>

        </div>
      </div>

      {/* MOBILE MENU DRAWER OVERLAY */}
      {isMobileMenuOpen && (
        <div className={`lg:hidden border-b ${mobileDrawerBg} backdrop-blur-2xl transition-all duration-300 animate-in slide-in-from-top-2`}>
          <div className="px-4 pt-3 pb-6 space-y-4 max-w-7xl mx-auto">
            
            {/* Mobile Navigation Links Grid */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <a
                href="/"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold ${
                  isDark ? 'bg-slate-900 text-[#C8922A] border border-slate-800' : 'bg-slate-100 text-slate-900 border border-slate-200'
                }`}
              >
                <Zap className="w-4 h-4 text-[#C8922A]" />
                Bridge
              </a>
              <a
                href="/analytics"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold ${
                  isDark ? 'hover:bg-slate-900 text-slate-300' : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                Analytics
              </a>
              <a
                href="https://testnet.arcscan.app"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold ${
                  isDark ? 'hover:bg-slate-900 text-slate-300' : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                Explorer
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  if (onOpenFaucet) onOpenFaucet();
                }}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-left w-full ${
                  isDark ? 'hover:bg-slate-900 text-slate-300' : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Shield className="w-4 h-4 text-[#C8922A]" />
                Faucet
              </button>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  if (onOpenGuide) onOpenGuide();
                }}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-left w-full ${
                  isDark ? 'hover:bg-slate-900 text-slate-300' : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <BookOpen className="w-4 h-4 text-[#C8922A]" />
                Guide
              </button>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  if (onOpenDevPortal) onOpenDevPortal();
                }}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-left w-full ${
                  isDark ? 'hover:bg-slate-900 text-slate-300' : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Code2 className="w-4 h-4 text-[#C8922A]" />
                Developers
              </button>
            </div>

            <div className={`h-[1px] ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

            {/* Mobile Utility Actions Bar */}
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex items-center justify-between gap-2">

                {/* History Button */}
                <button
                  onClick={() => {
                    playClickSound();
                    setIsMobileMenuOpen(false);
                    if (onOpenHistory) onOpenHistory();
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-xl border text-xs font-bold ${
                    isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <History className="w-4 h-4 text-[#C8922A]" />
                  History
                </button>

                {/* Portfolio Button */}
                <button
                  onClick={() => {
                    playClickSound();
                    setIsMobileMenuOpen(false);
                    if (onOpenPortfolio) onOpenPortfolio();
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-xl border text-xs font-bold ${
                    isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <Wallet className="w-4 h-4 text-[#C8922A]" />
                  Portfolio
                </button>

                {/* Theme Toggle */}
                {onToggleTheme && (
                  <button
                    onClick={() => {
                      playClickSound();
                      onToggleTheme();
                    }}
                    className={`flex items-center justify-center h-9 px-3 rounded-xl border text-xs font-bold ${
                      isDark ? 'bg-slate-900 border-slate-800 text-amber-400' : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </button>
                )}

              </div>

              {/* Solana Wallet Button on Mobile */}
              {solanaWallet.connected && solanaAddress ? (
                <div className="flex items-center justify-between h-9 px-3 rounded-xl bg-purple-950/40 border border-purple-800/40 text-purple-300 text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <img
                      src="https://icons.llamao.fi/icons/chains/rsz_solana.jpg"
                      alt="Solana"
                      className="w-4 h-4 rounded-full"
                    />
                    <span className="font-mono">{solanaShort}</span>
                  </div>
                  <button
                    onClick={() => solanaWallet.disconnect()}
                    type="button"
                    className="p-1 text-purple-400 hover:text-white"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={async () => {
                    setIsMobileMenuOpen(false);
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
                  className="w-full flex items-center justify-center gap-2 h-9 rounded-xl bg-purple-950/40 border border-purple-800/40 text-purple-300 text-xs font-bold"
                >
                  <img
                    src="https://icons.llamao.fi/icons/chains/rsz_solana.jpg"
                    alt="Solana"
                    className="w-4 h-4 rounded-full"
                  />
                  <span>Connect Phantom / Solana Wallet</span>
                </button>
              )}

            </div>

          </div>
        </div>
      )}

    </nav>
  );
}
