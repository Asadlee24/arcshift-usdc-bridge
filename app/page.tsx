// app/page.tsx
// Main application homepage rendering the complete Arc Bridge experience and integrating 3D reactive canvases (Supports Dark/Light Themes dynamically)

'use client';

import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Shield } from 'lucide-react';

import ArcBackground from '../components/three/ArcBackground';
import Navbar from '../components/layout/Navbar';
import HeroSection from '../components/layout/HeroSection';
import BridgeCard from '../components/bridge/BridgeCard';
import PromoSection from '../components/layout/PromoSection';
import Footer from '../components/layout/Footer';
import TransactionHistoryDrawer from '../components/bridge/TransactionHistoryDrawer';
import FaucetHubModal from '../components/bridge/FaucetHubModal';
import BridgeGuideModal from '../components/bridge/BridgeGuideModal';
import UnifiedPortfolioDrawer from '../components/bridge/UnifiedPortfolioDrawer';
import DevPortalDrawer from '../components/bridge/DevPortalDrawer';

interface SpotlightProps {
  theme?: 'dark' | 'light';
}

function DeveloperSpotlight({ theme = 'light' }: SpotlightProps) {
  const isDark = theme === 'dark';
  
  const cardBg = isDark ? 'bg-[#0F172A] border-[#1E293B]' : 'bg-white border-slate-200';
  const headingColor = isDark ? 'text-white' : 'text-slate-900';
  const descColor = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="w-full max-w-5xl mx-auto py-6 px-4 select-none mb-10">
      <div className={`${cardBg} border rounded-[20px] p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm hover:shadow-md transition-shadow`}>
        
        {/* Left column: Security description */}
        <div className="flex items-center gap-4 flex-col sm:flex-row text-center sm:text-left">
          <div className="h-12 w-12 rounded-full bg-[#10B981]/15 text-[#10B981] flex items-center justify-center flex-shrink-0 animate-pulse">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <span className="inline-block text-[10px] font-extrabold text-[#10B981] bg-[#10B981]/15 px-2 py-0.5 rounded-[4px] tracking-wider uppercase mb-1 border border-[#10B981]/25">
              SECURITY AUDITED
            </span>
            <h3 className={`text-[16px] font-black ${headingColor}`}>
              Engineered & Secured by Asad Lee
            </h3>
            <p className={`text-[12px] font-semibold ${descColor} max-w-xl mt-1 leading-relaxed`}>
              Designed with rigorous security principles by a Cybersecurity Specialist from IMSciences. Certified secure stablecoin CCTP integration protecting cross chain assets.
            </p>
          </div>
        </div>

        {/* Right column: Click CTA */}
        <a
          href="https://asad-lee-portfolio.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 h-11 px-6 rounded-[10px] bg-[#10B981] hover:bg-[#059669] text-[#070B13] text-xs font-black flex items-center justify-center transition-colors shadow-sm select-none cursor-pointer"
        >
          View Developer Portfolio
        </a>
      </div>
    </div>
  );
}

export default function Home() {
  const { isConnected } = useAccount();
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isFaucetOpen, setIsFaucetOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isPortfolioOpen, setIsPortfolioOpen] = useState(false);
  const [isDevPortalOpen, setIsDevPortalOpen] = useState(false);
  const [isWidgetMode, setIsWidgetMode] = useState(false);
  const [forcedTheme, setForcedTheme] = useState<'dark' | 'light' | null>(null);

  // Load user theme preference or widget preferences if any
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('widget') === 'true') {
        setIsWidgetMode(true);
      }
      const t = params.get('theme');
      if (t === 'light' || t === 'dark') {
        setForcedTheme(t);
        setTheme(t);
      } else {
        const savedTheme = localStorage.getItem('arcshift-theme');
        if (savedTheme === 'light' || savedTheme === 'dark') {
          setTheme(savedTheme);
        }
      }
    }
  }, []);

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('arcshift-theme', nextTheme);
  };

  const isDark = theme === 'dark';
  // Light mode uses .arc-canvas (hairline grid + soft brand washes, defined in
  // globals.css) rather than a flat fill, so the page has texture behind the
  // white cards instead of white-on-white.
  const pageBg = isDark
    ? 'bg-[#070B13] text-white'
    : 'arc-canvas text-[#12141A]';

  if (isWidgetMode) {
    const activeTheme = forcedTheme || theme;
    const isWidgetDark = activeTheme === 'dark';
    return (
      <div className={`fixed inset-0 flex items-center justify-center p-4 overflow-hidden ${
        isWidgetDark ? 'bg-[#070B13]' : 'bg-transparent'
      }`}>
        <BridgeCard theme={activeTheme} />
      </div>
    );
  }

  return (
    <div className={`relative min-h-screen flex flex-col z-10 ${pageBg} transition-colors duration-300`}>
      
      {/* 3D Background Canvas — Reactive to Wallet Connection and Active Theme */}
      <ArcBackground isWalletConnected={isConnected} theme={theme} />

      {/* Header Navigation */}
      <Navbar
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenFaucet={() => setIsFaucetOpen(true)}
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenPortfolio={() => setIsPortfolioOpen(true)}
        onOpenDevPortal={() => setIsDevPortalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-start items-center py-6 sm:py-10">
        
        {/* Above-the-fold Hero */}
        <HeroSection theme={theme} />

        {/* Interactive Bridge Widget Card */}
        <div className="w-full flex justify-center items-center py-4">
          <BridgeCard theme={theme} />
        </div>


        {/* Promo Features Grid Section */}
        <PromoSection theme={theme} />

        {/* Custom Audited Developer Spotlight Showcase */}
        <DeveloperSpotlight theme={theme} />

      </main>

      {/* Footer credits and developer links */}
      <Footer theme={theme} />

      {/* Transaction History Slide-over Panel */}
      <TransactionHistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        theme={theme}
      />

      {/* Faucet Hub Modal */}
      <FaucetHubModal
        isOpen={isFaucetOpen}
        onClose={() => setIsFaucetOpen(false)}
        theme={theme}
      />

      {/* Bridge Guide Modal */}
      <BridgeGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        theme={theme}
      />

      {/* Unified Portfolio Drawer */}
      <UnifiedPortfolioDrawer
        isOpen={isPortfolioOpen}
        onClose={() => setIsPortfolioOpen(false)}
        theme={theme}
      />

      {/* Developer Widget SDK Portal Drawer */}
      <DevPortalDrawer
        isOpen={isDevPortalOpen}
        onClose={() => setIsDevPortalOpen(false)}
        theme={theme}
      />
    </div>
  );
}
