// components/layout/Footer.tsx
// Redesigned dark-themed Footer featuring clean branding, developer wallet chips, and clear links (Supports dark/light theme)

'use client';

import React from 'react';
import { useAccount } from 'wagmi';
import { BookOpen, HelpCircle } from 'lucide-react';

interface FooterProps {
  theme?: 'dark' | 'light';
}

export default function Footer({ theme = 'light' }: FooterProps) {
  const { isConnected, address } = useAccount();

  // Shorten user developer address
  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '';

  const isDark = theme === 'dark';

  const footerBg = isDark ? 'bg-[#070B13] border-t border-[#1E293B]' : 'bg-white border-t border-slate-200 shadow-inner';
  const brandText = isDark ? 'text-white' : 'text-slate-800';
  const descText = isDark ? 'text-slate-400' : 'text-slate-500';
  const chipBg = isDark ? 'bg-[#0F172A] border-[#1E293B] text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600';
  const linkText = isDark ? 'text-slate-400 hover:text-[#10B981]' : 'text-slate-500 hover:text-[#059669]';
  const copyrightBorder = isDark ? 'border-[#1E293B]' : 'border-slate-100';
  const copyrightText = isDark ? 'text-slate-500' : 'text-slate-400';

  return (
    <footer className={`w-full ${footerBg} py-8 select-none`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">

          {/* LEFT: Branding */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left select-none">
            <span className={`text-[14px] font-extrabold ${brandText} tracking-tight`}>
              BRIDGR
            </span>
            <span className={`text-[11px] font-semibold ${descText} mt-0.5`}>
              Designed and built by{' '}
              <a
                href="https://asad-lee-portfolio.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#10B981] hover:underline font-bold"
              >
                Asad Lee
              </a>
            </span>
          </div>

          {/* CENTER: Connected Developer Wallet Status */}
          {isConnected && address && (
            <div className={`flex items-center gap-2 ${chipBg} px-3.5 py-1.5 rounded-full select-none shadow-sm`}>
              <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
              <span className="text-[11px] font-mono font-bold tracking-wide">
                Developer Wallet: {shortAddress}
              </span>
            </div>
          )}

          {/* RIGHT: Document and Explorer Links & Socials */}
          <div className="flex items-center gap-5 select-none">
            <a
              href="https://developers.circle.com/stablecoins/docs/cctp-technical-reference"
              target="_blank"
              rel="noreferrer"
              className={`text-xs font-bold ${linkText} transition-colors flex items-center gap-1.5 cursor-pointer`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Docs</span>
            </a>

            <a
              href="https://testnet.arcscan.app"
              target="_blank"
              rel="noreferrer"
              className={`text-xs font-bold ${linkText} transition-colors flex items-center gap-1.5 cursor-pointer`}
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Explorer</span>
            </a>

            {/* Social SVGs */}
            <div className="flex items-center gap-2 ml-1">
              <a
                href="https://x.com/asadleo416"
                target="_blank"
                rel="noreferrer"
                className={`flex h-7 w-7 items-center justify-center rounded-full ${chipBg} hover:bg-[#10B981]/10 hover:border-[#10B981]/30 hover:text-[#10B981] transition-all cursor-pointer`}
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              
              <a
                href="https://linkedin.com/in/asad-ali-3355273ba"
                target="_blank"
                rel="noreferrer"
                className={`flex h-7 w-7 items-center justify-center rounded-full ${chipBg} hover:bg-[#10B981]/10 hover:border-[#10B981]/30 hover:text-[#10B981] transition-all cursor-pointer`}
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
              </a>
            </div>
          </div>

        </div>

        {/* Copyright */}
        <div className={`mt-6 pt-4 border-t ${copyrightBorder} text-center select-none`}>
          <span className={`text-[10px] font-bold ${copyrightText}`}>
            2026 Bridgr. Powered by Circle and CCTP.
          </span>
        </div>
      </div>
    </footer>
  );
}
