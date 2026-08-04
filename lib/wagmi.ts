// lib/wagmi.ts
// RainbowKit + Wagmi v2 Configuration — All supported chains registered for network switching

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  okxWallet,
  rabbyWallet,
  coinbaseWallet,
  walletConnectWallet,
  rainbowWallet,
  phantomWallet,
} from '@rainbow-me/rainbowkit/wallets';
import {
  sepolia,
  baseSepolia,
  arbitrumSepolia,
  avalancheFuji,
  optimismSepolia,
  lineaSepolia,
  polygonAmoy,
} from 'wagmi/chains';
import { type Transport } from 'wagmi';
import { arcTestnet } from './arcChain';
import {
  unichainSepolia,
  sonicTestnet,
  hyperEvmTestnet,
  monadTestnet,
  inkSepolia,
  seiTestnet,
  worldChainSepolia,
  pharosTestnet,
  codexTestnet,
  edgeTestnet,
  injectiveTestnet,
  morphTestnet,
  plumeTestnet,
  xdcApothem,
} from './allChains';
import { transportForChain } from './publicClient';

// WalletConnect project ID from env
const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || '148d42d3d9e29a8a706509f6df849a78';

/**
 * Builds a transport for a chain from the central endpoint registry.
 *
 * Two things this fixes over the previous hardcoded list:
 *
 * 1. Correctness. Arc Testnet was wired directly to https://rpc.testnet.arc.network, which
 *    sends no CORS headers, so every browser read failed with "HTTP request failed /
 *    Failed to fetch" — the balanceOf error users hit. getClientRpcUrls() substitutes the
 *    same-origin /api/rpc proxy for endpoints like that. Sepolia and Polygon Amoy also had
 *    dead endpoints (404 / unreachable) in *first* position, so their reads paid a full
 *    timeout before falling back.
 *
 * 2. Speed. Every transport now batches: wagmi coalesces the many concurrent eth_calls the
 *    UI makes (balances, allowance, decimals, gas) into a single HTTP request per chain
 *    instead of one round trip each. Endpoints are also ordered fastest-first, and the
 *    per-request timeout is bounded so a slow node can't stall the UI.
 */
function transportFor(chainId: number): Transport {
  // Delegates to lib/publicClient so wagmi, the Circle SDK, and every ad-hoc read share one
  // definition of "how do I reach this chain". Previously this logic was duplicated here,
  // which let the SDK drift onto its own CORS-blocked endpoints.
  return transportForChain(chainId);
}

export const config = getDefaultConfig({
  appName: 'ArcShift',
  projectId,
  wallets: [
    {
      groupName: 'Recommended',
      wallets: [metaMaskWallet, okxWallet, rabbyWallet],
    },
    {
      groupName: 'More Wallets',
      wallets: [coinbaseWallet, walletConnectWallet, rainbowWallet, phantomWallet],
    },
  ],
  chains: [
    // ── Core chains (original) ─────────────────────────
    arcTestnet,
    sepolia,
    baseSepolia,
    arbitrumSepolia,
    avalancheFuji,
    optimismSepolia,
    lineaSepolia,
    polygonAmoy,
    // ── New chains from Arc BridgeChain enum ───────────
    unichainSepolia,
    sonicTestnet,
    hyperEvmTestnet,
    monadTestnet,
    inkSepolia,
    seiTestnet,
    worldChainSepolia,
    pharosTestnet,
    codexTestnet,
    edgeTestnet,
    injectiveTestnet,
    morphTestnet,
    plumeTestnet,
    xdcApothem,
  ],
  transports: {
    [arcTestnet.id]: transportFor(arcTestnet.id),
    [sepolia.id]: transportFor(sepolia.id),
    [baseSepolia.id]: transportFor(baseSepolia.id),
    [arbitrumSepolia.id]: transportFor(arbitrumSepolia.id),
    [avalancheFuji.id]: transportFor(avalancheFuji.id),
    [optimismSepolia.id]: transportFor(optimismSepolia.id),
    [lineaSepolia.id]: transportFor(lineaSepolia.id),
    [polygonAmoy.id]: transportFor(polygonAmoy.id),
    // New chains from Arc BridgeChain enum
    [unichainSepolia.id]: transportFor(unichainSepolia.id),
    [sonicTestnet.id]: transportFor(sonicTestnet.id),
    [hyperEvmTestnet.id]: transportFor(hyperEvmTestnet.id),
    [monadTestnet.id]: transportFor(monadTestnet.id),
    [inkSepolia.id]: transportFor(inkSepolia.id),
    [seiTestnet.id]: transportFor(seiTestnet.id),
    [worldChainSepolia.id]: transportFor(worldChainSepolia.id),
    [pharosTestnet.id]: transportFor(pharosTestnet.id),
    [codexTestnet.id]: transportFor(codexTestnet.id),
    [edgeTestnet.id]: transportFor(edgeTestnet.id),
    [injectiveTestnet.id]: transportFor(injectiveTestnet.id),
    [morphTestnet.id]: transportFor(morphTestnet.id),
    [plumeTestnet.id]: transportFor(plumeTestnet.id),
    [xdcApothem.id]: transportFor(xdcApothem.id),
  },
  ssr: true, // Next.js App Router SSR compatibility
});
