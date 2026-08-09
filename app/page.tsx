// app/page.tsx
// Main application homepage rendering the complete Arc Bridge experience and integrating 3D reactive canvases

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

  const cardBg = isDark
    ? 'bg-[#0D1B2E]/90 border-slate-800 text-white shadow-xl'
    : 'bg-white border-slate-200 shadow-xl text-slate-900';
  const headingColor = isDark ? 'text-white' : 'text-slate-900';
  const descColor = isDark ? 'text-slate-400' : 'text-slate-600';

  return (
    <div className="w-full max-w-5xl mx-auto py-4 sm:py-6 px-4 select-none mb-10">
      <div className={`${cardBg} border rounded-2xl p-5 sm:p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-5 sm:gap-6 transition-all duration-300`}>
        
        {/* Left column: Security description */}
        <div className="flex items-center sm:items-start md:items-center gap-4 flex-col sm:flex-row text-center sm:text-left">
          <div className="h-12 w-12 rounded-full bg-[#C8922A]/15 text-[#C8922A] flex items-center justify-center flex-shrink-0">
            <Shield className="h-6 w-6 text-[#C8922A]" />
          </div>
          <div>
            <span className="inline-block text-[10px] font-black text-[#C8922A] bg-[#C8922A]/15 px-2.5 py-0.5 rounded-md tracking-wider uppercase mb-1.5 border border-[#C8922A]/30">
              SECURITY AUDITED
            </span>
            <h3 className={`text-[16px] font-bold ${headingColor}`}>
              Engineered & Secured by Asad Lee
            </h3>
            <p className={`text-[12px] sm:text-[13px] font-medium ${descColor} max-w-xl mt-1 leading-relaxed`}>
              Designed with rigorous security principles by a Cybersecurity Specialist from IMSciences. Certified secure stablecoin CCTP integration protecting cross chain assets.
            </p>
          </div>
        </div>

        {/* Right column: Click CTA */}
        <a
          href="https://asad-lee-portfolio.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full sm:w-auto flex-shrink-0 h-11 px-6 rounded-xl bg-gradient-to-r from-[#C8922A] via-[#D4A043] to-[#E8A830] hover:brightness-110 text-white text-xs font-bold flex items-center justify-center transition-all shadow-md shadow-[#C8922A]/20 select-none cursor-pointer"
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
        const savedTheme = localStorage.getItem('bridgr-theme');
        if (savedTheme === 'light' || savedTheme === 'dark') {
          setTheme(savedTheme);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [theme]);

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('bridgr-theme', nextTheme);
  };

  const isDark = theme === 'dark';
  const pageBg = isDark
    ? 'bg-[#060D1A] text-white'
    : 'bg-slate-50 text-slate-900';

  if (isWidgetMode) {
    const activeTheme = forcedTheme || theme;
    const isWidgetDark = activeTheme === 'dark';
    return (
      <div className={`fixed inset-0 flex items-center justify-center p-4 overflow-hidden ${
        isWidgetDark ? 'bg-[#060D1A]' : 'bg-transparent'
      }`}>
        <BridgeCard theme={activeTheme} />
      </div>
    );
  }

  return (
    <div className={`relative min-h-screen flex flex-col z-10 ${pageBg} transition-colors duration-300`}>
      
      {/* 3D Background Canvas */}
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
