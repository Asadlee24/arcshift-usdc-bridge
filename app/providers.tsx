// app/providers.tsx
// Core Provider wrapper for Wagmi, RainbowKit, and React Query in Next.js App Router (Dark Mode optimized)

'use client';

import React, { useState, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { config } from '../lib/wagmi';

// Solana Wallet Adapter Imports
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { getSolanaRpcUrl } from '../lib/rpcEndpoints';


// Import RainbowKit CSS styles for the modal UI
import '@rainbow-me/rainbowkit/styles.css';

export function Providers({ children }: { children: React.ReactNode }) {
  // Ensure QueryClient is instantiated once per session (prevents recreation on state changes)
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  }));

  // Configure Solana Devnet Connection and Wallets.
  // Sourced from the central registry so a NEXT_PUBLIC_SOLANA_RPC override applies here too —
  // the public devnet endpoint is aggressively rate-limited, which made Solana reads and
  // bridge submissions intermittently fail.
  const endpoint = useMemo(() => getSolanaRpcUrl(), []);
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#0066FF',
            accentColorForeground: '#FFFFFF',
            borderRadius: 'large',
          })}
          modalSize="compact"
        >
          <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
              <div className="theme-rainbowkit min-h-screen flex flex-col">
                {children}
              </div>
            </WalletProvider>
          </ConnectionProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
